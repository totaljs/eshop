var Fs = require('fs');
var Product = NEWSCHEMA('Product');
Product.define('id', String);
Product.define('pictures', '[String]');
Product.define('reference', String);
Product.define('category', String, true);
Product.define('name', String, true);
Product.define('price', Number, true);
Product.define('body', String, true);
Product.define('istop', Boolean);
Product.define('linker', String);
Product.define('linker_category', String);
Product.define('datecreated', Date);

// Sets default values
Product.setDefault(function(name) {
	switch (name) {
		case 'datecreated':
			return new Date();
	}
});

// Gets listing
Product.setQuery(function(error, options, callback) {

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

		if (options.category && doc.linker_category !== options.category)
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
Product.setSave(function(error, model, options, callback) {

	var count = 0;

	// Default values

	if (!model.id)
		model.id = U.GUID(10);

	model.linker = ((model.reference ? model.reference + '-' : '') + model.name).slug();
	model.linker_category = model.category.slug();

	if (model.datecreated)
		model.datecreated = model.datecreated.format();

	// Filter for updating
	var updater = function(doc) {

		if (doc.id !== model.id)
			return doc;

		count++;
		return model;
	};

	// Updates database file
	DB('products').update(updater, function() {

		// Creates record if not exists
		if (count === 0)
			DB('products').insert(model);

		// Returns response
		callback(SUCCESS(true));

		// Refreshes internal information e.g. categories
		setTimeout(refresh, 1000);
	});
});

// Gets a specific product
Product.setGet(function(error, model, options, callback) {

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
Product.setRemove(function(error, id, callback) {

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
Product.addWorkflow('clear', function(error, model, options, callback) {

	DB('products').clear(function() {
		// Refreshes internal information e.g. categories
		setTimeout(refresh, 1000);
	});

	callback(SUCCESS(true));
});

// Refreshes categories
Product.addWorkflow('refresh', function(error, model, options, callback) {
	refresh();
	callback(SUCCESS(true));
});

// Replaces category
Product.addWorkflow('category', function(error, model, options, callback) {

	// options.category_old
	// options.category_new

	var is = false;

	var update = function(doc) {

		if (doc.category === options.category_old) {
			doc.category = options.category_new;
			doc.linker_category = doc.category.slug();
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
Product.addWorkflow('import', function(error, model, filename, callback) {
	Fs.readFile(filename, function(err, buffer) {

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

// Refreshes internal information (categories)
function refresh() {

	var categories = {};

	var prepare = function(doc) {
		if (categories[doc.category] === undefined)
			categories[doc.category] = 1;
		else
			categories[doc.category]++;
	};

	DB('products').all(prepare, function() {

		var keys = Object.keys(categories);
		var length = keys.length;
		var arr = new Array(length);

		for (var i = 0; i < length; i++) {
			var name = keys[i];
			var linker = name.slug();
			arr[i] = { name: name, linker: linker, count: categories[name] };
		}

		F.global.categories = arr;
	});
}

setTimeout(refresh, 1000);
