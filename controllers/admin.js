const MSG_NOTIFY = { TYPE: 'notify' };
const ALLOW = ['/api/dependencies/', '/api/pages/preview/', '/api/upload/', '/api/nav/', '/api/files/', '/stats/', '/live/', '/api/widgets/'];
var DDOS = {};
var WS = null;

global.ADMIN = {};
global.ADMIN.notify = function(value) {
	if (WS) {
		MSG_NOTIFY.type = value instanceof Object ? value.type : value;
		MSG_NOTIFY.message = value instanceof Object ? value.message : '';
		WS.send(MSG_NOTIFY);
	}
};

F.config['admin-tracking'] && ON('visitor', function(obj) {
	if (WS) {
		MSG_NOTIFY.type = 'visitor';
		MSG_NOTIFY.message = obj;
		WS.send(MSG_NOTIFY);
	}
});

exports.install = function() {

	// Routes are according to the sitemap
	ROUTE('#admin', '=admin/index');

	ROUTE('#admin/api/upload/',                   upload,        ['post', 'upload', 10000], 3084); // 3 MB
	ROUTE('#admin/api/upload/base64/',            upload_base64, ['post', 10000], 2048); // 2 MB

	ROUTE('#admin/api/dashboard/',                json_dashboard);
	ROUTE('#admin/api/dashboard/referrers/',      json_dashboard_referrers);
	ROUTE('#admin/api/dashboard/online/',         json_dashboard_online);

	// Internal
	ROUTE('#admin/api/dependencies/',             ['*Settings --> dependencies']);

	// MODEL: /models/widgets.js
	ROUTE('#admin/api/widgets/',                  ['*Widget --> query']);
	ROUTE('#admin/api/widgets/{id}/',             ['*Widget --> read']);
	ROUTE('#admin/api/widgets/',                  ['*Widget --> save', 'post']);
	ROUTE('#admin/api/widgets/',                  ['*Widget --> remove', 'delete']);
	ROUTE('#admin/api/widgets/{id}/editor/',      ['*Widget --> editor']);
	ROUTE('#admin/api/widgets/dependencies/',     ['*Widget --> dependencies']);
	ROUTE('#admin/api/widgets/{id}/settings/',    json_widget_settings, ['*Widget']);
	ROUTE('#admin/api/widgets/{id}/backups/',     json_backups);

	// MODEL: /models/widgets.js
	ROUTE('#admin/api/widgetsglobals/',           ['*WidgetGlobals --> read']);
	ROUTE('#admin/api/widgetsglobals/',           ['*WidgetGlobals --> save', 'post'], 30);

	// MODEL: /models/pages.js
	ROUTE('#admin/api/pages/',                    ['*Page --> query']);
	ROUTE('#admin/api/pages/{id}/',               ['*Page --> read']);
	ROUTE('#admin/api/pages/',                    ['*Page --> save', 'post']);
	ROUTE('#admin/api/pages/',                    ['*Page --> remove', 'delete']);
	ROUTE('#admin/api/pages/stats/',              ['*Page --> stats']);
	ROUTE('#admin/api/pages/{id}/stats/',         ['*Page --> stats']);
	ROUTE('#admin/api/pages/{id}/backups/',       json_backups);
	ROUTE('#admin/api/pages/preview/',            view_pages_preview, ['json'], 512);
	ROUTE('#admin/api/pages/links/',              json_pages_links);

	// MODEL: /models/pages.js
	ROUTE('#admin/api/pagesglobals/',             ['*PageGlobals --> read']);
	ROUTE('#admin/api/pagesglobals/',             ['*PageGlobals --> save', 'post'], 30);

	// MODEL: /models/posts.js
	ROUTE('#admin/api/posts/',                    ['*Post --> query']);
	ROUTE('#admin/api/posts/{id}/',               ['*Post --> read']);
	ROUTE('#admin/api/posts/',                    ['*Post --> save', 'post']);
	ROUTE('#admin/api/posts/',                    ['*Post --> remove', 'delete']);
	ROUTE('#admin/api/posts/toggle/',             ['*Post --> toggle']);
	ROUTE('#admin/api/posts/stats/'     ,         ['*Post --> stats']);
	ROUTE('#admin/api/posts/{id}/stats/',         ['*Post --> stats']);
	ROUTE('#admin/api/posts/{id}/backups/',       json_backups);

	// MODEL: /models/notices.js
	ROUTE('#admin/api/notices/',                  ['*Notice --> query']);
	ROUTE('#admin/api/notices/{id}/',             ['*Notice --> read']);
	ROUTE('#admin/api/notices/',                  ['*Notice --> save', 'post']);
	ROUTE('#admin/api/notices/',                  ['*Notice --> remove', 'delete']);
	ROUTE('#admin/api/notices/toggle/',           ['*Notice --> toggle']);
	ROUTE('#admin/api/notices/preview/',          view_notices_preview, ['json']);

	// MODEL: /models/subscribers.js
	ROUTE('#admin/api/subscribers/',              ['*Subscriber --> query']);
	ROUTE('#admin/api/subscribers/{id}/',         ['*Subscriber --> read']);
	ROUTE('#admin/api/subscribers/',              ['*Subscriber --> save', 'post']);
	ROUTE('#admin/api/subscribers/',              ['*Subscriber --> remove', 'delete']);
	ROUTE('#admin/api/subscribers/stats/',        ['*Subscriber --> stats']);
	ROUTE('#admin/api/subscribers/toggle/',       ['*Subscriber --> toggle']);

	// MODEL: /models/newsletters.js
	ROUTE('#admin/api/newsletters/',              ['*Newsletter --> query']);
	ROUTE('#admin/api/newsletters/{id}/',         ['*Newsletter --> read']);
	ROUTE('#admin/api/newsletters/',              ['*Newsletter --> save', 'post']);
	ROUTE('#admin/api/newsletters/',              ['*Newsletter --> remove', 'delete']);
	ROUTE('#admin/api/newsletters/test/',         ['*Newsletter --> test', 'post']);
	ROUTE('#admin/api/newsletters/toggle/',       ['*Newsletter --> toggle']);
	ROUTE('#admin/api/newsletters/stats/',        ['*Newsletter --> stats']);
	ROUTE('#admin/api/newsletters/{id}/stats/',   ['*Newsletter --> stats']);
	ROUTE('#admin/api/newsletters/{id}/backups/', json_backups);
	ROUTE('#admin/api/newsletters/state/',        json_newsletter_state);

	// MODEL: /models/navigations.js
	ROUTE('#admin/api/nav/{id}/',                 ['*Navigation --> read']);
	ROUTE('#admin/api/nav/',                      ['*Navigation --> save', 'post']);

	// MODEL: /models/settings.js
	ROUTE('#admin/api/settings/',                 ['*Settings --> read']);
	ROUTE('#admin/api/settings/',                 ['*Settings --> save', 'post']);

	// ESHOP
	// MODEL: /models/products.js
	ROUTE('#admin/api/products/',                 ['*Product --> query']);
	ROUTE('#admin/api/products/{id}/',            ['*Product --> read']);
	ROUTE('#admin/api/products/',                 ['*Product --> save', 'post']);
	ROUTE('#admin/api/products/',                 ['*Product --> remove', 'delete']);
	ROUTE('#admin/api/products/toggle/',          ['*Product --> toggle']);
	ROUTE('#admin/api/products/dependencies/',    ['*Product --> dependencies']);
	ROUTE('#admin/api/products/stats/',           ['*Product --> stats']);
	ROUTE('#admin/api/products/{id}/stats/',      ['*Product --> stats']);
	ROUTE('#admin/api/products/{id}/backups/',    json_backups);
	ROUTE('#admin/api/products/category/',        json_products_replace, ['*Product']);
	ROUTE('#admin/api/products/manufacturer/',    json_products_replace, ['*Product']);
	ROUTE('#admin/api/products/import/',          json_products_import,  ['post']);
	ROUTE('#admin/api/products/export/',          json_products_export,  ['*Product']);

	// MODEL: /models/orders.js
	ROUTE('#admin/api/orders/',                   ['*Order --> query']);
	ROUTE('#admin/api/orders/{id}/',              ['*Order --> read']);
	ROUTE('#admin/api/orders/',                   ['*Order --> save', 'post']);
	ROUTE('#admin/api/orders/',                   ['*Order --> remove', 'delete']);
	ROUTE('#admin/api/orders/stats/',             ['*Order --> stats']);
	ROUTE('#admin/api/orders/toggle/',            ['*Order --> toggle']);
	ROUTE('#admin/api/orders/dependencies/',      ['*Order --> dependencies']);

	// MODEL: /models/users.js
	ROUTE('#admin/api/users/',                    ['*User --> query']);
	ROUTE('#admin/api/users/{id}/',               ['*User --> read']);
	ROUTE('#admin/api/users/',                    ['*User --> save', 'post']);
	ROUTE('#admin/api/users/',                    ['*User --> remove', 'delete']);
	ROUTE('#admin/api/users/stats/',              ['*User --> stats']);
	ROUTE('#admin/api/users/{id}/stats/',         ['*User --> stats']);

	// Files
	ROUTE('#admin/api/files/',                    ['*File --> query']);
	ROUTE('#admin/api/files/clear/',              ['*File --> clear']);

	// Other
	ROUTE('#admin/api/contactforms/stats/',       ['*Contact --> stats']);

	// Websocket
	WEBSOCKET('#admin/live/', socket, ['json']);

	// Login
	ROUTE('/api/login/admin/', login, ['post']);
};

