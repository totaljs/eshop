NEWSCHEMA('Product').make(function(schema) {

	schema.define('id', 'String(10)');
	schema.define('pictures', '[String]');
	schema.define('reference', 'String(20)');
	schema.define('category', 'String(300)', true);
	schema.define('manufacturer', 'String(50)');
	schema.define('name', 'String(50)', true);
	schema.define('price', Number, true);
	schema.define('body', String, true);
	schema.define('istop', Boolean);
	schema.define('linker', 'String(50)');
	schema.define('linker_category', 'String(50)');
	schema.define('linker_manufacturer', 'String(50)');
	schema.define('datecreated', Date);

	// Sets default values
	schema.setDefault(function(name) {
		switch (name) {
			case 'datecreated':
				return new Date();
		}
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {

		// options.search {String}
		// options.category {String}
		// options.page {String or Number}
		// options.max {String or Number}
		// options.id {String}

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.id && typeof(options.id) === 'string')
			options.id = options.id.split(',');

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);
		var nosql = DB(error);

		nosql.listing('products', 'products').make(function(builder) {

			builder.where('isremoved', false);

			if (options.category)
				builder.like('linker_category', '^' + options.category);

			if (options.manufacturer)
				builder.where('manufacturer', options.manufacturer);

			if (options.search)
				builder.in('search', options.search.keywords(true, true));

			if (options.id)
				builder.in('id', options.id);

			if (options.skip)
				builder.where('id', '<>', options.skip);

			builder.limit(take);
			builder.skip(skip);

			if (options.homepage)
				builder.sort('istop', false);
			else
				builder.sort('_id', false);
		});

		nosql.exec(function(err, response) {

			var data = {};
			data.count = response.products.count;
			data.items = response.products.items;
			data.pages = Math.floor(data.count / options.max) + (data.count % options.max ? 1 : 0);

			var linker_detail = F.sitemap('detail', true);
			var linker_category = F.sitemap('category', true);

			data.items.forEach(function(item) {
				if (linker_detail)
					item.linker = linker_detail.url.format(item.linker);
				if (linker_category)
					item.linker_category = linker_category.url.format(item.linker_category);
			});

			if (!data.pages)
				data.pages = 1;

			data.page = options.page + 1;
			callback(data);
		});
	});

	// Saves the product into the database
	schema.setSave(function(error, model, options, callback) {

		var count = 0;
		var isnew = false;
		var dt = new Date();

		if (!model.id) {
			model.id = U.GUID(10);
			model.datecreated = dt;
			isnew = true;
		} else
			model.dateupdated = dt;

		model.linker = ((model.reference ? model.reference + '-' : '') + model.name).slug();
		model.linker_manufacturer = model.manufacturer ? model.manufacturer.slug() : '';
		model.search = (model.name + ' ' + model.manufacturer + ' ' + model.category).keywords(true, true);

		var category = prepare_subcategories(model.category);
		model.category = category.name;
		model.linker_category = category.linker;
		model.isremoved = false;

		var nosql = DB(error);

		nosql.save('product', 'products', isnew, function(builder, isnew) {
			builder.set(model);
			if (isnew)
				return;
			builder.where('id', model.id);
			builder.first();
		});

		nosql.exec(function(err, response) {
			F.emit('products.save', model);
			// Returns response
			callback(SUCCESS(true));
			// Refreshes internal information e.g. categories
			setTimeout(refresh, 1000);
		});
	});

	// Gets a specific product
	schema.setGet(function(error, model, options, callback) {

		// options.category {String}
		// options.linker {String}
		// options.id {String}

		var nosql = DB(error);

		nosql.select('product', 'products').make(function(builder) {
			if (options.category)
				builder.regex('linker_category', new RegExp('^' + options.category));

			if (options.linker)
				builder.where('linker', options.linker);

			if (options.id)
				builder.where('id', options.id);

			builder.first();
		});

		nosql.validate('product', 'error-404-product');
		nosql.exec(callback, 'product');
	});

	// Removes product
	schema.setRemove(function(error, id, callback) {

		var nosql = DB(error);

		nosql.update('products').make(function(builder) {
			builder.set('isremoved', true);
			builder.where('id', id);
			builder.first();
		});

		nosql.exec(SUCCESS(callback));

		// Refreshes internal information e.g. categories
		setTimeout(refresh, 1000);
	});

	// Clears product database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var nosql = DB(error);
		nosql.remove('products');
		nosql.exec(SUCCESS(callback));
	});

	// Refreshes categories
	schema.addWorkflow('refresh', function(error, model, options, callback) {
		refresh();
		callback(SUCCESS(true));
	});

	// Replaces category
	schema.addWorkflow('category', function(error, model, options, callback) {

		// options.category_old
		// options.category_new

		var category_old = prepare_subcategories(options.category_old);
		var category_new = prepare_subcategories(options.category_new);

		var nosql = DB(error);

		nosql.select('products', 'products').where(function(builder) {
			builder.where('linker_category', new RegExp('^' + category_old.linker));
			builder.fields('linker_category', 'category');
		});

		nosql.exec(function(err, response) {
			if (err)
				return callback();

			var items = response.products;
			var updates = [];

			for (var i = 0, length = items.length; i < length; i++) {
				var doc = items[i];
				updates.push({ _id: doc._id, category: doc.category.replace(category_old.name, category_new.name), linker_category: doc.linker_category.replace(category_old.linker, category_new.linker) });
			}

			updates.wait(function(item, next) {
				nosql = DB(error);
				nosql.update('product').make(function(builder) {
					builder.set(item);
					builder.first();
					builder.where('_id', item._id);
				});
				nosql.exec(next, -1);
			}, function() {
				if (updates.length)
					setTimeout(refresh, 100);
				callback(SUCCESS(true));
			});
		});
	});

	// Imports CSV
	schema.addWorkflow('import.csv', function(error, model, filename, callback) {
		require('fs').readFile(filename, function(err, buffer) {

			if (err) {
				error.push(err);
				callback();
				return;
			}

			buffer = buffer.toString('utf8').split('\n');

			var properties = [];
			var schema = GETSCHEMA('Product');
			var isFirst = true;
			var count = 0;

			buffer.wait(function(line, next) {

				if (!line)
					return next();

				var data = line.replace(/\"/g, '').split(';')
				var product = {};

				for (var i = 0, length = data.length; i < length; i++) {
					var value = data[i];
					if (!value)
						continue;

					if (isFirst)
						properties.push(value);
					else
						product[properties[i]] = value;
				}

				if (isFirst) {
					isFirst = false;
					return next();
				}

				schema.make(product, function(err, model) {
					if (err)
						return next();
					count++;
					model.$save(next);
				});
			}, function() {

				if (count)
					refresh();

				// Done, returns response
				callback(SUCCESS(count > 0));
			});
		});
	});

	// Imports XML
	schema.addWorkflow('import.xml', function(error, model, filename, callback) {

		var products = [];
		var count = 0;
		var stream = require('fs').createReadStream(filename);

		stream.on('data', U.streamer('<product>', '</product>', function(value) {

			var index = value.indexOf('<product>');
			if (index === -1)
				return;

			value = value.substring(index).trim();
			xml = value.parseXML();

			var obj = {};

			Object.keys(xml).forEach(function(key) {
				var prop = key.replace('product.', '');
				obj[prop] = xml[key];
			});

			products.push(obj);
		}));

		CLEANUP(stream, function() {

			var Fs = require('fs');
			var id;
			var db = DB();

			products.wait(function(product, next) {

				var fn = function() {
					schema.make(product, function(err, model) {
						if (err)
							return next();
						count++;
						model.$save(next);
					});
				};

				if (!product.pictures)
					return fn();

				id = [];

				product.pictures.split(',').wait(function(picture, next) {
					U.download(picture.trim(), ['get', 'dnscache'], function(err, response) {
						if (err)
							return next();
						var filename = F.path.temp(U.GUID(10) + '.jpg');
						var writer = Fs.createWriteStream(filename);
						response.pipe(writer);
						CLEANUP(writer, function() {
							var tmp = new ObjectID();
							db.writeFile(DB(), tmp, filename, U.getName(picture), null, function(err) {
								Fs.unlink(filename, NOOP);
								if (err)
									return next();
								id.push(tmp.toString());
								setTimeout(next, 200);
							});
						});
					});
				}, function() {
					product.pictures = id;
					fn();
				}, 3); // 3 threads

			}, function() {

				if (count)
					refresh();

				if (id)
					Fs.unlink(filename, NOOP);

				// Done, returns response
				callback(SUCCESS(count > 0));
			});
		});
	});

	schema.addWorkflow('export.xml', function(error, model, options, callback) {
		var nosql = DB(error);

		nosql.select('products', 'products').make(function(builder) {
			builder.where('isremoved', false);
		});


		nosql.exec(function(err, response) {

			if (err)
				return callback();

			var xml = [];
			var docs = response.products;

			for (var i = 0, length = docs.length; i < length; i++) {
				var doc = docs[i];
				var keys = Object.keys(doc);
				var line = '<product>';

				keys.forEach(function(key) {

					if (key === 'id' || key === '_id' || key === 'linker_category' || key === 'linker_manufacturer' || key === 'isremoved' || key === 'search' || key === 'linker')
						return;

					var val = doc[key];
					var tmp;

					if (val === null)
						val = '';

					if (key === 'pictures') {

						tmp = '';

						val.forEach(function(id) {
							tmp += (tmp ? ',' : '') + F.config.custom.url + '/download/' + id + '.jpg';
						});

						val = tmp;

					} else if (val instanceof Date) {
						val = val.format();
					} else if (val instanceof Array) {
						val = val.join(',');
					} else if (typeof(val) !== 'string')
						val = val.toString();

					if (!val)
						return;

					line += '<{0}>{1}</{0}>'.format(key, val.encode());
				});

				xml.push(line + '</product>');
			}

			callback('<?xml version="1.0" encoding="UTF-8"?><products>' + xml.join('') + '</products>');
		});
	});
});

