const REGEXP_HTML_CLASS = /(\s)class=".*?"/g;
const REGEXP_HTML_ATTR = /(\s)data-cms-id="[a-z0-9]+"|data-cms-widget="[a-z0-9]+"/g;
const REGEXP_HTML_DIV = /<div\s>/g;
const REGEXP_GLOBAL = /\$[0-9a-z-_]+/gi;
const Fs = require('fs');

var loaded = false;

F.global.pages = [];
F.global.sitemap = [];
F.global.variables = {};
F.global.redirects = {};

NEWSCHEMA('Page').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('body', String);                      // RAW html
	schema.define('bodywidgets', '[String(22)]');       // List of all used widgets
	schema.define('icon', 'String(20)');                // Font-Awesome icon name
	schema.define('ispartial', Boolean);                // Is only partial page (the page will be shown in another page)
	schema.define('keywords', 'String(200)');           // Meta keywords
	schema.define('description', 'String(200)');        // Meta description
	schema.define('name', 'String(50)', true);          // Name in admin
	schema.define('parent', 'UID');                     // Parent page for breadcrumb
	schema.define('partial', '[UID]');                  // A partial content
	schema.define('summary', 'String(500)');            // Short page description generated according to the "CMS_summary" class in CMS editor
	schema.define('pictures', '[String]');              // URL addresses for first 5 pictures
	schema.define('search', 'String(1000)');            // Search pharses
	schema.define('template', 'String(30)');            // Render template views/cms/*.html
	schema.define('title', 'String(100)');              // Meta title
	schema.define('url', 'String(200)');                // URL (can be realive for showing content or absolute for redirects)
	schema.define('oldurl', 'String(200)');             // Temporary: old URL
	schema.define('widgets', '[Object]');               // List of dynamic widgets, contains Array of ID widget
	schema.define('signals', '[String(30)]');           // Registered signals
	schema.define('navigations', '[String]');           // List of navigation ID (optional, for side rendering)
	schema.define('language', 'String');                // Only information
	schema.define('redirects', '[String]');             // Temporary
	schema.define('css', String);                       // Custom page styles

	schema.define('draft', Boolean);                    // Determines draft
	schema.define('navicon', Boolean);                  // Can replace the item icon in navigation
	schema.define('navname', Boolean);                  // Can replace the item name in navigation
	schema.define('replacelink', Boolean);              // Can replace the link in the whole content

	schema.define('lockedtemplate', Boolean);           // Disables choosing templates
	schema.define('lockedcontent', Boolean);            // Locks a content for editing
	schema.define('usedefault', Boolean);               // Doesn't save a content, still shows a default content from the template

	// Gets listing
	schema.setQuery(function($) {
		var filter = NOSQL('pages').find();
		filter.fields('id', 'name', 'title', 'url', 'ispartial', 'icon', 'parent', 'language', 'draft');
		filter.sort('datecreated', true);
		filter.callback((err, docs, count) => $.callback(filter.adminOutput(docs, count)));
	});

	// Gets a specific page
	schema.setGet(function($) {
		var opt = $.options;
		var filter = NOSQL('pages').one();
		opt.url && filter.where('url', opt.url);
		opt.id && filter.where('id', opt.id);
		$.id && filter.where('id', $.id);

		filter.callback(function(err, response) {

			if (err) {
				$.invalid(err);
				return;
			}

			ADMIN.alert($.user, 'pages.edit', response.id);

			var redirects = Object.keys(F.global.redirects);
			response.redirects = [];

			for (var i = 0, length = redirects.length; i < length; i++) {
				var key = redirects[i];
				if (F.global.redirects[key] === response.url)
					response.redirects.push(key);
			}

			F.functions.read('pages', response.id, function(err, body) {
				response.body = body;
				if (response.draft) {
					F.functions.read('pages', response.id + '_draft', function(err, body) {
						response.bodydraft = body;
						$.callback(response);
					});
				} else
					$.callback(response);
			});

		}, 'error-pages-404');
	});

	// Removes a specific page
	schema.setRemove(function($) {
		var user = $.user.name;
		var id = $.body.id;
		var db = NOSQL('pages');

		db.remove().where('id', id).backup(user).log('Remove: ' + id, user).callback(function(err, count) {
			$.success();
			if (count) {
				F.functions.remove('pages', id);
				db.counter.remove(id);
				setTimeout2('pages', refresh, 1000);
			}
		});

		NOSQL('parts').remove().where('idowner', id).where('type', 'page');
	});

	// Saves a page into the database
	schema.setSave(function($) {

		var model = $.clean();
		var user = $.user.name;
		var oldurl = model.oldurl;
		var isUpdate = !!model.id;
		var nosql = NOSQL('pages');

		!model.title && (model.title = model.name);

		if (isUpdate) {
			model.dateupdated = F.datetime;
			model.adminupdated = user;
		} else {
			model.id = UID();
			model.datecreated = F.datetime;
			model.admincreated = user;
		}

		var redirectsmod = false;
		var redirects = Object.keys(F.global.redirects);
		for (var i = 0, length = redirects.length; i < length; i++) {
			var key = redirects[i];
			if (F.global.redirects[key] === model.oldurl || F.global.redirects[key] === model.url) {
				delete F.global.redirects[key];
				redirectsmod = true;
			}
		}

		if (model.redirects && model.redirects.length) {
			for (var i = 0, length = model.redirects.length; i < length; i++) {
				F.global.redirects[model.redirects[i]] = model.url;
				redirectsmod = true;
			}
		}

		redirectsmod && $WORKFLOW('Redirects', 'update');

		if (!model.navigations.length)
			model.navigations = null;

		model.stamp = new Date().format('yyyyMMddHHmm');
		model.redirects = undefined;
		model.body = U.minifyHTML(model.body);
		model.search = ((model.title || '') + ' ' + (model.keywords || '') + ' ' + model.search).keywords(true, true).join(' ').max(1000);

		// Sanitizes URL
		if (!model.ispartial && !model.url.startsWith('http:') && !model.url.startsWith('https:')) {
			model.url = U.path(model.url);
			if (model.url[0] !== '/')
				model.url = '/' + model.url;
		}

		model.oldurl = undefined;

		if (model.draft) {
			// Draft can have another widgets
			// Therefore we must create a helper values
			model.dwidgets = model.widgets;
			model.dbodywidgets = model.widgets;
			model.widgets = undefined;
			model.bodywidgets = undefined;
			F.functions.write('pages', model.id + '_draft', model.body, isUpdate);
		} else {
			// Removes helper values
			model.dwidgets = null;
			model.dbodywidgets = null;
			F.functions.write('pages', model.id + '_' + model.stamp, model.body); // backup
			F.functions.write('pages', model.id, model.body, isUpdate);
		}

		model.body = undefined;
		var db = isUpdate ? nosql.modify(model).where('id', model.id).backup(user).log('Update: ' + model.id, user) : nosql.insert(model).log('Create: ' + model.id, user);

		// Update a URL in all navigations where this page is used
		if (!model.ispartial)
			$WORKFLOW('Navigation', 'page', { page: model });

		db.callback(function() {

			ADMIN.notify({ type: 'pages.save', message: model.name });
			EMIT('pages.save', model);

			if (model.replacelink && model.url !== oldurl && oldurl)
				$WORKFLOW('Page', 'replacelinks', { url: model.url, oldurl: oldurl });
			else
				setTimeout2('pages', refresh, 1000);

			$.success(model.id);
		});
	});

	// Generates URL according to the parents
	schema.addWorkflow('url', function($) {

		var model = $.model;

		if (model.ispartial) {
			$.callback();
			return;
		}

		if (!model.url || model.url === '---') {
			if (model.parent) {
				var parent = F.global.pages.findItem('id', model.parent);
				model.url = parent ? (parent.url + model.name.slug() + '/') : model.name.slug();
			} else
				model.url = model.name.slug();
		}

		$.callback();
	});

	// Replaces all older links to a new
	schema.addWorkflow('replacelinks', function($) {

		var opt = $.options;
		var reg = new RegExp(opt.oldurl.replace(/\//, '\\/'), 'gi');

		NOSQL('pages').find().fields('id').callback(function(err, docs) {
			// Updates files
			// doc.body.replace(reg, opt.url);
			docs.wait(function(item, next) {
				F.functions.read('pages', item.id, function(err, body) {
					if (body)
						F.functions.write('pages', item.id, body.replace(reg, opt.url), next, true);
					else
						next();
				});
			}, refresh);
		}).where('ispartial', false);

		$.success();
	});

	// Stats
	schema.addWorkflow('stats', function($) {
		var nosql = NOSQL('pages').counter;
		if ($.id)
			nosql.monthly($.id, $.callback);
		else
			nosql.monthly($.callback);
	});
});

