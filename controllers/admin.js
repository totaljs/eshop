const MSG_NOTIFY = { TYPE: 'notify' };
const MSG_ALERT = { TYPE: 'alert' };
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

global.ADMIN.alert = function(user, type, value) {
	if (user && WS) {
		MSG_ALERT.type = type;
		MSG_ALERT.message = value;
		MSG_ALERT.user = user.name;
		WS.send(MSG_ALERT);
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

	// Internal
	ROUTE('GET     #admin', '=admin/index');
	ROUTE('POST    /api/login/admin/',                        login);
	ROUTE('POST    #admin/api/upload/',                       upload, ['upload', 10000], 3084); // 3 MB
	ROUTE('POST    #admin/api/upload/base64/',                upload_base64, [10000], 2048); // 2 MB
	ROUTE('GET     #admin/api/dependencies/                   *Settings --> @dependencies');

	// Dashboard
	ROUTE('GET     #admin/api/dashboard/',                    json_dashboard);
	ROUTE('GET     #admin/api/dashboard/referrers/',          json_dashboard_referrers);
	ROUTE('GET     #admin/api/dashboard/online/',             json_dashboard_online);
	ROUTE('GET     #admin/api/dashboard/tracking/             *Tracking --> @stats');

	// MODEL: /models/widgets.js
	ROUTE('GET     #admin/api/widgets/                        *Widget --> @query');
	ROUTE('GET     #admin/api/widgets/{id}/                   *Widget --> @read');
	ROUTE('POST    #admin/api/widgets/                        *Widget --> @save');
	ROUTE('DELETE  #admin/api/widgets/                        *Widget --> @remove');
	ROUTE('GET     #admin/api/widgets/{id}/editor/            *Widget --> @editor');
	ROUTE('GET     #admin/api/widgets/dependencies/           *Widget --> @dependencies');
	ROUTE('GET     #admin/api/widgets/{id}/settings/          *Widget', json_widget_settings);
	ROUTE('GET     #admin/api/widgets/{id}/backups/           *Common --> @backup');

	// MODEL: /models/widgets.js
	ROUTE('GET     #admin/api/widgets/globals/                *WidgetGlobals --> @read');
	ROUTE('POST    #admin/api/widgets/globals/                *WidgetGlobals --> @save', 30);

	// MODEL: /models/pages.js
	ROUTE('GET     #admin/api/pages/                          *Page --> @query');
	ROUTE('GET     #admin/api/pages/{id}/                     *Page --> @read');
	ROUTE('POST    #admin/api/pages/                          *Page --> @url @save (response)');
	ROUTE('DELETE  #admin/api/pages/                          *Page --> @remove');
	ROUTE('GET     #admin/api/pages/stats/                    *Page --> @stats');
	ROUTE('GET     #admin/api/pages/{id}/stats/               *Page --> @stats');
	ROUTE('GET     #admin/api/pages/{id}/backups/             *Common --> @backup');
	ROUTE('POST    #admin/api/pages/preview/',                view_pages_preview, ['json'], 512);
	ROUTE('GET     #admin/api/pages/dependencies/',           json_pages_dependencies);
	ROUTE('POST    #admin/api/pages/css/',                    css_pages, ['json'], 512);

	ROUTE('POST    #admin/api/parts/                          *Part --> @save');
	ROUTE('POST    #admin/api/tracking/                       *Tracking --> @save');
	ROUTE('GET     #admin/api/tracking/                       *Tracking --> @query');
	ROUTE('GET     #admin/api/tracking/{id}/                  *Tracking --> @stats');
	ROUTE('DELETE  #admin/api/tracking/{id}/                  *Tracking --> @remove');

	// MODEL: /models/pages.js
	ROUTE('GET     #admin/api/pages/globals/                  *Globals --> @read');
	ROUTE('POST    #admin/api/pages/globals/                  *Globals --> @save', 30);
	ROUTE('GET     #admin/api/pages/redirects/                *Redirects --> @read');
	ROUTE('POST    #admin/api/pages/redirects/                *Redirects --> @save', 30);

	// MODEL: /models/posts.js
	ROUTE('GET     #admin/api/posts/                          *Post --> @query');
	ROUTE('GET     #admin/api/posts/{id}/                     *Post --> @read');
	ROUTE('POST    #admin/api/posts/                          *Post --> @save');
	ROUTE('DELETE  #admin/api/posts/                          *Post --> @remove');
	ROUTE('GET     #admin/api/posts/toggle/                   *Post --> @toggle');
	ROUTE('GET     #admin/api/posts/stats/                    *Post --> @stats');
	ROUTE('GET     #admin/api/posts/{id}/stats/               *Post --> @stats');
	ROUTE('GET     #admin/api/posts/{id}/backups/             *Common --> @backup');

	// MODEL: /models/notices.js
	ROUTE('GET     #admin/api/notices/                        *Notice --> @query');
	ROUTE('GET     #admin/api/notices/{id}/                   *Notice --> @read');
	ROUTE('POST    #admin/api/notices/                        *Notice --> @save');
	ROUTE('DELETE  #admin/api/notices/                        *Notice --> @remove');
	ROUTE('GET     #admin/api/notices/toggle/                 *Notice --> @toggle');
	ROUTE('POST    #admin/api/notices/preview/',              view_notices_preview, ['json']);

	// MODEL: /models/subscribers.js
	ROUTE('GET     #admin/api/subscribers/                    *Subscriber --> @query');
	ROUTE('GET     #admin/api/subscribers/{id}/               *Subscriber --> @read');
	ROUTE('POST    #admin/api/subscribers/                    *Subscriber --> @save');
	ROUTE('DELETE  #admin/api/subscribers/                    *Subscriber --> @remove');
	ROUTE('GET     #admin/api/subscribers/stats/              *Subscriber --> @stats');
	ROUTE('GET     #admin/api/subscribers/toggle/             *Subscriber --> @toggle');

	// MODEL: /models/newsletters.js
	ROUTE('GET     #admin/api/newsletters/                    *Newsletter --> @query');
	ROUTE('GET     #admin/api/newsletters/{id}/               *Newsletter --> @read');
	ROUTE('POST    #admin/api/newsletters/                    *Newsletter --> @save');
	ROUTE('DELETE  #admin/api/newsletters/                    *Newsletter --> @remove');
	ROUTE('POST    #admin/api/newsletters/test/               *Newsletter --> @test');
	ROUTE('GET     #admin/api/newsletters/toggle/             *Newsletter --> @toggle');
	ROUTE('GET     #admin/api/newsletters/stats/              *Newsletter --> @stats');
	ROUTE('GET     #admin/api/newsletters/{id}/stats/         *Newsletter --> @stats');
	ROUTE('GET     #admin/api/newsletters/{id}/backups/       *Common --> @backup');
	ROUTE('GET     #admin/api/newsletters/state/',            json_newsletter_state);

	// MODEL: /models/navigations.js
	ROUTE('GET     #admin/api/nav/{id}/                       *Navigation --> @read');
	ROUTE('POST    #admin/api/nav/                            *Navigation --> @save');

	// MODEL: /models/navigations.js
	ROUTE('GET     #admin/api/redirects/{id}/                 *Redirect --> @read');
	ROUTE('POST    #admin/api/redirects/                      *Redirect --> @save');

	// MODEL: /models/settings.js
	ROUTE('GET     #admin/api/settings/                       *Settings --> @read');
	ROUTE('POST    #admin/api/settings/                       *Settings --> @smtp @save (response) @load');

	// Files
	ROUTE('GET     #admin/api/files/                          *File --> @query');
	ROUTE('GET     #admin/api/files/clear/                    *File --> @clear');

	// Others
	ROUTE('GET     #admin/api/contactforms/stats/             *Contact --> stats');

	// Websocket
	WEBSOCKET('#admin/live/', socket, ['json']);

};

ON('controller', function(controller, name) {

	if (name !== 'admin' || controller.url === '/api/login/admin/') {
		if (!controller.route.groups || !controller.route.groups.admin)
			return;
	}

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

function login() {

	var self = this;
	var key = (self.body.name + ':' + self.body.password).hash();

	if (F.global.config.users[key]) {
		OPERATION('admin.notify', { type: 'admin.login', message: self.body.name });
		self.cookie(F.config['admin-cookie'], key, '1 month');
		self.success();
	} else
		self.invalid('error-users-credentials');
}

// Upload (multiple) pictures
function upload() {

	var id = [];
	var self = this;

	self.files.wait(function(file, next) {
		file.read(function(err, data) {

			// Store current file into the HDD
			file.extension = U.getExtension(file.filename);

			FILESTORAGE('files').insert(file.filename, data, function(err, ref) {
				id.push({ id: ref, name: file.filename, size: file.size, width: file.width, height: file.height, type: file.type, ctime: F.datetime, mtime: F.datetime, extension: file.extension, download: '/download/' + ref + '.' + file.extension });
				setImmediate(next);
			});

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
	FILESTORAGE('files').insert((self.body.name || 'base64').replace(/\.[0-9a-z]+$/i, '').max(40) + ext, data, (err, id) => self.json('/download/' + id + ext));
}

// Creates a preview
function view_pages_preview() {
	var self = this;
	self.layout('layout-preview');
	self.repository.preview = true;
	self.repository.page = self.body;
	self.view('~cms/' + self.body.template);
}

function css_pages() {
	var self = this;
	self.content(U.minifyStyle('/*auto*/\n' + (self.body.css || '')), 'text/css');
}

function json_widget_settings(id) {
	var self = this;
	var item = F.global.widgets[id];
	self.json(item ? item.editor : null);
}

function json_newsletter_state() {
	this.json(F.global.newsletter);
}

function json_dashboard_online() {
	var self = this;
	var data = MODULE('visitors').today();
	data.memory = process.memoryUsage();
	data.performance = F.stats.performance;
	self.json(data);
}

function json_pages_dependencies() {
	var self = this;
	var arr = [];

	for (var i = 0, length = F.global.pages.length; i < length; i++) {
		var item = F.global.pages[i];
		arr.push({ url: item.url, name: item.name, parent: item.parent });
	}

	var output = {};
	output.links = arr;

	NOSQL('parts').find().fields('id', 'name', 'category').callback(function(err, response) {
		output.parts = response;
		self.json(output);
	});
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
