var Product = NEWSCHEMA('Product');
Product.define('id', 'String(10)');
Product.define('pictures', '[String]');
Product.define('reference', 'String(20)');
Product.define('category', 'String(50)', true);
Product.define('name', 'String(50)', true);
Product.define('search', 'String(80)', true);
Product.define('price', Number, true);
Product.define('body', String, true);
Product.define('istop', Boolean);
Product.define('linker', 'String(50)');
Product.define('linker_category', 'String(50)');
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

	if (options.page < 0)
		options.page = 0;

	var take = U.parseInt(options.max);
	var skip = U.parseInt(options.page * options.max);

	var sql = DB(error);
	var filter = sql.$; // Creates new SQLBuilder

	filter.where('isremoved', false);

	if (options.category)
		filter.where('linker_category', options.category);
	if (options.search)
		filter.like('search', options.search.toSearch(), '*');
	if (options.id)
		filter.in('id', options.id);
	if (options.skip)
		filter.where('id', '<>', options.skip);

	sql.select('items', 'tbl_product').make(function(builder) {
		builder.replace(filter);
		builder.sort('datecreated', true);
		builder.fields('id', 'pictures', 'name', 'linker', 'linker_category', 'category', 'istop', 'price');
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

		var data = {};
		data.count = response.count;
		data.items = response.items;
		data.pages = Math.ceil(response.count / options.max);

		if (data.pages === 0)
			data.pages = 1;

		data.page = options.page + 1;
		callback(data);
	});
});

// Saves the product into the database
Product.setSave(function(error, model, options, callback) {

	// Default values
	model.linker = ((model.reference ? model.reference + '-' : '') + model.name).slug();
	model.linker_category = model.category.slug();
	model.search = (model.name + ' ' + model.reference).toSearch();

	var sql = DB(error);
	var isNew = model.id ? false : true;
	var clean = model.$clean();

	// Prepares properties
	clean.pictures = clean.pictures.join(',');

	if (isNew)
		model.id = clean.id = U.GUID(10);

	sql.save('item', 'tbl_product', isNew, function(builder, isNew) {
		builder.set(clean);
		if (isNew)
			return;
		builder.rem('id');
		builder.rem('datecreated');
		builder.where('id', clean.id);
	});

	sql.exec(function(err) {
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
	sql.exec(callback, 'item');
});

// Removes product
Product.setRemove(function(error, id, callback) {

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
Product.addWorkflow('clear', function(error, model, options, callback) {
	var sql = DB(error);
	sql.remove('tbl_product');
	sql.exec(function() {
		// Refreshes internal information e.g. categories
		setTimeout(refresh, 1000);
		callback(SUCCESS(true));
	});
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
	var sql = DB(error);

	sql.update('tbl_product').make(function(builder) {
		builder.set('category', options.category_new);
		builder.set('linker_category', options.category_new.slug());
		builder.where('category', options.category_old);
	});

	sql.exec(function() {
		// Refreshes internal information e.g. categories
		setTimeout(refresh, 1000);
		callback(SUCCESS(true));
	});
});

// Imports CSV
Product.addWorkflow('import', function(error, model, filename, callback) {
	require('fs').readFile(filename, function(err, buffer) {

		if (err) {
			error.push(err);
			return callback();
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

	var sql = DB();

	sql.select('categories', 'tbl_product').make(function(builder) {
		builder.where('isremoved', false);
		builder.fields('category as name', 'linker_category as linker', '!COUNT(id) as count');
		builder.group(['category', 'linker_category']);
	});

	sql.exec(function(err, response) {
		F.global.categories = response.categories;
	});
}

setTimeout(refresh, 1000);
