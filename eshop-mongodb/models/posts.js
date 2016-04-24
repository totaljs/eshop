NEWSCHEMA('Post').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('category', 'String(50)');
	schema.define('template', 'String(30)', true);
	schema.define('language', 'Lower(3)');
	schema.define('name', 'String(80)', true);
	schema.define('perex', 'String(500)');
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

		// Prepares searching
		if (options.search)
			options.search = options.search.keywords(true, true).join(' ');

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);

		var nosql = DB(error);

		nosql.listing('posts', 'posts').make(function(builder) {

			builder.where('isremoved', false);

			// Prepares searching
			if (typeof(options.search) === 'string')
				builder.like('search', options.search, '*');

			// Checks language
			if (options.language)
				builder.where('language', options.language);

			if (options.category)
				builder.where('category_linker', options.category.slug());

			builder.fields('id', 'name', 'category', 'language', 'datecreated', 'linker', 'category_linker', 'pictures', 'perex', 'tags');
			builder.sort('_id', true);
			builder.skip(skip);
			builder.take(take);
		});

		nosql.exec(function(err, response) {

			if (err)
				return callback();

			var data = {};
			data.count = response.posts.count;
			data.items = response.posts.items;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max);

			if (!data.pages)
				data.pages = 1;

			data.page = options.page + 1;
			callback(data);
		});
	});

	// Gets a specific blog
	schema.setGet(function(error, model, options, callback) {

		// options.linker {String}
		// options.id {String}
		// options.language {String}
		// options.category {String}

		if (options.category)
			options.category = options.category.slug();

		var noql = DB(error);

		noql.select('post', 'posts').make(function(builder) {
			builder.where('isremoved', false);
			if (options.category)
				builder.where('category_linker', options.category);
			if (options.linker)
				builder.where('linker', options.linker);
			if (options.id)
				builder.where('id', options.id);
			if (options.language)
				builder.where('language', options.language);
			builder.first();
		});

		noql.validate('post', 'error-404-post');

		noql.exec(function(err, response) {
			if (err)
				return callback();
			callback(response.post);
		});
	});

	// Removes a specific blog
	schema.setRemove(function(error, id, callback) {

		var noql = DB(error);

		noql.update('posts').make(function(builder) {
			builder.set('isremoved', true);
			builder.where('isremoved', false);
			builder.where('id', id);
		});

		noql.exec(SUCCESS(callback), -1);

		// Refreshes internal informations e.g. sitemap
		setTimeout(refresh, 1000);
	});

	// Saves the blog into the database
	schema.setSave(function(error, model, options, callback) {

		// options.id {String}
		// options.url {String}

		var newbie = false;

		if (!model.id) {
			newbie = true;
			model.id = UID();
		}

		model.linker = model.datecreated.format('yyyyMMdd') + '-' + model.name.slug();
		model.isremoved = false;

		var category = F.global.posts.find('name', model.category);
		if (category)
			model.category_linker = category.linker;

		model.search = ((model.name || '') + ' ' + (model.keywords || '') + ' ' + (model.search || '')).keywords(true, true).join(' ');

		var nosql = DB(error);

		nosql.save('posts', newbie, function(builder) {
			builder.set(model);
			if (newbie)
				return;
			builder.set('dateupdated', new Date());
			builder.rem('id');
			builder.rem('datecreated');
			builder.where('id', model.id);
		});

		nosql.exec(function(err, response) {

			// Returns response
			callback(SUCCESS(true));

			if (err)
				return;

			F.emit('posts.save', model);

			// Refreshes internal informations e.g. sitemap
			setTimeout(refresh, 1000);
		});
	});

	// Clears database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var nosql = DB(error);
		nosql.remove('posts');
		nosql.exec(function(err) {
			callback();
			if (err)
				setTimeout(refresh, 1000);
		});
	});
});

// Refreshes internal informations (sitemap and navigations)
function refresh() {

	var categories = {};

	if (F.config.custom.posts) {
		F.config.custom.posts.forEach(function(item) {
			categories[item] = { name: item, linker: item.slug(), count: 0 };
		});
	}

	var nosql = DB();

	nosql.push('posts', 'posts', function(collection, callback) {

		// groupping
		var $group = {};
		$group._id = {};
		$group._id = '$category';
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

		var output = [];

		response.posts.forEach(function(item) {
			var category = categories[item._id];
			if (category)
				category.count += item.count;
		});

		Object.keys(categories).forEach(function(key) {
			output.push({ name: key, linker: key.slug(), count: categories[key] });
		});

		F.global.posts = output;
	});
}

F.on('settings', refresh);