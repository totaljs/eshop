NEWSCHEMA('Product').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('pictures', '[String]');
	schema.define('reference', 'String(20)');
	schema.define('category', 'String(300)', true);
	schema.define('manufacturer', 'String(50)');
	schema.define('name', 'String(50)', true);
	schema.define('price', Number, true);
	schema.define('body', String, true);
	schema.define('istop', Boolean);
	schema.define('linker', 'String(50)');
	schema.define('linker_category', 'String(300)');
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

		var sql = DB(error);
		var filter = sql.$; // Creates new SQLBuilder

		filter.where('isremoved', false);

		if (options.category) {
			filter.scope(function() {
				filter.where('linker_category', options.category);
				filter.or();
				// + all subcategories
				filter.query('SUBSTRING(linker_category, 0, ' + (options.category.length + 2) + ')=' + filter.escape(options.category + '/'));
			});
		}

		if (options.manufacturer)
			filter.where('linker_manufacturer', options.manufacturer);

		if (options.search)
			filter.like('search', options.search.keywords(true, true).join(' '), '*');
		if (options.id)
			filter.in('id', options.id);
		if (options.skip)
			filter.where('id', '<>', options.skip);

		sql.select('items', 'tbl_product').make(function(builder) {
			builder.replace(filter);
			builder.sort('datecreated', true);
			builder.fields('id', 'pictures', 'name', 'linker', 'linker_category', 'category', 'istop', 'price', 'manufacturer');
			builder.skip(skip);
			builder.take(take);

			if (options.homepage)
				builder.sort('istop', true);
		});

		sql.count('count', 'tbl_product', 'id').make(function(builder) {
			builder.replace(filter);
		});

		sql.exec(function(err, response) {

			if (err)
				return callback();

			for (var i = 0, length = response.items.length; i < length; i++) {
				if (response.items[i].pictures)
					response.items[i].pictures = response.items[i].pictures.split(',');
				else
					response.items[i].pictures = new Array(0);
			}

			var data = {};
			data.count = response.count;
			data.items = response.items;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max);

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

		// Default values
		model.linker = ((model.reference ? model.reference + '-' : '') + model.name).slug().max(300);
		model.search = (model.name + ' ' + model.reference).keywords(true, true).join(' ').max(80);
		model.linker_manufacturer = model.manufacturer ? model.manufacturer.slug().max(50) : '';

		var category = prepare_subcategories(model.category);

		model.linker_category = category.linker;
		model.category = category.name;

		var sql = DB(error);
		var isNew = model.id ? false : true;
		var clean = model.$clean();

		// Prepares properties
		clean.pictures = clean.pictures.join(',');

		if (isNew)
			model.id = clean.id = UID();

		sql.save('item', 'tbl_product', isNew, function(builder, isNew) {
			builder.set(clean);
			if (isNew)
				return;
			builder.set('dateupdated', new Date());
			builder.rem('id');
			builder.rem('datecreated');
			builder.where('id', clean.id);
		});

		sql.exec(function(err) {

			// Returns response
			callback(SUCCESS(true));

			if (err)
				return;

			F.emit('products.save', model);

			// Refreshes internal information e.g. categories
			if (options && options.importing)
				return;

			setTimeout(refresh, 1000);
		});
	});

	// Gets a specific product
	schema.setGet(function(error, model, options, callback) {

		// options.category {String}
		// options.linker {String}
		// options.id {String}

		var sql = DB(error);

		sql.select('item', 'tbl_product').make(function(builder) {
			builder.where('isremoved', false);
			if (options.category)
				builder.where('linker_category', options.category);
			if (options.linker)
				builder.where('linker', options.linker);
			if (options.id)
				builder.where('id', options.id);
			builder.first();
		});

		sql.validate('item', 'error-404-product');
		sql.exec(function(err, response) {
			if (err)
				return callback();

			// Parse pictures as array
			response.item.pictures = response.item.pictures.split(',');
			callback(response.item);
		});
	});

	// Removes product
	schema.setRemove(function(error, id, callback) {

		var sql = DB(error);

		sql.update('item', 'tbl_product').make(function(builder) {
			builder.where('id', id);
			builder.set('isremoved', true);
		});

		sql.exec(function() {
			// Refreshes internal information e.g. categories
			setTimeout(refresh, 1000);
			callback(SUCCESS(true));
		});
	});

	// Clears product database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var sql = DB(error);
		sql.remove('tbl_product');
		sql.exec(function() {
			// Refreshes internal information e.g. categories
			setTimeout(refresh, 1000);
			callback(SUCCESS(true));
		});
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

		var is = false;
		var sql = DB(error);
		var category_old = prepare_subcategories(options.category_old);
		var category_new = prepare_subcategories(options.category_new);

		sql.select('product', 'tbl_product').make(function(builder) {
			builder.where('isremoved', false);

			builder.scope(function() {
				builder.query('SUBSTRING(linker_category, 0, ' + (category_old.linker.length + 2) + ')=' + builder.escape(category_old.linker + '/'));
				builder.or();
				builder.query('linker_category=' + builder.escape(category_old.linker));
			});

			builder.group('linker_category', 'category');
			builder.fields('linker_category', 'category');
		});

		sql.prepare(function(error, response, resume) {
			for (var i = 0, length = response.product.length; i < length; i++) {
				var product = response.product[i];
				sql.update('tbl_product').make(function(builder) {
					builder.set('linker_category', product.linker_category.replace(category_old.linker, category_new.linker));
					builder.set('category', product.category.replace(category_old.name, category_new.name));
					builder.where('linker_category', product.linker_category);
				});
			}
			resume();
		});

		sql.exec(function() {
			// Refreshes internal information e.g. categories
			setTimeout(refresh, 1000);
			callback(SUCCESS(true));
		});
	});

	// Imports CSV
	schema.addWorkflow('import.csv', function(error, model, filename, callback) {

		var sql = DB(error);

		sql.select('products').make(function(builder) {
			builder.where('isremoved', false);
			builder.where('reference', '!=', '');
			builder.fields('id', 'reference');
		});

		sql.exec(function(err, database) {

			if (err)
				return callback();

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
				var options = { importing: true };

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

					if (!product.id && product.reference) {
						var tmp = database.findItem('reference', product.reference);
						if (tmp)
							product.id = tmp.id;
					}

					schema.make(product, function(err, model) {
						if (err)
							return next();
						count++;
						model.$save(options, next);
					});
				}, function() {

					if (count)
						refresh();

					// Done, returns response
					callback(SUCCESS(count > 0));
				});
			});
		}, 0);
	});

	// Imports XML
	schema.addWorkflow('import.xml', function(error, model, filename, callback) {

		var sql = DB(error);

		sql.select('products').make(function(builder) {
			builder.where('isremoved', false);
			builder.where('reference', '!=', '');
			builder.fields('id', 'reference');
		});

		sql.exec(function(err, database) {

			if (err)
				return callback();

			var products = [];
			var count = 0;
			var stream = require('fs').createReadStream(filename);
			var options = { importing: true };

			stream.on('data', U.streamer('<product>', '</product>', function(value) {

				var index = value.indexOf('<product>');
				if (index === -1)
					return;

				value = value.substring(index).trim();
				xml = value.parseXML();

				var obj = {};
				Object.keys(xml).forEach(key => obj[key.replace('product.', '')] = xml[key]);
				products.push(obj);
			}));

			CLEANUP(stream, function() {

				var sql = DB();
				products.wait(function(product, next) {

					var fn = function() {

						if (!product.id && product.reference) {
							var tmp = database.findItem('reference', product.reference);
							if (tmp)
								product.id = tmp.id;
						}

						schema.make(product, function(err, model) {
							if (err)
								return next();
							count++;
							model.$save(options, next);
						});
					};

					if (!product.pictures)
						return fn();

					id = [];

					product.pictures.split(',').wait(function(picture, next) {
						sql.writeStream(function(writer) {
							U.download(picture.trim(), ['get', 'dnscache'], function(err, response) {
								response.pipe(writer);
							});
						}, function(err, oid) {
							if (err)
								return next();

							var tmp = oid.toString();
							var count = 0;

							// Simple prevention for DDOS querying
							for (var i = 0, length = tmp.length; i < length; i++)
								count += tmp.charCodeAt(i);

							id.push(oid + 'x' + count);
							setTimeout(next, 100);
						});

					}, function() {
						product.pictures = id;
						fn();
					}, 3); // 3 threads

				}, function() {

					if (count)
						refresh();

					// Done, returns response
					callback(SUCCESS(count > 0));
				});
			});
		}, 0);
	});

	schema.addWorkflow('export.xml', function(error, model, options, callback) {
		var sql = DB();
		sql.select('products', 'tbl_product').where('isremoved', false);
		sql.exec(function(err, response) {

			var xml = [];
			var docs = response.products;

			for (var i = 0, length = docs.length; i < length; i++) {
				var doc = docs[i];
				var keys = Object.keys(doc);
				var line = '<product>';

				keys.forEach(function(key) {

					if (key === 'linker' || key === 'linker_category' || key === 'linker_manufacturer' || key === 'search' || key === 'isremoved')
						return;

					var val = doc[key];
					var tmp;

					if (val === null)
						val = '';

					if (key === 'pictures') {

						tmp = '';

						val.split(',').forEach(function(id) {
							if (id)
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

// Refreshes internal information (categories)
function refresh() {

	var sql = DB();

	sql.select('categories', 'tbl_product').make(function(builder) {
		builder.where('isremoved', false);
		builder.where('linker_category', '<>', '');
		builder.fields('category as name', 'linker_category as linker', '!COUNT(id) as count --> number');
		builder.group(['category', 'linker_category']);
	});

	sql.select('manufacturers', 'tbl_product').make(function(builder) {
		builder.where('isremoved', false);
		builder.where('linker_manufacturer', '<>', '');
		builder.fields('manufacturer as name', 'linker_manufacturer as linker', '!COUNT(id) as count --> number');
		builder.group(['manufacturer', 'linker_manufacturer']);
		builder.sort('manufacturer');
	});

	sql.exec(function(err, response) {

		// Prepares categories with their subcategories
		var categories = [];
		var categories_filter = {};

		for (var i = 0, length = response.categories.length; i < length; i++) {

			var item = response.categories[i];
			item.path = item.linker.split('/');
			item.names = item.name.split('/').trim();

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

		F.global.categories = categories;
		F.global.manufacturers = response.manufacturers;
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