function login() {

	var self = this;
	var key = (self.body.name + ':' + self.body.password).hash();

	if (F.global.config.users[key]) {
		OPERATION('admin.notify', { type: 'admin.login', message: self.body.name });
		self.cookie(F.config['admin-cookie'], key, '1 month');
		self.success();
	} else
		self.invalid().push('error-users-credentials');
}

ON('controller', function(controller, name) {

	if (name !== 'admin' || controller.url === '/api/login/admin/')
		return;

	var ddos = DDOS[controller.ip];

	// 5 failed attempts
	if (ddos > 5) {
		controller.cancel();
		controller.throw401();
		return;
	}

	var cookie = controller.cookie(F.config['admin-cookie']);
	if (cookie == null || !cookie.length) {
		DDOS[controller.ip] = ddos ? ddos + 1 : 1;
		controller.cancel();
		controller.theme('admin');
		controller.view('~login');
		return;
	}

	var user = F.global.config.users[+cookie];
	if (user == null) {
		DDOS[controller.ip] = ddos ? ddos + 1 : 1;
		controller.cancel();
		controller.theme('admin');
		controller.view('~login');
		return;
	}

	// Roles
	if (!user.sa && user.roles.length && controller.url !== controller.sitemap_url('admin')) {

		var cancel = true;

		for (var i = 0, length = user.roles.length; i < length; i++) {
			var role = user.roles[i];
			if (controller.url.indexOf(role.toLowerCase()) !== -1) {
				cancel = false;
				break;
			}
		}

		// Allowed URL
		if (cancel) {
			for (var i = 0, length = ALLOW.length; i < length; i++) {
				if (controller.url.indexOf(ALLOW[i]) !== -1) {
					cancel = false;
					break;
				}
			}

			if (cancel) {
				controller.cancel();
				controller.throw401();
				return;
			}
		}
	}

	controller.user = user;
});

