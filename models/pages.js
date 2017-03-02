// ====== Supported operations:
// "render"            - renders page
// "render-multiple"   - renders multiple pages (uses "render")
// "breadcrumb"        - creates bredcrumb (uses "render")
// "clear"             - clears database

// ====== Supported workflows:
// "url"               - creates URL

const REGEXP_HTML_CLASS = /(\s)class\=\".*?\"/g;

NEWSCHEMA('Page').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('body', String);                      // RAW html
	schema.define('icon', 'String(20)');                // Font-Awesome icon name
	schema.define('ispartial', Boolean);                // Is only partial page (the page will be shown in another page)
	schema.define('keywords', 'String(200)');           // Meta keywords
	schema.define('description', 'String(200)');        // Meta description
	schema.define('language', 'Lower(2)');              // For which language is the page targeted?
	schema.define('name', 'String(50)');                // Name in manager
	schema.define('navigations', '[String]');           // In which navigation will be the page?
	schema.define('parent', 'String(20)');              // Parent page for breadcrumb
	schema.define('partial', '[String]');               // A partial content
	schema.define('perex', 'String(500)');              // Short page description generated according to the "CMS_perex" class in CMS editor
	schema.define('pictures', '[String]')               // URL addresses for first 5 pictures
	schema.define('priority', Number);                  // Sorting in navigation
	schema.define('search', 'String(1000)');            // Search pharses
	schema.define('settings', '[String]');              // Widget settings (according to widgets array index)
	schema.define('template', 'String(30)');            // Render template views/cms/*.html
	schema.define('title', 'String(100)', true);        // Meta title
	schema.define('url', 'String(200)');                // URL (can be realive for showing content or absolute for redirects)
	schema.define('widgets', '[String]');               // Widgets lists, contains Array of ID widget

	// Gets listing
	schema.setQuery(function(error, options, callback) {

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);

		// Prepares searching
		if (options.search)
			options.search = options.search.keywords(true, true);

		var filter = NOSQL('pages').find();

		options.ispartial && filter.where('ispartial', options.ispartial);
		options.language && filter.where('language', options.language);
		options.navigation && filter.in('navigations', options.navigation);
		options.search && filter.like('search', options.search);
		options.template && filter.where('template', options.template);

		filter.take(take);
		filter.skip(skip);
		filter.fields('id', 'name', 'parent', 'url', 'navigations', 'ispartial', 'priority', 'language', 'icon');
		filter.sort('name');

		filter.callback(function(err, docs, count) {

			var data = {};
			data.count = count;
			data.items = docs;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max) || 1;
			data.page = options.page + 1;

			// Returns data
			callback(data);
		});
	});

	// Gets a specific page
	schema.setGet(function(error, model, options, callback) {

		var filter = NOSQL('pages').one();

		options.url && filter.where('url', options.url);
		options.id && filter.where('id', options.id);
		options.language && filter.where('language', options.language);

		filter.callback(function(err, doc) {
			!doc && error.push('error-404-page');
			callback(doc);
		});
	});

	// Removes a specific page
	schema.setRemove(function(error, id, callback) {
		var db = NOSQL('pages');
		db.remove().where('id', id).callback(callback);
		db.counter.remove(id);
		setTimeout2('pages', refresh, 1000);
	});

	// Saves the page into the database
	schema.setSave(function(error, model, controller, callback) {

		if (!model.name)
			model.name = model.title;

		var newbie = model.id ? false : true;
		var nosql = NOSQL('pages');

		if (newbie) {
			model.id = UID();
			model.datecreated = F.datetime;
			model.admincreated = controller.user.name;
		} else {
			model.dateupdated = F.datetime;
			model.adminupdated = controller.user.name;
		}

		model.body = U.minifyHTML(model.body);
		model.search = ((model.title || '') + ' ' + (model.keywords || '') + ' ' + model.search).keywords(true, true).join(' ').max(1000);

		// Sanitizes URL
		if (model.url[0] !== '#' && !model.url.startsWith('http:') && !model.url.startsWith('https:')) {
			model.url = U.path(model.url);
			if (model.url[0] !== '/')
				model.url = '/' + model.url;
		}

		(newbie ? nosql.insert(model) : nosql.modify(model).where('id', model.id)).callback(function(err, count) {
			F.emit('pages.save', model);
			setTimeout2('pages', refresh, 1000);
			callback(SUCCESS(true));
			model.datebackup = F.datetime;
			NOSQL('pages_backup').insert(model);
		});
	});

	schema.addWorkflow('url', function(error, model, options, callback) {

		if (!model.parent) {
			model.url = model.title.slug();
			return callback();
		}

		// Gets parent URL
		schema.get({ id: model.parent }, function(err, response) {

			if (err)
				model.url = model.title.slug();
			else
				model.url = response.url + model.title.slug() + '/';

			callback();
		});
	});

	// Stats
	schema.addWorkflow('stats', function(error, model, options, callback) {
		NOSQL('pages').counter.monthly(options.id, callback);
	});

	// Renders page
	schema.addOperation('render', function(error, model, options, callback) {

		// options.id {String}
		// options.url {String}

		if (typeof(options) === 'string') {
			var tmp = options;
			options = {};
			options.id = options.url = tmp;
		}

		// Gets the page
		schema.get(options, function(err, response) {

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
			schema.operation('breadcrumb', key, function(err, breadcrumb) {

				if (breadcrumb && breadcrumb.length)
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
						// INIT WIDGET
						var custom = {};
						custom.settings = response.settings[index++];
						custom.page = response;
						custom.controller = options.controller;

						if (!widgets[key]) {
							F.error(new Error('Widget # ' + key + ' not found'), 'Page: ' + response.name, response.url);
							return next();
						}

						// Executes transform
						Widget.transform(key, widgets[key], custom, function(err, content) {

							if (err)
								F.error(err, 'Widget: ' + widgets[key].name + ' - ' + key + ' (page: ' + response.name + ')', response.url);
							else
								response.body = response.body.replace('data-id="' + key + '">', '>' + content);

							next();
						}, true);

					}, function() {

						// DONE
						if (response.language)
							response.body = F.translator(response.language, response.body);

						response.body = response.body.tidyCMS();

						if (response.partial && response.partial.length) {
							schema.operation2('render-multiple', { id: response.partial }, function(err, partial) {

								if (err) {
									error.push(err);
									return callback();
								}

								var arr = [];
								var keys = Object.keys(partial);
								for (var i = 0, length = keys.length; i < length; i++)
									arr.push(partial[keys[i]]);
								response.partial = arr;
								callback(response);
							});
							return;
						}

						callback(response);
					});
				}, true);
			});
		});
	});

	// Renders multiple page
	schema.addOperation('render-multiple', function(error, model, options, callback) {

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
						schema.operation('render', custom, function(err, response) {
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
						schema.operation('render', custom, function(err, response) {
							output[id] = response;
							next();
						});
					});
				})(options.id[i]);
			}
		}

		pending.async(() => callback(output));
	});

	// Loads breadcrumb according to URL
	schema.addOperation('breadcrumb', function(error, model, url, callback) {

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
	schema.addWorkflow('clear', function(error, model, options, callback) {
		NOSQL('pages').remove().callback(() => setTimeout(refresh, 1000));
		callback(SUCCESS(true));
	});
});