NEWSCHEMA('Globals').make(function(schema) {

	var pending = [];

	schema.define('body', 'String');

	schema.setSave(function($) {
		Fs.writeFile(F.path.databases('pagesglobals.json'), JSON.stringify($.model.$clean()), function() {
			refresh();
			$.success();
		});
	});

	schema.setGet(function($) {
		Fs.readFile(F.path.databases('pagesglobals.json'), function(err, data) {

			if (data) {
				data = data.toString('utf8').parseJSON(true);
				$.model.body = data.body;
			}

			$.callback();
		});
	});

	schema.addWorkflow('add', function($) {

		if (F.global.variables[$.options.name]) {
			$.success();
			return;
		}

		pending.push($.options);

		// For multiple usage at the time
		setTimeout2('pageglobalsadd', function() {

			if (!pending.length)
				return;

			WAIT(() => loaded, function() {
				schema.get(function(err, response) {
					var arr = pending.slice(0);
					var is = false;
					for (var i = 0, length = arr.length; i < length; i++) {
						if (!F.global.variables[arr[i].name]) {
							response.body += '\n' + arr[i].name.padRight(25) + ': ' + arr[i].value;
							is = true;
						}
					}
					is && response.$save();
				});
			});

		}, 1000);

		$.success();
	});
});

