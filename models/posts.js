NEWSCHEMA('Post').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('idcategory', 'String(50)');
	schema.define('template', 'String(30)', true);
	schema.define('name', 'String(100)', true);
	schema.define('author', 'String(30)', true);
	schema.define('description', 'String(300)');
	schema.define('summary', 'String(500)');
	schema.define('keywords', 'String(200)');
	schema.define('search', 'String(1000)');
	schema.define('pictures', '[String]');  		// URL addresses for first 5 pictures
	schema.define('body', String);
	schema.define('bodywidgets', '[String(22)]');   // List of all used widgets
	schema.define('ispublished', Boolean);
	schema.define('date', Date);
	schema.define('widgets', '[Object]');           // List of dynamic widgets, contains Array of ID widget
	schema.define('signals', '[String(30)]');

	// Gets listing
	schema.setQuery(function($) {

		var opt = $.options === EMPTYOBJECT ? $.query : $.options;
		var isAdmin = $.controller ? $.controller.name === 'admin' : false;
		var filter = NOSQL('posts').find();

		filter.paginate(opt.page, opt.limit, 70);

		if (isAdmin) {
			opt.category && filter.adminFilter('category', opt, String);
			opt.author && filter.adminFilter('author', opt, String);
			opt.name && filter.adminFilter('name', opt, String);
		} else {
			opt.category && filter.where('linker_category', opt.category);
			opt.author && filter.where('author', opt.author);
			opt.published && filter.where('ispublished', true).where('date', '<=', F.datetime);
			opt.search && filter.like('search', opt.search.keywords(true, true));
			filter.fields('description');
		}

		filter.fields('id', 'idcategory', 'category', 'name', 'datecreated', 'date', 'linker', 'linker_category', 'pictures', 'summary', 'ispublished', 'signals', 'author');

		if (opt.sort)
			filter.adminSort(opt.sort);
		else
			filter.sort('datecreated', true);

		filter.callback((err, docs, count) => $.callback(filter.adminOutput(docs, count)));
	});

	// Gets a specific post
	schema.setGet(function($) {

		var options = $.options;
		var filter = NOSQL('posts').one();

		options.category && filter.where('linker_category', options.category);
		options.linker && filter.where('linker', options.linker);
		options.id && filter.where('id', options.id);
		options.template && filter.where('template', options.template);
		$.id && filter.where('id', $.id);

		filter.callback($.callback, 'error-posts-404');
	});

	schema.addWorkflow('render', function($) {

		var nosql = NOSQL('posts');
		var filter = nosql.one();

		$.id && filter.where('linker', $.id);
		$.options.linker && filter.where('linker', $.options.linker);
		$.options.category && filter.where('linker_category', $.options.category);
		filter.where('ispublished', true);

		filter.callback(function(err, response) {
			if (response) {
				response.body = response.body.CMSrender(response.widgets, function(body) {
					response.body = body;
					$.controller && ($.controller.repository.page = response);
					nosql.counter.hit('all').hit(response.id);
					$.callback(response);
				}, $.controller);
			} else
				$.invalid('error-posts-404');
		});
	});

	// Removes a specific post
	schema.setRemove(function($) {
		var id = $.body.id;
		var user = $.user.name;
		NOSQL('posts').remove().backup(user).log('Remove: ' + id, user).where('id', id).callback(function() {
			$.success();
			refresh_cache();
		});
	});

	// Saves the post into the database
	schema.setSave(function($) {

		var model = $.model.$clean();
		var user = $.user.name;
		var isUpdate = !!model.id;
		var nosql = NOSQL('posts');

		if (isUpdate) {
			model.dateupdated = F.datetime;
			model.adminupdated = user;
		} else {
			model.id = UID();
			model.admincreated = user;
			model.datecreated = F.datetime;
		}

		!model.date && (model.date = F.datetime);
		model.linker = model.date.format('yyyyMMdd') + '-' + model.name.slug();

		var category = F.global.posts.find('id', model.idcategory);
		if (category) {
			model.linker_category = category.linker;
			model.category = category.name;
		}

		model.search = ((model.name || '') + ' ' + (model.keywords || '') + ' ' + (model.search || '')).keywords(true, true).join(' ').max(1000);
		model.body = U.minifyHTML(model.body);

		var db = isUpdate ? nosql.modify(model).where('id', model.id).backup(user).log('Update: ' + model.id, user) : nosql.insert(model).log('Create: ' + model.id, user);

		db.callback(function() {
			ADMIN.notify({ type: 'posts.save', message: model.name });
			EMIT('posts.save', model);
			$.success();
			refresh_cache();
		});

	});

	schema.addWorkflow('toggle', function($) {
		var user = $.user.name;
		var arr = $.options.id ? $.options.id : $.query.id.split(',');
		NOSQL('posts').update(function(doc) {
			doc.ispublished = !doc.ispublished;
			return doc;
		}).log('Toggle: ' + arr.join(', '), user).in('id', arr).callback(function() {
			refresh_cache();
			$.success();
		});
	});

	// Clears database
	schema.addWorkflow('clear', function($) {
		var user = $.user.name;
		NOSQL('posts').remove().backup(user).log('Clear all posts', user).callback(function() {
			$.success();
			refresh_cache();
		});
	});

	// Stats
	schema.addWorkflow('stats', function($) {
		NOSQL('posts').counter.monthly($.id || $.options.id || 'all', $.callback);
	});

});

// Refreshes internal informations (sitemap and navigations)
function refresh() {

	var config = F.global.config;
	var categories = {};
	var prepare = doc => doc.ispublished && categories[doc.category] && (categories[doc.category] += 1);

	config.posts && config.posts.forEach(item => categories[item.id] = 0);

	NOSQL('posts').find().prepare(prepare).callback(function() {
		var output = [];
		Object.keys(categories).forEach(function(key) {
			var category = config.posts.findItem('id', key);
			category && output.push({ id: key, name: category.name, linker: key.slug(), count: categories[key] });
		});
		F.global.posts = output;
		F.cache.removeAll('cachecms');
	});
}

function refresh_cache() {
	setTimeout2('posts', refresh, 1000);
}

ON('settings', refresh);
