"use strict";

NEWSCHEMA('Post').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('category', 'String(50)');
	schema.define('template', 'String(30)', true);
	schema.define('language', 'Lower(2)');
	schema.define('name', 'String(80)', true);
	schema.define('author', 'String(30)');
	schema.define('perex', 'String(500)');
	schema.define('template', 'String(50)');
	schema.define('keywords', 'String(200)');
	schema.define('tags', '[String]');
	schema.define('search', 'String(1000)');
	schema.define('pictures', '[String]');  		// URL addresses for first 5 pictures
	schema.define('body', String);
	schema.define('datecreated', Date);

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

		var nosql = DB(error);

		nosql.listing('posts', 'posts').make(function(builder) {

			builder.where('isremoved', false);

			options.search && builder.in('search', options.search.keywords(true, true));
			options.language && builder.where('language', options.language);
			options.category && builder.where('category_linker', options.category.slug());
			options.template && builder.where('template', options.template);

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
			data.pages = Math.ceil(data.count / options.max) || 1;
			data.page = options.page + 1;

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

		var noql = DB(error);

		noql.select('post', 'posts').make(function(builder) {
			builder.where('isremoved', false);
			options.category && builder.where('category_linker', options.category);
			options.linker && builder.where('linker', options.linker);
			options.id && builder.where('id', options.id);
			options.language && builder.where('language', options.language);
			builder.first();
		});

		noql.validate('post', 'error-404-post');

		noql.exec(function(err, response) {
			callback(response.post);
	});
	});

	// Removes a specific post
	schema.setRemove(function(error, id, callback) {

		var noql = DB(error);

		noql.update('posts').make(function(builder) {
			builder.set('isremoved', true);
			builder.where('isremoved', false);
			builder.where('id', id);
	});

		noql.exec(SUCCESS(callback), -1);
		setTimeout2('posts', refresh, 1000);
	});

	// Saves the blog into the database
	schema.setSave(function(error, model, controller, callback) {

		// options.id {String}
		// options.url {String}

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

		nosql.save('posts', newbie, function(builder) {
			builder.set(model);
			if (newbie)
				return;
			builder.rem('id');
			builder.rem('datecreated');
			builder.where('id', model.id);
		});

		nosql.exec(function(err, response) {

			callback(SUCCESS(true));
			refresh_cache();

			if (err)
				return;

			F.emit('posts.save', model);
			setTimeout2('posts', refresh, 1000);
                });
	});
    });

	// Clears database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var nosql = DB(error);
		nosql.remove('posts');
		nosql.exec(function(err) {
		callback(SUCCESS(true));
			!err && setTimeout2('posts', refresh, 1000);
                });

	// Stats
	schema.addWorkflow('stats', function(error, model, options, callback) {
		NOSQL('posts').counter.monthly(options.id, callback);
	});
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

		if (err) {
			F.error(err);
			return;
		}

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

function refresh_cache() {
	setTimeout2('posts', refresh, 1000);
}

F.on('settings', refresh);