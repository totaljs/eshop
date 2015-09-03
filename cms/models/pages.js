// Supported operations:
// "render" renders page
// "render-multiple" renders multiple pages (uses "render")
// "breadcrumb" creates bredcrumb (uses "render")
// "clear" clears database

// Supported workflows
// "create-url"

var Page = NEWSCHEMA('Page');
Page.define('id', String);
Page.define('parent', String);
Page.define('template', String, true);
Page.define('language', 'String(3)');
Page.define('url', String);
Page.define('icon', 'String(20)');
Page.define('navigations', '[String]');
Page.define('widgets', '[String]'); // Widgets lists, contains Array of ID widget
Page.define('settings', '[String]'); // Widget settings (according to widgets array index)
Page.define('tags', '[String]');
Page.define('pictures', '[String]') // URL address to first 5 pictures
Page.define('name', String);
Page.define('perex', 'String(500)');
Page.define('title', String, true);
Page.define('priority', Number);
Page.define('ispartial', Boolean);
Page.define('body', String);
Page.define('datecreated', Date);

// Sets default values
Page.setDefault(function(name) {
	switch (name) {
		case 'datecreated':
			return new Date();
	}
});

// Gets listing
Page.setQuery(function(error, options, callback) {

	// options.search {String}
	// options.navigation {String}
	// options.language {String}
	// options.ispartial {Boolean}
	// options.page {String or Number}
	// options.max {String or Number}

	options.page = U.parseInt(options.page) - 1;
	options.max = U.parseInt(options.max, 20);

	if (options.page < 0)
		options.page = 0;

	var take = U.parseInt(options.max);
	var skip = U.parseInt(options.page * options.max);

	// Prepares searching
	if (options.search)
		options.search = options.search.toSearch();

	// Filter for reading
	var filter = function(doc) {

		// Checks partial content
		if (options.ispartial && doc.ispartial !== options.ispartial)
			return;

		// Checks language
		if (options.language && doc.language !== options.language)
			return;

		// Checks navigations
		if (options.navigation && (!doc.navigations || doc.navigations.indexOf(options.navigation) === -1))
			return;

		// Searchs in "title"
		if (options.search) {
			if (doc.title.toSearch().indexOf(options.search) === -1)
				return;
		}

		return { id: doc.id, name: doc.name, parent: doc.parent, url: doc.url, navigations: doc.navigations, ispartial: doc.ispartial, priority: doc.priority, language: doc.language, icon: doc.icon };
	};

	// Sorting documents
	var sorting = function(a, b) {
		if (new Date(a.datecreated) > new Date(b.datecreated))
			return -1;
		return 1;
	};

	DB('pages').sort(filter, sorting, function(err, docs, count) {
		var data = {};

		data.count = count;
		data.items = docs;

		// Gets page count
		data.pages = Math.floor(count / options.max) + (count % options.max ? 1 : 0);

		if (data.pages === 0)
			data.pages = 1;

		data.page = options.page + 1;

		// Returns data
		callback(data);
	}, skip, take);
});

// Gets a specific page
Page.setGet(function(error, model, options, callback) {

	// options.url {String}
	// options.id {String}
	// options.language {String}

	// Filter for reading
	var filter = function(doc) {
		if (doc.url !== options.url && doc.id !== options.id)
			return;
		if (options.language && doc.language !== options.language)
			return;
		return doc;
	};

	// Gets specific document
	DB('pages').one(filter, function(err, doc) {

		if (doc)
			return callback(doc);

		error.push('error-404-page');
		callback();
	});
});

// Removes a specific page
Page.setRemove(function(error, id, callback) {

	// Filters for removing
	var updater = function(doc) {
		if (doc.id !== id)
			return doc;
		return null;
	};

	// Updates database file
	DB('pages').update(updater, callback);

	// Refreshes internal informations e.g. sitemap
	setTimeout(refresh, 1000);
});

