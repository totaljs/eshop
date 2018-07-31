NEWSCHEMA('NavigationItem').make(function(schema) {
	schema.define('id', 'String(20)');
	schema.define('idpage', 'UID'); // Page ID
	schema.define('name', 'String(50)', true);
	schema.define('url', 'String(500)', true);
	schema.define('title', 'String(100)');
	schema.define('icon', 'Lower(20)');
	schema.define('target', ['_self', '_blank']);
	schema.define('children', '[NavigationItem]');
	schema.define('behaviour', ['default', 'info', 'warn', 'highlight', 'special']);
});

NEWSCHEMA('Navigation').make(function(schema) {
	schema.define('id', 'String(50)', true);
	schema.define('children', '[NavigationItem]');

	schema.setGet(function($) {
		NOSQL('navigations').one().where('id', $.controller.id).callback(function(err, response) {
			if (response) {
				$.callback(response);
			} else {
				$.model.id = $.controller.id;
				$.callback($.model);
			}
		});
	});

	schema.setSave(function($) {
		var user = $.controller.user.name;
		var db = NOSQL('navigations');
		var model = $.model.$clean();

		var nav = F.global.config.navigations.findItem('id', model.id);
		if (nav) {
			model.name = nav.name;
			model.dateupdated = F.datetime;
		} else {
			$.invalid('error-navigations-404');
			return;
		}

		db.update(model, model).where('id', model.id).backup(user).log('Update navigation "{0}"'.format(model.id), user).callback(function() {
			ADMIN.notify({ type: 'navigations.save', message: model.name });
			EMIT('navigations.save', model);
			refresh();
			$.success();
		});
	});

	// A page is changed
	schema.addWorkflow('page', function($) {

		var db = NOSQL('navigations');
		var page = $.options.page;
		var user = $.user ? $.user.name : '';
		var done = () => setTimeout2('navigations', refresh, 500);

		db.find().callback(function(err, response) {
			for (var i = 0, length = response.length; i < length; i++) {
				var nav = response[i];
				var item = findByPage(page.id, nav.children);
				if (item) {

					nav.dateupdated = F.datetime;
					item.url = page.url;
					page.navicon && (item.icon = page.icon);

					if (page.navname) {
						item.name = page.name;
						item.title = page.title;
					}

					item.dateupdated = F.datetime;
					db.update(nav).backup(user).log('Update menu item according to the page {0}: {1}'.format(page.id, page.name)).where('id', nav.id).callback(done);
				}
			}
			$.success();
		});
	});
});

function findByPage(id, items) {
	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		if (item.idpage === id)
			return item;
		if (item.children) {
			item = findByPage(id, item.children);
			if (item)
				return item;
		}
	}
}

function prepare(main, children, parent, level) {
	for (var i = 0; i < children.length; i++) {
		var item = children[i];
		main.url[item.url] = item;
		item.parent = parent;
		item.level = level;
		item.children && item.children.length && prepare(main, item.children, item, level + 1);
		item.contains = function(url, absolute) {

			if (this.url === url)
				return true;

			if (!absolute) {
				if (this.url.length > 1 && url.substring(1, this.url.length) === this.url.substring(1))
					return true;
			}

			for (var i = 0; i < this.children.length; i++) {
				if (this.children[i].url === url)
					return true;
			}
		};
	}
}

function refresh() {
	NOSQL('navigations').find().callback(function(err, response) {
		F.global.navigations = {};

		var nav = F.global.config.navigations;
		for (var i = 0; i < nav.length; i++)
			F.global.navigations[nav[i].id] = { url: {}, children: [], id: nav[i].id, name: nav[i].name };

		for (var i = 0, length = response.length; i < length; i++) {

			var item = response[i];
			var tmp = F.global.navigations[item.id];

			// Navigation doesn't exist
			if (!tmp)
				continue;

			F.global.navigations[item.id] = item;
			item.name = tmp.name;
			item.url = {};
			item.stringify = function() {
				var skip = { parent: true, url: true };
				return JSON.stringify(this, (k, v) => skip[k] ? undefined : v);
			};

			prepare(F.global.navigations[item.id], item.children, null, 0);
		}

		F.cache.removeAll('cachecms');
	});
}

ON('settings', refresh);