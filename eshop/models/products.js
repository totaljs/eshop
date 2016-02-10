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

		var search;
		if (options.search)
			search = options.search.toSearch();

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);

		var filter = function(doc) {

			if (options.category && !doc.linker_category.startsWith(options.category))
				return;
			if (options.manufacturer && doc.manufacturer !== options.manufacturer)
				return;
			if (options.search && doc.name.toSearch().indexOf(search) === -1 && doc.id !== options.search && doc.reference !== options.search)
				return;
			if (options.id && options.id.indexOf(doc.id) === -1)
				return;
			if (options.skip && doc.id === options.skip)
				return;

			// Cleans unnecessary properties.
			delete doc.body;
			return doc;
		};

		var sorting = function(a, b) {

			if (options.homepage) {
				if (a.istop)
					return -1;
				if (b.istop)
					return 1;
			}

			if (new Date(a.datecreated) > new Date(b.datecreated))
				return -1;
			return 1;
		};

		DB('products').sort(filter, sorting, function(err, docs, count) {
			var data = {};
			data.count = count;
			data.items = docs;
			data.pages = Math.floor(count / options.max) + (count % options.max ? 1 : 0);

			if (data.pages === 0)
				data.pages = 1;

			data.page = options.page + 1;
			callback(data);
		}, skip, take);
	});

	// Saves the product into the database
	schema.setSave(function(error, model, options, callback) {

		var count = 0;

		if (!model.id)
			model.id = U.GUID(10);

		model.linker = ((model.reference ? model.reference + '-' : '') + model.name).slug();
		model.linker_manufacturer = model.manufacturer ? model.manufacturer.slug() : '';

		var category = prepare_subcategories(model.category);
		model.category = category.name;
		model.linker_category = category.linker;

		if (model.datecreated)
			model.datecreated = model.datecreated.format();

		// Filter for updating
		var updater = function(doc) {

			if (doc.id !== model.id)
				return doc;

			count++;
			doc.datebackuped = new Date().format();
			DB('products_backup').insert(doc);
			return model.$clean();
		};

		// Updates database file
		DB('products').update(updater, function() {

			// Creates record if not exists
			if (count === 0)
				DB('products').insert(model);

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

		// Filter for reading
		var filter = function(doc) {

			if (options.category && doc.linker_category !== options.category)
				return;

			if (options.linker && doc.linker !== options.linker)
				return;

			if (options.id && doc.id !== options.id)
				return;

			return doc;
		};

		// Gets a specific document from DB
		DB('products').one(filter, function(err, doc) {

			if (doc)
				return callback(doc);

			error.push('error-404-product');
			callback();
		});
	});

	// Removes product
	schema.setRemove(function(error, id, callback) {

		// Filter for removing
		var updater = function(doc) {
			if (doc.id !== id)
				return doc;
			return null;
		};

		// Updates database file
		DB('products').update(updater, callback);

		// Refreshes internal information e.g. categories
		setTimeout(refresh, 1000);
	});

	// Clears product database
	schema.addWorkflow('clear', function(error, model, options, callback) {

		DB('products').clear(function() {
			// Refreshes internal information e.g. categories
			setTimeout(refresh, 1000);
		});

		callback(SUCCESS(true));
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
		var category_old = prepare_subcategories(options.category_old);
		var category_new = prepare_subcategories(options.category_new);

		var update = function(doc) {

			if (doc.category.startsWith(category_old.name)) {
				doc.category = doc.category.replace(category_old.name, category_new.name);
				doc.linker_category = doc.linker_category.replace(category_old.linker, category_new.linker);
				is = true;
			}

			return doc;
		};

		DB('products').update(update, function() {
			// Refreshes internal information e.g. categories
			if (is)
				setTimeout(refresh, 1000);
			callback(SUCCESS(true));
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
				obj[key.replace('product.', '')] = xml[key];
			});

			products.push(obj);
		}));

		CLEANUP(stream, function() {

			var Fs = require('fs');
			var id;

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
							Fs.unlink(filename, NOOP);
							Fs.readFile(filename, function(err, data) {
								if (!err)
									id.push(DB('files').binary.insert(U.getName(picture), 'image/jpeg', data));
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

		var filter = function(doc) {
			return doc;
		}

		DB('products').all(filter, function(err, docs, count) {

			var xml = [];

			for (var i = 0, length = docs.length; i < length; i++) {
				var doc = docs[i];
				var keys = Object.keys(doc);
				var line = '<product>';

				keys.forEach(function(key) {

					if (key === 'id' || key === 'linker_category' || key === 'linker_manufacturer' || key === 'search' || key === 'linker')
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

	var db_categories = {};
	var db_manufacturers = {};

	var prepare = function(doc) {
		if (db_categories[doc.category] === undefined)
			db_categories[doc.category] = { count: 1, linker: doc.linker_category, path: doc.linker_category.split('/'), names: doc.category.split('/').trim() };
		else
			db_categories[doc.category].count++;

		if (!doc.manufacturer)
			return;

		if (db_manufacturers[doc.manufacturer] === undefined)
			db_manufacturers[doc.manufacturer] = { count: 1, linker: doc.linker_manufacturer };
		else
			db_manufacturers[doc.manufacturer].count++;
	};

	DB('products').all(prepare, function() {

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
		var manufacturers = new Array(keys.length);
		for (var i = 0, length = keys.length; i < length; i++) {
			var name = keys[i];
			var item = db_manufacturers[name];
			manufacturers[i] = { name: name, linker: item.linker, count: item.count };
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

setTimeout(refresh, 1000);