// Saves the page into the database
Page.setSave(function(error, model, options, callback) {

	// options.id {String}
	// options.url {String}

	if (!model.name)
		model.name = model.title;

	var count = 0;

	if (!model.id)
		model.id = U.GUID(10);

	if (model.datecreated)
		model.datecreated = model.datecreated.format();

	if (model.body)
		model.body = U.minifyHTML(model.body.replace(/<br>/g, '<br />'));

	// Sanitizes URL
	if (model.url[0] !== '#' && !model.url.startsWith('http:') && !model.url.startsWith('https:')) {
		model.url = U.path(model.url);
		if (model.url[0] !== '/')
			model.url = '/' + model.url;
	}

	// Removes unnecessary properties (e.g. SchemaBuilder internal properties and methods)
	var clean = model.$clean();

	// Filter for updating
	var updater = function(doc) {
		if (doc.id !== clean.id)
			return doc;
		count++;
		return clean;
	};

	// Updates database file
	DB('pages').update(updater, function() {

		// Creates record if not exists
		if (count === 0)
			DB('pages').insert(clean);

		// Returns response
		callback(SUCCESS(true));

		// Refreshes internal informations e.g. sitemap
		setTimeout(refresh, 1000);
	});
});

Page.addWorkflow('create-url', function(error, model, options, callback) {

	if (!model.parent) {
		model.url = model.title.slug();
		return callback();
	}

	var options = {};
	options.id = model.parent;

	// Gets Parent
	Page.get(options, function(err, response) {

		if (err) {
			model.url = model.title.slug();
			return callback();
		}

		// Gets parent URL and adds current page title
		model.url = response.url + model.title.slug() + '/';
		callback();
	});
});

// Renders page
Page.addOperation('render', function(error, model, options, callback) {

	// options.id {String}
	// options.url {String}

	if (typeof(options) === 'string') {
		var tmp = options;
		options = {};
		options.id = options.url = tmp;
	}

	// Gets the page
	Page.get(options, function(err, response) {

		if (err) {
			error.push(err);
			return callback();
		}

		if (!response) {
			error.push('error-404-page');
			return callback();
		}

		// Loads breadcrumb
		var key = (response.language ? response.language + ':' : '') + response.url;
		Page.operation('breadcrumb', key, function(err, breadcrumb) {

			if (breadcrumb && breadcrumb.length > 0)
				breadcrumb[0].first = true;

			response.breadcrumb = breadcrumb;

			if (response.body)
				response.body = response.body.replace(' id="CMS"', '');

			if (!response.widgets)
				return callback(response);


			var Widget = GETSCHEMA('Widget');

			// Loads widgets
			Widget.workflow('load', null, response.widgets, function(err, widgets) {
				var index = 0;
				response.widgets.wait(function(key, next) {

					var custom = {};
					custom.settings = response.settings[index++];
					custom.page = response;

					if (!widgets[key]) {
						F.error(new Error('Widget # ' + key + ' not found'), 'Page: ' + response.name, response.url);
						return next();
					}

					// Executes transform
					Widget.transform(widgets[key].name, widgets[key], custom, function(err, content) {

						if (err) {
							F.error(err, 'Widget: ' + widgets[key].name + ' (page: ' + response.name + ')', response.url);
							return next();
						}

						response.body = response.body.replace('data-id="' + key + '">', '>' + content);
						next();
					}, true);

				}, function() {

					if (response.language)
						response.body = F.translator(response.language, response.body);

					// cleaner
					response.body = response.body.replace(/(\s)class\=\".*?\"/g, function(text) {

						var is = text[0] === ' ';
						var arr = text.substring(is ? 8 : 7, text.length - 1).split(' ');
						var builder = '';

						for (var i = 0, length = arr.length; i < length; i++) {
							var cls = arr[i];
							if (cls[0] === 'C' && cls[3] === '_' && cls !== 'CMS_hidden')
								continue;
							builder += (builder ? ' ' : '') + cls;
						}

						return builder ? (is ? ' ' : '') + 'class="' + builder + '"' : '';
					});

					callback(response);
				});
			}, true);
		});
	});
});

