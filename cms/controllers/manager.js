exports.install = function() {
	// Auto-localize static HTML templates
	F.localize('/templates/*.html', ['compress']);

	// COMMON
	F.route(CONFIG('manager-url') + '/*', '~manager');
	F.route(CONFIG('manager-url') + '/upload/',                 upload, ['post', 'upload', 10000], 3084); // 3 MB
	F.route(CONFIG('manager-url') + '/upload/base64/',          upload_base64, ['post', 10000], 2048); // 2 MB
	F.route(CONFIG('manager-url') + '/logoff/',                 redirect_logoff);

	// FILES
	F.route(CONFIG('manager-url') + '/api/files/clear/',        json_files_clear);

	// DASHBOARD
	F.route(CONFIG('manager-url') + '/api/dashboard/',          json_dashboard);
	F.route(CONFIG('manager-url') + '/api/dashboard/online/',   json_dashboard_online);
	F.route(CONFIG('manager-url') + '/api/dashboard/clear/',    json_dashboard_clear);

	// POSTS
	F.route(CONFIG('manager-url') + '/api/posts/',               json_posts_query, ['*Post']);
	F.route(CONFIG('manager-url') + '/api/posts/',               json_posts_save, ['post', '*Post']);
	F.route(CONFIG('manager-url') + '/api/posts/{id}/',          json_posts_read, ['*Post']);
	F.route(CONFIG('manager-url') + '/api/posts/',               json_posts_remove, ['delete', '*Post']);
	F.route(CONFIG('manager-url') + '/api/posts/clear/',         json_posts_clear, ['*Post']);
	F.route(CONFIG('manager-url') + '/api/posts/codelists/',     json_posts_codelists);

	// PAGES
	F.route(CONFIG('manager-url') + '/api/pages/',               json_pages_query, ['*Page']);
	F.route(CONFIG('manager-url') + '/api/pages/',               json_pages_save, ['post', '*Page']);
	F.route(CONFIG('manager-url') + '/api/pages/',               json_pages_remove, ['delete', '*Page']);
	F.route(CONFIG('manager-url') + '/api/pages/{id}/',          json_pages_read, ['*Page']);
	F.route(CONFIG('manager-url') + '/api/pages/preview/',       view_pages_preview, ['json']);
	F.route(CONFIG('manager-url') + '/api/pages/dependencies/',  json_pages_dependencies);
	F.route(CONFIG('manager-url') + '/api/pages/clear/',         json_pages_clear, ['*Page']);
	F.route(CONFIG('manager-url') + '/api/pages/sitemap/',       json_pages_sitemap);

	// WIDGETS
	F.route(CONFIG('manager-url') + '/api/widgets/',             json_widgets_query, ['*Widget']);
	F.route(CONFIG('manager-url') + '/api/widgets/',             json_widgets_save, ['post', '*Widget']);
	F.route(CONFIG('manager-url') + '/api/widgets/',             json_widgets_remove, ['delete', '*Widget']);
	F.route(CONFIG('manager-url') + '/api/widgets/{id}/',        json_widgets_read, ['*Widget']);
	F.route(CONFIG('manager-url') + '/api/widgets/clear/',       json_widgets_clear, ['*Widget']);

	// NEWSLETTER
	F.route(CONFIG('manager-url') + '/api/newsletter/',          json_newsletter, ['*Newsletter']);
	F.route(CONFIG('manager-url') + '/api/newsletter/csv/',      file_newsletter, ['*Newsletter']);
	F.route(CONFIG('manager-url') + '/api/newsletter/clear/',    json_newsletter_clear, ['*Newsletter']);

	// SETTINGS
	F.route(CONFIG('manager-url') + '/api/settings/',            json_settings, ['*Settings']);
	F.route(CONFIG('manager-url') + '/api/settings/',            json_settings_save, ['put', '*Settings']);

	// SYSTEM
	F.route(CONFIG('manager-url') + '/api/backup/website/',      file_backup_website, [15000]);
};

// ==========================================================================
// COMMON
// ==========================================================================

// Upload (multiple) pictures
function upload() {

	var self = this;
	var id = [];

	self.files.wait(function(file, next) {
		file.read(function(err, data) {

			// Store current file into the HDD
			file.extension = U.getExtension(file.filename);
			id.push(DB('files').binary.insert(file.filename, data) + file.extension);

			// Next file
			setTimeout(next, 100);
		});

	}, function() {
		// Returns response
		self.json(id);
	});
}

// Upload base64
function upload_base64() {
	var self = this;

	if (!self.body.file) {
		self.json(null);
		return;
	}

	var type = self.body.file.base64ContentType();
	var data = self.body.file.base64ToBuffer();
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
	}

	var id = DB('files').binary.insert('base64' + ext, data);
	self.json('/download/' + id + ext);
}

// Logoff
function redirect_logoff() {
	var self = this;
	self.res.cookie('__manager', '', '-1 days');
	self.redirect(CONFIG('manager-url'));
}

// ==========================================================================
// FILES
// ==========================================================================

// Clears all uploaded files
function json_files_clear() {
	var async = [];
	var self = this;

	async.push(function(next) {
		DB('fs.chunks').drop(F.error());
		next();
	});

	async.push(function(next) {
		DB('fs.files').drop(F.error());
		next();
	});

	async.async(function() {
		self.json(SUCCESS(true));
	});
}

// ==========================================================================
// DASHBOARD
// ==========================================================================