// Refreshes internal informations (sitemap and navigations)
function refresh() {

	var sitemap = {};
	var helper = {};
	var navigation = {};
	var partial = [];

	var prepare = function(doc) {

		// A partial content is skipped from the sitemap
		if (doc.ispartial) {
			partial.push({ id: doc.id, url: doc.url, name: doc.name, title: doc.title, language: doc.language, icon: doc.icon, tags: doc.tags, priority: doc.priority });
			return;
		}

		var key = (doc.language ? doc.language + ':' : '') + doc.url;

		helper[doc.id] = key;
		sitemap[key] = { id: doc.id, url: doc.url, name: doc.name, title: doc.title, parent: doc.parent, language: doc.language, icon: doc.icon, tags: doc.tags };

		if (!doc.navigations)
			return;

		// Loads navigation by menu id
		for (var i = 0, length = doc.navigations.length; i < length; i++) {
			var name = doc.navigations[i];
			if (!navigation[name])
				navigation[name] = [];
			navigation[name].push({ url: doc.url, name: doc.name, title: doc.title, priority: doc.priority, language: doc.language, icon: doc.icon, tags: doc.tags, external: doc.url.match(/(https|http)\:\/\//) != null });
		}
	};

	NOSQL('pages').find().prepare(prepare).callback(function() {

		// Pairs parents by URL
		Object.keys(sitemap).forEach(function(key) {
			var parent = sitemap[key].parent;
			if (parent)
				sitemap[key].parent = helper[parent];
		});

		// Sorts navigation according to priority
		Object.keys(navigation).forEach((name) => navigation[name].orderBy('priority', false));
		partial.orderBy('priority', false);

		F.global.navigations = navigation;
		F.global.sitemap = sitemap;
		F.global.partial = partial;
		F.cache.removeAll('cache.');
	});
}

// Creates Controller.prototype.page()
F.eval(function() {

	Controller.prototype.render = function(url, callback, view, model, cache) {
		var self = this;
		var key = (self.language ? self.language + ':' : '') + url;
		var page = F.global.sitemap[key];

		if (page)
			self.page(self.url, callback, view, model, cache);
		else
			self.throw404();

		return self;
	};

	Controller.prototype.partial = function(url, callback) {
		var self = this;
		var page = F.global.partial.find(n => n.url === url && n.language === (self.language || ''));

		if (page)
			GETSCHEMA('Page').operation('render', { id: page.id }, callback);
		else
			callback(new ErrorBuilder().push('error-404-page'));

		return self;
	};

	Controller.prototype.page = function(url, callback, view, model, cache, partial) {
		var self = this;

		if (typeof(callback) !== 'function') {
			partial = cache;
			cache = model;
			model = view;
			view = callback;
			callback = undefined;
		}

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

		self.memorize('cache.' + url, '3 minute', cache !== true, function() {

			var options = {};

			options.language = self.language;
			options.url = self.url;
			options.controller = self;

			GETSCHEMA('Page').operation('render', options, function(err, response) {

				if (err) {
					self.status = 404;
					self.plain(U.httpStatus(404, true));
					return;
				}

				self.repository.cms = true;
				self.repository.render = true;
				self.repository.page = response;

				NOSQL('pages').counter.hit(self.repository.page.id);

				self.sitemap(response.breadcrumb);
				self.meta(response.title, response.description, response.keywords);

				F.emit('pages.render', response, self);
				callback && callback.call(self, response);

				self.view(view || '~/cms/' + response.template, model);
			});

		}, NOOP, () => NOSQL('pages').counter.hit(self.repository.page.id));
		return self;
	};
});

// Cleans CMS markup
String.prototype.tidyCMS = function() {

	var body = this;
	var beg;
	var end;
	var index = 0;
	var count = 0;
	var b = ' data-themes="';
	var c = 'CMS_unwrap';
	var tag;
	var tagend;
	var tmp = 0;

	body = U.minifyHTML(body).replace(/\sclass=\"CMS_template CMS_remove\"/gi, '');

	while (true) {
		beg = body.indexOf(b, beg);
		if (beg === -1)
			break;
		index = body.indexOf('"', beg + b.length);
		if (index === -1)
			break;
		body = body.substring(0, beg) + body.substring(index + 1);
	}

	while (true) {
		beg = body.indexOf(c, beg);
		if (beg === -1)
			break;

		index = beg;
		while (true) {
			if (body[--index] === '<' || index <= 0)
				break;
		}

		if (index === beg || index <= 0)
			return;

		tag = body.substring(index + 1, body.indexOf('>', index + 1));
		end = index + tag.length + 2;
		tag = tag.substring(0, tag.indexOf(' '));
		tagend = '</' + tag;
		tag = '<' + tag;
		count = 0;
		beg = index;
		index = end;

		while (true) {
			var str = body.substring(index, index + tagend.length);

			if (index >= body.length) {
				beg = body.length;
				break;
			}

			if (str === tagend) {

				if (count) {
					count--;
					index++;
					continue;
				}

				body = body.substring(0, beg) + body.substring(end, index) + body.substring(index + 1 + tagend.length);
				break;
			}

			if (str.substring(0, tag.length) === tag)
				count++;

			index++;
		}
	}

	return body.replace(REGEXP_HTML_CLASS, function(text) {

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
};

F.on('settings', refresh);