// Renders multiple page
Page.addOperation('render-multiple', function(error, model, options, callback) {

	// options.id {String Array}
	// options.url {String Array}
	// options.language {String}

	var output = {};
	var pending = [];

	if (options.url instanceof Array) {
		for (var i = 0, length = options.url.length; i < length; i++) {
			(function(id) {
				pending.push(function(next) {
					var custom = {};
					custom.url = id;
					custom.language = options.language;
					Page.operation('render', custom, function(err, response) {
						output[id] = response;
						next();
					});
				});
			})(options.url[i]);
		}
	}

	if (options.id instanceof Array) {
		for (var i = 0, length = options.id.length; i < length; i++) {
			(function(id) {
				pending.push(function(next) {
					var custom = {};
					custom.id = id;
					custom.language = options.language;
					Page.operation('render', custom, function(err, response) {
						output[id] = response;
						next();
					});
				});
			})(options.id[i]);
		}
	}

	pending.async(function() {
		callback(output);
	});
});

// Loads breadcrumb according to URL
Page.addOperation('breadcrumb', function(error, model, url, callback) {

	var arr = [];

	while (true) {
		var item = F.global.sitemap[url];
		if (!item)
			break;
		arr.push(item);
		url = item.parent;
	};

	arr.reverse();
	callback(arr);
});

// Clears database
Page.addWorkflow('clear', function(error, model, options, callback) {

	DB('pages').clear(function() {
		setTimeout(refresh, 1000);
	});

	callback(SUCCESS(true));
});

// Refreshes internal informations (sitemap and navigations)
function refresh() {

	var sitemap = {};
	var helper = {};
	var navigation = {};

	var prepare = function(doc) {

		// Partial content is skipped
		if (doc.ispartial)
			return;

		var key = (doc.language ? doc.language + ':' : '') + doc.url;

		helper[doc.id] = key;
		sitemap[key] = { id: doc.id, url: doc.url, name: doc.name, title: doc.title, parent: doc.parent, language: doc.language, icon: doc.icon };

		if (!doc.navigations)
			return;

		// Loads navigation by menu id
		for (var i = 0, length = doc.navigations.length; i < length; i++) {
			var name = doc.navigations[i];
			if (!navigation[name])
				navigation[name] = [];
			navigation[name].push({ url: doc.url, name: doc.name, title: doc.title, priority: doc.priority, language: doc.language, icon: doc.icon });
		}
	};

	DB('pages').all(prepare, function() {

		// Pairs parents by URL
		Object.keys(sitemap).forEach(function(key) {
			var parent = sitemap[key].parent;
			if (parent)
				sitemap[key].parent = helper[parent];
		});

		// Sorts navigation according to priority
		Object.keys(navigation).forEach(function(name) {
			navigation[name].sort(function(a, b) {
				if (a.priority > b.priority)
					return -1;
				return a.priority < b.priority ? 1 : 0;
			});
		});

		F.global.navigations = navigation;
		F.global.sitemap = sitemap;
	});
}

// Creates Controller.prototype.page()
F.eval(function() {
	Controller.prototype.page = function(url, view, model, cache, partial) {

		var self = this;
		var tv = typeof(view);

		if (tv === 'object') {
			model = view;
			view = undefined;
		} else if (tv === 'boolean') {
			cache = view;
			view = undefined;
			model = null;
		}

		if (typeof(model) === 'boolean') {
			cache = model;
			model = null;
		}

		if (cache === undefined)
			cache = true;

		if (!partial) {
			if (self.language)
				url = self.language + ':' + url;

			if (!F.global.sitemap[url]) {
				self.status = 404;
				self.plain(U.httpStatus(404, true));
				return self;
			}
		}

		self.memorize('cache.' + url, '1 minute', DEBUG || cache !== true, function() {
			GETSCHEMA('Page').operation('render', url, function(err, response) {

				if (err) {
					self.status = 404;
					self.plain(U.httpStatus(404, true));
					return;
				}

				self.repository.cms = true;
				self.repository.render = true;
				self.repository.page = response;

				self.sitemap(response.breadcrumb);
				self.title(response.title);

				if (!view)
					view = '~/cms/' + response.template;

				self.view(view, model);
			});
		});

		return self;
	};
});

// Renders page and stores into the repository
F.middleware('page', function(req, res, next, options, controller) {

	if (!controller) {
		res.throw404();
		return;
	}

	controller.memorize('cache.' + controller.url, '1 minute', DEBUG, function() {
		controller.page(controller.url);
	});
});

setTimeout(refresh, 1000);