NEWSCHEMA('Redirects').make(function(schema) {

	schema.define('body', 'String');

	schema.setSave(function($) {
		Fs.writeFile(F.path.databases('pagesredirects.json'), JSON.stringify($.model.$clean()), function() {
			refresh_redirects();
			$.success();
		});
	});

	schema.setGet(function($) {
		Fs.readFile(F.path.databases('pagesredirects.json'), function(err, data) {

			if (data) {
				data = data.toString('utf8').parseJSON(true);
				$.model.body = data.body;
			}

			$.callback();
		});
	});

	schema.addWorkflow('update', function($) {

		var redirects = Object.keys(F.global.redirects);
		var builder = [];

		for (var i = 0, length = redirects.length; i < length; i++) {
			var key = redirects[i];
			builder.push(key.padRight(40) + ' : ' + F.global.redirects[key]);
		}

		var model = schema.create();
		model.body = builder.join('\n');
		model.$save();

		$.success();
	});
});

function refresh_redirects() {
	$GET('Redirects', function(err, response) {
		var lines = response.body.split('\n');
		F.global.redirects = {};
		for (var i = 0, length = lines.length; i < length; i++) {
			var line = lines[i].trim();
			var beg = line.indexOf(':');
			if (beg === -1 || !line || (line[0] === '/' && line[1] === '/'))
				continue;
			var a = U.path(line.substring(0, beg - 1).trim());
			var b = U.path(line.substring(beg + 1).trim());

			if (a[0] !== '/')
				a = '/' + a;

			if (b[0] !== '/' && b[0] !== 'h')
				b = '/' + b;

			F.global.redirects[a] = b;
		}
	});
}

// Refreshes internal information (sitemap)
function refresh() {

	NOSQL('pages').find().fields('id', 'url', 'name', 'title', 'parent', 'icon', 'language', 'ispartial').callback(function(err, response) {

		var sitemap = {};
		var helper = {};
		var partial = [];
		var pages = [];

		for (var i = 0, length = response.length; i < length; i++) {
			var doc = response[i];

			// A partial content is skipped from the sitemap
			if (doc.ispartial) {
				partial.push({ id: doc.id, url: doc.url, name: doc.name, title: doc.title, icon: doc.icon, language: doc.language });
				continue;
			}

			var key = doc.url;
			var obj = { id: doc.id, url: doc.url, name: doc.name, title: doc.title, parent: doc.parent, icon: doc.icon, links: [], language: doc.language };

			helper[doc.id] = key;
			sitemap[key] = obj;
			pages.push(obj);
		}

		// Pairs parents by URL
		Object.keys(sitemap).forEach(function(key) {
			var parent = sitemap[key].parent;
			if (parent) {
				sitemap[key].parent = helper[parent];
				sitemap[sitemap[key].parent] && sitemap[sitemap[key].parent].links.push(sitemap[key]);
			}
		});

		F.global.sitemap = sitemap;
		F.global.partial = partial;
		F.global.pages = pages;

		$GET('Globals', function(err, response) {
			parseGlobals(response.body);
			F.cache.removeAll('cachecms');
			loaded = true;
		});

	});
}

