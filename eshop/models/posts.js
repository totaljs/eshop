NEWSCHEMA('Post').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('category', 'String(50)');
	schema.define('template', 'String(30)', true);
	schema.define('language', 'Lower(3)');
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
		var filter = DB('posts').find();

		if (options.search)
			options.search = options.search ? options.search.toSearch().split(' ') : [];

		if (options.category)
			options.category = options.category.slug();

		if (options.language)
			filter.where('language', options.language);

		if (options.category)
			filter.where('category_linker', options.category);

		if (options.search)
			filter.like('search', options.search.keywords(true, true));

		filter.take(take);
		filter.skip(skip);
		filter.fields('id', 'category', 'name', 'language', 'datecreated', 'linker', 'category_linker', 'pictures', 'perex', 'tags');
		filter.sort('datecreated');

		filter.callback(function(err, docs, count) {

			var data = {};

			data.count = count;
			data.items = docs;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max);

			if (data.pages === 0)
				data.pages = 1;

			data.page = options.page + 1;

			// Returns data
			callback(data);
		});
	});

	// Gets a specific post
	schema.setGet(function(error, model, options, callback) {

		// options.linker {String}
		// options.id {String}
		// options.language {String}
		// options.category {String}

		if (options.category)
			options.category = options.category.slug();

		var filter = DB('posts').one();

		if (options.category)
			filter.where('category_linker', options.category);
		if (options.linker)
			filter.where('linker', options.linker);
		if (options.id)
			filter.where('id', options.id);
		if (options.language)
			filter.where('language', options.language);

		filter.callback(callback, 'error-404-post');
	});

	// Removes a specific post
	schema.setRemove(function(error, id, callback) {
		// Updates database file
		DB('posts').remove().where('id', id).callback(callback);

		// Refreshes internal informations e.g. sitemap
		setTimeout(refresh, 1000);
	});

	// Saves the post into the database
	schema.setSave(function(error, model, options, callback) {

		// options.id {String}
		// options.url {String}

		var newbie = false;

		if (!model.id) {
			model.id = UID();
			newbie = true;
		}

		model.linker = model.datecreated.format('yyyyMMdd') + '-' + model.name.slug();

		var category = F.global.posts.find('name', model.category);
		if (category)
			model.category_linker = category.linker;

		model.search = ((model.name || '') + ' ' + (model.keywords || '') + ' ' + (model.search || '')).keywords(true, true);

		var fn = function(err, count) {
			// Returns response
			callback(SUCCESS(true));

			if (!count)
				return;

			F.emit('posts.save', model);

			// Refreshes internal informations e.g. sitemap
			setTimeout(refresh, 1000);

			if (newbie)
				return;

			model.datebackuped = new Date();
			DB('posts_backup').insert(model);
		};

		if (newbie) {
			DB('posts').insert(model).callback(fn);
			return;
		}

		DB('posts').update(model).where('id', model.id).callback(fn);
	});

	// Clears database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		DB('posts').remove().callback(() => setTimeout(refresh, 1000));
		callback(SUCCESS(true));
	});
});

// Refreshes internal informations (sitemap and navigations)
function refresh() {

	var categories = {};

	if (F.config.custom.posts)
		F.config.custom.posts.forEach(item => categories[item] = 0);

	var prepare = function(doc) {
		if (categories[doc.category] !== undefined)
			categories[doc.category] += 1;
	};

	DB('posts').find().prepare(prepare).callback(function() {
		var output = [];
		Object.keys(categories).forEach(key => output.push({ name: key, linker: key.slug(), count: categories[key] }));
		F.global.posts = output;
	});
}

F.on('settings', refresh);