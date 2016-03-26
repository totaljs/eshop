NEWSCHEMA('Post').make(function(schema) {

	schema.define('id', 'String(10)');
	schema.define('category', 'String(50)');
	schema.define('template', 'String(30)', true);
	schema.define('language', 'String(3)');
	schema.define('name', 'String(80)', true);
	schema.define('perex', 'String(500)');
	schema.define('template', 'String(50)');
	schema.define('keywords', 'String(200)');
	schema.define('tags', '[String]');
	schema.define('search', 'String(1000)');
	schema.define('pictures', '[String]')  		// URL addresses for first 5 pictures
	schema.define('body', String);
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
		// options.language {String}
		// options.page {String or Number}
		// options.max {String or Number}

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);

		// Prepares searching
		if (typeof(options.search) === 'string')
			options.search = options.search ? options.search.toSearch().split(' ') : [];

		if (options.search)
			options.search_length = options.search.length;

		if (options.category)
			options.category = options.category.slug();

		// Filter for reading
		var filter = function(doc) {

			if (options.category && doc.category_linker !== options.category)
				return;

			// Checks language
			if (options.language && doc.language !== options.language)
				return;

			// Searchs
			if (options.search_length) {
				if (!doc.search)
					return;
				for (var i = 0; i < options.search_length; i++) {
					if (doc.search.indexOf(options.search[i]) === -1)
						return;
				}
			}

			return { id: doc.id, category: doc.category, name: doc.name, language: doc.language, datecreated: doc.datecreated, linker: doc.linker, category_linker: doc.category_linker, pictures: doc.pictures, perex: doc.perex, tags: doc.tags };
		};

		// Sorting documents
		var sorting = (a, b) => a.name.removeDiacritics().localeCompare(b.name.removeDiacritics());

		DB('posts').sort(filter, sorting, function(err, docs, count) {

			var data = {};

			data.count = count;
			data.items = docs;
			data.pages = Math.floor(count / options.max) + (count % options.max ? 1 : 0);

			if (data.pages === 0)
				data.pages = 1;

			data.page = options.page + 1;

			// Returns data
			callback(data);
		}, skip, take);
	});

	// Gets a specific blog
	schema.setGet(function(error, model, options, callback) {

		// options.linker {String}
		// options.id {String}
		// options.language {String}
		// options.category {String}

		if (options.category)
			options.category = options.category.slug();

		// Filter for reading
		var filter = function(doc) {
			if (options.category && doc.category_linker !== options.category)
				return;
			if (options.linker && doc.linker !== options.linker)
				return;
			if (options.id && doc.id !== options.id)
				return;
			if (options.language && doc.language !== options.language)
				return;
			return doc;
		};

		// Gets specific document
		DB('posts').one(filter, function(err, doc) {

			if (doc)
				return callback(doc);

			error.push('error-404-post');
			callback();
		});
	});

	// Removes a specific blog
	schema.setRemove(function(error, id, callback) {

		// Filters for removing
		var updater = function(doc) {
			if (doc.id !== id)
				return doc;
			return null;
		};

		// Updates database file
		DB('posts').update(updater, callback);

		// Refreshes internal informations e.g. sitemap
		setTimeout(refresh, 1000);
	});

	// Saves the blog into the database
	schema.setSave(function(error, model, options, callback) {

		// options.id {String}
		// options.url {String}

		var count = 0;

		if (!model.id)
			model.id = U.GUID(10);

		model.linker = model.datecreated.format('yyyyMMdd') + '-' + model.name.slug();

		var category = F.global.posts.find('name', model.category);
		if (category)
			model.category_linker = category.linker;

		if (model.datecreated)
			model.datecreated = model.datecreated.format();

		model.search = ((model.name || '') + ' ' + (model.keywords || '') + ' ' + (model.search || '')).toSearch();

		// Removes unnecessary properties (e.g. SchemaBuilder internal properties and methods)
		var clean = model.$clean();

		// Filter for updating
		var updater = function(doc) {
			if (doc.id !== clean.id)
				return doc;
			count++;
			doc.datebackuped = new Date().format();
			DB('posts_backup').insert(doc);
			return clean;
		};

		// Updates database file
		DB('posts').update(updater, function() {

			// Creates record if not exists
			if (count === 0)
				DB('posts').insert(clean);

			// Returns response
			callback(SUCCESS(true));

			F.emit('posts.save', model);

			// Refreshes internal informations e.g. sitemap
			setTimeout(refresh, 1000);
		});
	});

	// Clears database
	schema.addWorkflow('clear', function(error, model, options, callback) {

		DB('posts').clear(function() {
			setTimeout(refresh, 1000);
		});

		callback(SUCCESS(true));
	});
});

// Refreshes internal informations (sitemap and navigations)
function refresh() {

	var categories = {};

	if (F.config.custom.posts) {
		F.config.custom.posts.forEach(function(item) {
			categories[item] = 0;
		});
	}

	var prepare = function(doc) {
		if (categories[doc.category] !== undefined)
			categories[doc.category] += 1;
	};

	DB('posts').all(prepare, function() {

		var output = [];

		Object.keys(categories).forEach(function(key) {
			output.push({ name: key, linker: key.slug(), count: categories[key] });
		});

		F.global.posts = output;
	});
}

F.on('settings', refresh);