function parseGlobals(val) {
	F.global.variables = {};
	var arr = val.split('\n');
	for (var i = 0, length = arr.length; i < length; i++) {
		var str = arr[i];
		if (!str || str[0] === '#' || str.substring(0, 2) === '//')
			continue;

		var index = str.indexOf(' :');
		if (index === -1) {
			index = str.indexOf('\t:');
			if (index === -1)
				continue;
		}

		var name = str.substring(0, index).trim();

		if (name[0] === '$')
			name = name.substring(1);

		var value = str.substring(index + 2).trim();
		if (name && value)
			F.global.variables[name] = value;
	}
}

String.prototype.CMSrender = function(settings, callback, controller) {
	var body = this;

	if (!settings || !settings.length) {
		callback(body.CMStidy());
		return;
	}

	if (!F.global.widgets.$ready) {
		// Widget are not ready
		setTimeout((body, settings, callback) => body.CMSrender(settings, callback, controller), 500, body, settings, callback);
		return;
	}

	settings.wait(function(item, next) {

		var widget = F.global.widgets[item.idwidget];

		var index = body.indexOf('data-cms-id="{0}"'.format(item.id));
		if (index === -1)
			return next();

		var eindex = body.indexOf('>', index);
		if (!widget || !widget.total || !widget.total.render)
			return next();

		var beg = '<div';
		var end = '</div>';
		var pos = eindex + 1;
		var count = 0;
		var counter = 0;

		while (true) {

			if (counter++ > 100)
				break;

			var a = body.indexOf(beg, pos);
			var b = body.indexOf(end, pos);

			if (a !== -1 && a < b) {
				count++;
				pos = body.indexOf('>', a);
				continue;
			}

			if (a === -1 || b < a) {

				pos = b + 6;

				if (count) {
					count--;
					continue;
				}

				break;
			}
		}

		var content = body.substring(eindex + 1, pos - end.length);
		widget.total.render.call(controller || EMPTYCONTROLLER, widgetsettings(widget, item.options), content, function(response) {
			body = body.replace(content, response);
			next();
		}, widget.template);

	}, () => callback(body.CMSglobals().CMStidy()));
};

function widgetsettings(widget, settings) {
	var keys = Object.keys(widget.def);
	var obj = {};
	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		if (settings[key] == null)
			obj[key] = widget.def[key];
		else
			obj[key] = settings[key];
	}
	return obj;
}

function globalsreplacer(text) {
	var val = F.global.variables[text.substring(1)];
	return val ? val : text;
}

String.prototype.CMSglobals = function() {
	return this.replace(REGEXP_GLOBAL, globalsreplacer);
};

// Cleans CMS markup
String.prototype.CMStidy = function() {

	var body = this;
	var beg;
	var end;
	var index = 0;
	var count = 0;
	var b = ' data-cms-theme="';
	var c = 'CMS_unwrap';
	var tag;
	var tagend;

	body = U.minifyHTML(body).replace(/\sclass="CMS_template CMS_remove"/gi, '');

	while (true) {
		beg = body.indexOf(b, beg);
		if (beg === -1)
			break;
		index = body.indexOf('"', beg + b.length);
		if (index === -1)
			break;
		body = body.substring(0, beg) + body.substring(index + 1);
	}

	b = ' data-cms-category="';
	while (true) {
		beg = body.indexOf(b, beg);
		if (beg === -1)
			break;
		index = body.indexOf('"', beg + b.length);
		if (index === -1)
			break;
		body = body.substring(0, beg) + body.substring(index + 1);
	}

	b = ' data-cms-part="';
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

	return body.replace(REGEXP_HTML_ATTR, '').replace(REGEXP_HTML_CLASS, function(text) {

		var is = text[0] === ' ';
		var arr = text.substring(is ? 8 : 7, text.length - 1).split(' ');
		var builder = '';

		for (var i = 0, length = arr.length; i < length; i++) {
			var cls = arr[i];
			if (cls[0] === 'C' && cls[1] === 'M' && cls[2] === 'S' && cls !== 'CMS_hidden')
				continue;
			builder += (builder ? ' ' : '') + cls;
		}

		return builder ? (is ? ' ' : '') + 'class="' + builder + '"' : '';
	}).replace(REGEXP_HTML_DIV, '<div>');
};

function loadpartial(page, callback, controller) {

	var output = {};

	if (!page.partial || !page.partial.length)
		return callback(output);

	var nosql = NOSQL('pages');
	nosql.find().in('id', page.partial).callback(function(err, response) {

		response.wait(function(item, next) {

			nosql.counter.hit(item.id);
			output[item.id] = item;
			output[item.url] = item;

			item.body.CMSrender(item.widgets, function(body) {
				item.body = body;
				next();
			}, controller);

		}, () => callback(output));
	});
}