ON('service', function(counter) {
	if (counter % 15 === 0)
		DDOS = {};
});

function socket() {
	var self = this;
	WS = self;
	self.autodestroy(() => WS = null);
}

// Upload (multiple) pictures
function upload() {

	var id = [];
	var self = this;

	self.files.wait(function(file, next) {
		file.read(function(err, data) {

			// Store current file into the HDD
			file.extension = U.getExtension(file.filename);
			var ref = NOSQL('files').binary.insert(file.filename, data);
			id.push({ id: ref, name: file.filename, size: file.size, width: file.width, height: file.height, type: file.type, ctime: F.datetime, mtime: F.datetime, extension: file.extension, download: '/download/' + ref + '.' + file.extension });

			// Next file
			setTimeout(next, 100);
		});

	}, () => self.json(id));
}

// Upload base64
function upload_base64() {
	var self = this;

	if (!self.body.file) {
		self.json(null);
		return;
	}

	var type = self.body.file.base64ContentType();
	var ext;

	switch (type) {
		case 'image/png':
			ext = '.png';
			break;
		case 'image/jpeg':
			ext = '.jpg';
			break;
		case 'image/gif':
			ext = '.gif';
			break;
		default:
			self.json(null);
			return;
	}

	var data = self.body.file.base64ToBuffer();
	var id = NOSQL('files').binary.insert((self.body.name || 'base64').replace(/\.[0-9a-z]+$/i, '').max(40) + ext, data);
	self.json('/download/' + id + ext);
}

// Creates a preview
function view_pages_preview() {
	var self = this;
	self.layout('layout-preview');
	self.repository.preview = true;
	self.repository.page = self.body;
	self.view('~cms/' + self.body.template);
}

function json_widget_settings(id) {
	var self = this;
	var item = F.global.widgets[id];
	self.json(item ? item.editor : null);
}

function json_backups(id) {
	var self = this;
	NOSQL(self.req.split[self.req.split.length - 3]).backups(n => n.data.id === id, self.callback());
}

function json_newsletter_state() {
	this.json(F.global.newsletter);
}

function json_products_replace() {
	var self = this;
	self.$workflow('replace-' + self.req.split[self.req.split.length - 1], self.callback());
}

function json_products_export() {
	var self = this;
	self.$workflow('export', (err, response) => self.binary(Buffer.from(response), 'applications/json', 'binary', 'products.json'));
}

function json_products_import() {
	$WORKFLOW('Product', 'import', this.body, this.callback(), this);
}

function json_dashboard_online() {
	var self = this;
	self.json(MODULE('visitors').today());
}

function json_pages_links() {
	var self = this;
	var arr = [];
	for (var i = 0, length = F.global.pages.length; i < length; i++) {
		var item = F.global.pages[i];
		arr.push({ url: item.url, name: item.name, parent: item.parent });
	}
	self.json(arr);
}

function json_dashboard() {
	MODULE('visitors').monthly(this.callback());
}

function json_dashboard_referrers() {
	NOSQL('visitors').counter.stats_sum(24, F.datetime.getFullYear(), this.callback());
}

function view_notices_preview() {
	var self = this;
	$WORKFLOW('Notice', 'preview', self.body.body || '', function(err, response) {
		self.content(response, 'text/html');
	});
}
