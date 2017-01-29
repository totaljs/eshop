NEWSCHEMA('Post').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('category', 'String(50)');
	schema.define('template', 'String(30)', true);
	schema.define('language', 'Lower(2)');
	schema.define('name', 'String(80)', true);
	schema.define('author', 'String(30)');
	schema.define('perex', 'String(500)');
	schema.define('keywords', 'String(200)');
	schema.define('tags', '[String]');
	schema.define('search', 'String(1000)');
	schema.define('pictures', '[String]');  		// URL addresses for first 5 pictures
	schema.define('body', String);
	schema.define('datecreated', Date);

	// Gets listing
	schema.setQuery(function(error, options, callback) {

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);
		var filter = NOSQL('posts').find();

		if (options.category)
			options.category = options.category.slug();

		options.language && filter.where('language', options.language);
		options.category && filter.where('category_linker', options.category);
		options.search && filter.like('search', options.search.keywords(true, true));

		filter.take(take);
		filter.skip(skip);
		filter.fields('id', 'category', 'name', 'language', 'datecreated', 'linker', 'category_linker', 'pictures', 'perex', 'tags');
		filter.sort('datecreated', true);

		filter.callback(function(err, docs, count) {

			var data = {};
			data.count = count;
			data.items = docs;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max) || 1;
			data.page = options.page + 1;

			callback(data);
		});
	});

	// Gets a specific post
	schema.setGet(function(error, model, options, callback) {

		if (options.category)
			options.category = options.category.slug();

		var filter = NOSQL('posts').one();

		options.category && filter.where('category_linker', options.category);
		options.linker && filter.where('linker', options.linker);
		options.id && filter.where('id', options.id);
		options.language && filter.where('language', options.language);
		options.template && filter.where('template', options.template);

		filter.callback(callback, 'error-404-post');
	});

	// Removes a specific post
	schema.setRemove(function(error, id, callback) {
		NOSQL('posts').remove().where('id', id).callback(callback);
		refresh_cache();
	});

	// Saves the post into the database
	schema.setSave(function(error, model, controller, callback) {

		var newbie = model.id ? false : true;
		var nosql = NOSQL('posts');

		if (newbie) {
			model.id = UID();
			model.admincreated = controller.user.name;
		} else {
			model.dateupdated = F.datetime;
			model.adminupdated = controller.user.name;
		}

		if (!model.datecreated)
			model.datecreated = F.datetime;

		model.linker = model.datecreated.format('yyyyMMdd') + '-' + model.name.slug();

		var category = F.global.posts.find('name', model.category);
		if (category)
			model.category_linker = category.linker;

		model.search = ((model.name || '') + ' ' + (model.keywords || '') + ' ' + (model.search || '')).keywords(true, true).join(' ').max(1000);
		model.body = U.minifyHTML(model.body);

		(newbie ? nosql.insert(model) : nosql.modify(model).where('id', model.id)).callback(function() {

			F.emit('posts.save', model);
			callback(SUCCESS(true));
			refresh_cache();

			model.datebackup = F.datetime;
			NOSQL('posts_backup').insert(model);
		});

	});

	// Clears database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		NOSQL('posts').remove().callback(refresh_cache);
		callback(SUCCESS(true));
	});

	// Stats
	schema.addWorkflow('stats', function(error, model, options, callback) {
		NOSQL('posts').counter.monthly(options.id, callback);
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

	NOSQL('posts').find().prepare(prepare).callback(function() {
		var output = [];
		Object.keys(categories).forEach(key => output.push({ name: key, linker: key.slug(), count: categories[key] }));
		F.global.posts = output;
	});
}

function refresh_cache() {
	setTimeout2('posts', refresh, 1000);
}

F.on('settings', refresh);