Controller.prototype.CMSpage = function(callback, cache) {

	var self = this;
	var page = F.global.sitemap[self.url];

	if (!page) {
		if (F.global.redirects && F.global.redirects[self.url]) {
			self.redirect(F.global.redirects[self.url], RELEASE);
			NOSQL('pages').counter.hit('redirect');
		} else
			self.throw404();
		return self;
	}

	if (typeof(callback) === 'boolean') {
		cache = callback;
		callback = null;
	}

	if (self.query.DRAFT)
		cache = false;

	self.memorize('cachecms' + self.url, cache || '1 minute', cache === false, function() {

		var nosql = NOSQL('pages');
		nosql.one().where('id', page.id).callback(function(err, response) {

			var repo = self.repository;
			self.meta(response.title, response.description, response.keywords);
			self.sitemap('homepage');

			// Sitemap
			var tmp = page;
			while (tmp && tmp.url !== '/') {
				self.sitemap_add('homepage', tmp.name, tmp.url);
				tmp = F.global.sitemap[tmp.parent];
			}

			var counter = nosql.counter.hit('all').hit(response.id);
			var DRAFT = !!self.query.DRAFT;
			response.language && counter.hit(response.language);

			if (response.css) {
				response.css = U.minifyStyle('/*auto*/\n' + response.css);
				self.head('<style type="text/css">' + response.css + '</style>');
			}

			repo.page = response;

			F.functions.read('pages', response.id + (DRAFT ? '_draft' : ''), function(err, body) {
				response.body = body;
				response.body.CMSrender(DRAFT ? response.dwidgets : response.widgets, function(body) {
					response.body = body;
					loadpartial(repo.page, function(partial) {
						repo.page.partial = partial;
						if (callback) {
							callback.call(self, function(model) {
								self.view('~cms/' + repo.page.template, model);
								repo.page.body = null;
								repo.page.pictures = EMPTYARRAY;
								repo.page.search = null;
							});
						} else {
							self.view('~cms/' + repo.page.template);
							repo.page.body = null;
							repo.page.pictures = EMPTYARRAY;
							repo.page.search = null;
						}
					}, self);
				}, self);
			});
		});
	}, function() {
		if (self.repository.page)
			NOSQL('pages').counter.hit('all').hit(self.repository.page.id);
	});

	return self;
};

Controller.prototype.CMSrender = function(url, callback) {

	var self = this;
	var page = F.global.sitemap[url];

	if (!page) {
		callback('404');
		return self;
	}

	NOSQL('pages').one().where('id', page.id).callback(function(err, response) {

		var repo = self.repository;
		self.title(response.title);
		self.sitemap('homepage');

		// Sitemap
		var tmp = page;
		while (tmp && tmp.url !== '/') {
			self.sitemap_add('homepage', tmp.name, tmp.url);
			tmp = F.global.sitemap[tmp.parent];
		}

		if (response.css) {
			response.css = U.minifyStyle('/*auto*/\n' + response.css);
			self.head('<style type="text/css">' + response.css + '</style>');
		}

		repo.page = response;

		F.functions.read('pages', response.id, function(err, body) {
			response.body = body;
			response.body.CMSrender(response.widgets, function(body) {
				response.body = body;
				loadpartial(repo.page.partial, function(partial) {
					repo.page.partial = partial;
					callback(null, repo.page);
				}, self);
			}, self);
		});
	});

	return self;
};

Controller.prototype.CMSpartial = function(url, callback) {

	var self = this;
	var page = F.global.partial.findItem(url.isUID() ? 'id' : 'url', url);

	if (!page) {
		callback('404');
		return self;
	}

	var nosql = NOSQL('pages');
	nosql.counter.hit(page.id);
	nosql.one().where('id', page.id).callback(function(err, response) {

		if (response.css) {
			response.css = U.minifyStyle('/*auto*/\n' + response.css);
			self.head('<style type="text/css">' + response.css + '</style>');
		}

		F.functions.read('pages', response.id, function(err, body) {
			response.body = body;
			response.body.CMSrender(response.widgets, function(body) {
				response.body = body;
				callback(null, response);
			}, self);
		});
	});

	return self;
};

ON('settings', function() {
	refresh();
	refresh_redirects();
});