// Refreshes internal information (categories and manufacturers)
function refresh() {

	var nosql = DB();

	nosql.push('categories', 'products', function(collection, callback) {

		// groupping
		var $group = {};
		$group._id = {};
		$group._id.linker_category = '$linker_category';
		$group._id.category = '$category';
		$group.count = { $sum: 1 };

		// filter
		var $match = {};
		$match.isremoved = false;

		var pipeline = [];
		pipeline.push({ $match: $match });
		pipeline.push({ $group: $group });

		collection.aggregate(pipeline, callback);
	});

	nosql.push('manufacturers', 'products', function(collection, callback) {

		// groupping
		var $group = {};
		$group._id = {};
		$group._id.linker_manufacturer = '$linker_manufacturer';
		$group._id.manufacturer = '$manufacturer';
		$group.count = { $sum: 1 };

		// filter
		var $match = {};
		$match.isremoved = false;

		var pipeline = [];
		pipeline.push({ $match: $match });
		pipeline.push({ $group: $group });

		collection.aggregate(pipeline, callback);
	});

	nosql.exec(function(err, response) {

		var db_manufacturers = {};
		var db_categories = {};

		for (var i = 0, length = response.manufacturers.length; i < length; i++) {
			var doc = response.manufacturers[i];
			db_manufacturers[doc._id.manufacturer] = { count: doc.count, linker: doc._id.linker_manufacturer };
		}

		for (var i = 0, length = response.categories.length; i < length; i++) {
			var doc = response.categories[i];
			db_categories[doc._id.category] = { count: doc.count, linker: doc._id.linker_category, path: doc._id.linker_category.split('/'), names: doc._id.category.split('/').trim() };
		}

		// Prepares categories with their subcategories
		var keys = Object.keys(db_categories);
		var categories = [];
		var categories_filter = {};

		for (var i = 0, length = keys.length; i < length; i++) {
			var name = keys[i];
			var item = db_categories[name];

			item.path.forEach(function(path, index) {
				var key = item.path.slice(0, index + 1).join('/');

				if (categories_filter[key]) {
					categories_filter[key].count += item.count;
					return;
				}

				var obj = {};
				obj.linker = key;
				obj.name = item.names.slice(0, index + 1).join(' / ');
				obj.count = item.count;
				obj.text = item.names[index];
				obj.parent = item.path.slice(0, index).join('/');
				obj.level = index;
				categories_filter[key] = obj;
			});
		}

		Object.keys(categories_filter).forEach(function(key) {
			categories.push(categories_filter[key]);
		});

		categories.sort(function(a, b) {
			if (a.level > b.level)
				return 1;
			return a.level < b.level ? -1 : 0;
		});

		// Prepares manufacturers
		keys = Object.keys(db_manufacturers);
		var manufacturers = [];

		for (var i = 0, length = keys.length; i < length; i++) {
			var name = keys[i];
			if (!name)
				continue;
			var item = db_manufacturers[name];
			manufacturers.push({ name: name, linker: item.linker, count: item.count });
		}

		F.global.categories = categories;
		F.global.manufacturers = manufacturers;
	});
}

function prepare_subcategories(name) {

	var builder_link = [];
	var builder_text = [];
	var category = name.split('/');

	for (var i = 0, length = category.length; i < length; i++) {
		var item = category[i].trim();
		builder_link.push(item.slug());
		builder_text.push(item);
	}

	return { linker: builder_link.join('/'), name: builder_text.join(' / ') };
}

F.on('settings', refresh);