// Reads basic informations for dashboard
function json_dashboard() {

	var self = this;
	var model = {};
	var counter = MODULE('webcounter');

	model.webcounter = {};
	model.webcounter.today = counter.today();
	model.webcounter.online = counter.online();

	if (!model.webcounter.today.pages)
		model.webcounter.today.pages = 0;

	model.webcounter.today.pages = Math.floor(parseFloat(model.webcounter.today.pages));

	var async = [];

	// Reads all monthly stats
	async.push(function(next) {
		counter.monthly(function(stats) {
			model.webcounter.stats = stats;
			next();
		});
	});

	// Reads dashboard information from all registered schemas which they have defined `dashboard` operation.
	async.push(function(next) {

		var pending = [];

		EACHSCHEMA(function(group, name, schema) {
			if (!schema.operations || !schema.operations['dashboard'])
				return;
			pending.push(schema);
		});

		pending.wait(function(schema, next) {
			schema.operation('dashboard', null, function(err, data) {
				if (!err && data)
					model[schema.name] = data;
				next();
			});
		}, next);
	});

	async.async(function() {
		self.json(model);
	});
}

// Reads online users
function json_dashboard_online() {
	var self = this;
	var counter = MODULE('webcounter');
	var memory = process.memoryUsage();
	var model = {};
	model.visitors = counter.online();
	model.today = counter.today();
	model.last = counter.today().last;
	model.memoryused = (memory.heapUsed / 1024 / 1024).floor(2);
	model.memorytotal = (memory.heapTotal / 1024 / 1024).floor(2);
	self.json(model);
}

// Clear visitor statistics
function json_dashboard_clear() {
	var self = this;
	var instance = MODULE('webcounter').instance;

	// @TODO: missing remove all stats

	Object.keys(instance.stats).forEach(function(key) {
		instance.stats[key] = 0;
	});

	self.json(SUCCESS(true));
}

// ==========================================================================
// POSTS
// ==========================================================================

// Gets all posts
function json_posts_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

// Saves (update or create) specific post
function json_posts_save() {
	var self = this;
	self.body.$save(self.callback());
}

// Removes specific post
function json_posts_remove() {
	var self = this;
	self.$remove(self.body.id, self.callback());
}

// Clears all posts
function json_posts_clear() {
	var self = this;
	self.$workflow('clear', self.callback());
}

// Reads all post categories and manufacturers
function json_posts_codelists() {
	var self = this;
	self.json({ categories: F.global.posts, templates: F.config.custom.templates });
}

// Reads a specific post by ID
function json_posts_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	self.$get(options, self.callback());
}

// ==========================================================================
// PAGES
// ==========================================================================

// Gets all pages
function json_pages_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

// Creates HTML preview
function view_pages_preview() {
	var self = this;
	self.layout('layout-preview');
	self.repository.preview = true;
	self.repository.page = self.body;
	self.view('~cms/' + self.body.template);
}

// Gets dependencies for Pages (templates and navigations)
function json_pages_dependencies() {
	var self = this;
	self.json({ templates: F.config.custom.templates, navigations: F.config.custom.navigations });
}

// Saves (update or create) specific page
function json_pages_save() {
	var self = this;

	// Is auto-creating URL?
	if (self.body.url[0] === '-')
		self.body.$async(self.callback(), 1).$workflow('create-url').$save();
	else
		self.body.$save(self.callback());

	// Clears view cache
	setTimeout(() => F.cache.removeAll('cache.'), 2000);
}

// Reads a specific page
function json_pages_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	self.$get(options, self.callback());
}

// Removes specific page
function json_pages_remove() {
	var self = this;
	self.$remove(self.body.id, self.callback());
}

// Clears all pages
function json_pages_clear() {
	var self = this;
	self.$workflow('clear', self.callback());
}

function json_pages_sitemap() {
	this.json({ sitemap: F.global.sitemap, partial: F.global.partial });
}

// ==========================================================================
// WIDGETS
// ==========================================================================

// Gets all widgets
function json_widgets_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

// Saves (updates or creates) specific widget
function json_widgets_save() {
	var self = this;
	self.body.$save(self.callback());

	// Clears view cache
	setTimeout(() => F.cache.removeAll('cache.'));
}

// Reads specific widget
function json_widgets_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	self.$get(options, self.callback());
}

// Removes specific widget
function json_widgets_remove() {
	var self = this;
	self.$remove(self.body.id, self.callback());
}

// Clears all widgets
function json_widgets_clear() {
	var self = this;
	self.$workflow('clear', self.callback());
}

// ==========================================================================
// SETTINGS
// ==========================================================================

// Reads custom settings
function json_settings() {
	var self = this;
	self.$get(null, self.callback());
}

// Saves and refresh custom settings
function json_settings_save() {
	var self = this;
	self.body.$async(self.callback(), 0).$save().$workflow('load');
}

// ==========================================================================
// SYSTEM
// ==========================================================================

// Full backup
// How do I restore backup? Total.js must be installed as global module, terminal:
// $ tpm restore filename
function file_backup_website() {
	var self = this;
	var filename = F.path.temp('website.backup');

	F.backup(filename, F.path.root(), function() {
		self.file('~' + filename, 'website.backup', null, () => require('fs').unlink(filename, NOOP));
	}, path => !path.startsWith('/tmp'));
}

// ==========================================================================
// NEWSLETTER
// ==========================================================================

// Reads all emails from newsletter file
function json_newsletter() {
	var self = this;
	self.$query(self.callback());
}

// Downloads all email address as CSV
function file_newsletter() {
	var self = this;
	self.$workflow('download', self);
}

// Clears all email addreses in newsletter
function json_newsletter_clear() {
	var self = this;
	self.$workflow('clear', self.callback());
}