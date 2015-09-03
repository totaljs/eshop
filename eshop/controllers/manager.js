exports.install = function() {
	// Auto-localize static HTML templates
	F.localize('All templates', '/templates/');

	// COMMON
	F.route(CONFIG('manager-url') + '/*', '~manager');
	F.route(CONFIG('manager-url') + '/upload/',                  upload, ['post', 'upload'], 3084); // 3 MB
	F.route(CONFIG('manager-url') + '/upload/base64/',           upload_base64, ['post'], 2048); // 2 MB

	// FILES
	F.route(CONFIG('manager-url') + '/api/files/clear/',         json_files_clear);

	// DASHBOARD
	F.route(CONFIG('manager-url') + '/api/dashboard/',           json_dashboard);
	F.route(CONFIG('manager-url') + '/api/dashboard/online/',    json_dashboard_online);
	F.route(CONFIG('manager-url') + '/api/dashboard/clear/',     json_dashboard_clear);

	// ORDERS
	F.route(CONFIG('manager-url') + '/api/orders/',              json_orders_query);
	F.route(CONFIG('manager-url') + '/api/orders/{id}/',         json_orders_read);
	F.route(CONFIG('manager-url') + '/api/orders/',              json_orders_save, ['put', '*Order']);
	F.route(CONFIG('manager-url') + '/api/orders/',              json_orders_remove, ['delete']);
	F.route(CONFIG('manager-url') + '/api/orders/clear/',        json_orders_clear);

	// PRODUCTS
	F.route(CONFIG('manager-url') + '/api/products/',            json_products_query);
	F.route(CONFIG('manager-url') + '/api/products/',            json_products_save, ['post', '*Product']);
	F.route(CONFIG('manager-url') + '/api/products/{id}/',       json_products_read);
	F.route(CONFIG('manager-url') + '/api/products/',            json_products_remove, ['delete']);
	F.route(CONFIG('manager-url') + '/api/products/clear/',      json_products_clear);
	F.route(CONFIG('manager-url') + '/api/products/import/',     json_products_import, ['upload'], 1024);
	F.route(CONFIG('manager-url') + '/api/products/categories/', json_products_categories);
	F.route(CONFIG('manager-url') + '/api/products/category/',   json_products_category_replace, ['post']);

	// PAGES
	F.route(CONFIG('manager-url') + '/api/pages/',               json_pages_query);
	F.route(CONFIG('manager-url') + '/api/pages/',               json_pages_save, ['post', '*Page']);
	F.route(CONFIG('manager-url') + '/api/pages/',               json_pages_remove, ['delete']);
	F.route(CONFIG('manager-url') + '/api/pages/{id}/',          json_pages_read);
	F.route(CONFIG('manager-url') + '/api/pages/preview/',       view_pages_preview, ['json']);
	F.route(CONFIG('manager-url') + '/api/pages/dependencies/',  json_pages_dependencies);
	F.route(CONFIG('manager-url') + '/api/pages/clear/',         json_pages_clear);
	F.route(CONFIG('manager-url') + '/api/pages/sitemap/',       json_pages_sitemap);

	// WIDGETS
	F.route(CONFIG('manager-url') + '/api/widgets/',             json_widgets_query);
	F.route(CONFIG('manager-url') + '/api/widgets/',             json_widgets_save, ['post', '*Widget']);
	F.route(CONFIG('manager-url') + '/api/widgets/',             json_widgets_remove, ['delete']);
	F.route(CONFIG('manager-url') + '/api/widgets/{id}/',        json_widgets_read);
	F.route(CONFIG('manager-url') + '/api/widgets/clear/',       json_widgets_clear);

	// NEWSLETTER
	F.route(CONFIG('manager-url') + '/api/newsletter/',          json_newsletter);
	F.route(CONFIG('manager-url') + '/api/newsletter/csv/',      file_newsletter);
	F.route(CONFIG('manager-url') + '/api/newsletter/clear/',    json_newsletter_clear);

	// SETTINGS
	F.route(CONFIG('manager-url') + '/api/settings/',            json_settings);
	F.route(CONFIG('manager-url') + '/api/settings/',            json_settings_save, ['put', '*Settings']);

	// SYSTEM
	F.route(CONFIG('manager-url') + '/api/backup/website/',      file_backup_website, [15000]);
	F.route(CONFIG('manager-url') + '/api/backup/database/',     file_backup_database);
	F.route(CONFIG('manager-url') + '/api/restore/database/',    file_restore_database, ['upload', 15000], 20000);
};

// ==========================================================================
// COMMON
// ==========================================================================

// Upload (multiple) pictures
function upload() {

	var self = this;
	var async = [];
	var id = [];

	self.files.wait(function(file, next) {
		file.read(function(err, data) {
			// Store current file into the HDD
			var index = file.filename.lastIndexOf('.');

			if (index === -1)
				file.extension = '.dat';
			else
				file.extension = file.filename.substring(index);

			id.push(DB('files').binary.insert(file.filename, file.type, data) + file.extension);

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
	var id = DB('files').binary.insert('unknown', type, data);

	switch (type) {
		case 'image/png':
			id += '.png';
			break;
		case 'image/jpeg':
			id += '.jpg';
			break;
		case 'image/gif':
			id += '.gif';
			break;
	}

	self.json('/download/' + id);
}

// ==========================================================================
// FILES
// ==========================================================================

// Clears all uploaded files
function json_files_clear() {
	var Fs = require('fs');
	U.ls(DB('files').binary.directory, function(files) {
		files.wait(function(item, next) {
			Fs.unlink(item, next);
		});
	});

	self.json(SUCCESS(true));
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

	F.fs.rm.database('webcounter.nosql');
	F.fs.rm.database('webcounter.cache');

	Object.keys(instance.stats).forEach(function(key) {
		instance.stats[key] = 0;
	});

	self.json(SUCCESS(true));
}

// ==========================================================================
// PRODUCTS
// ==========================================================================

// Gets all products
function json_products_query() {
	var self = this;
	GETSCHEMA('Product').query(self.query, self.callback());
}

// Saves (update or create) specific product
function json_products_save() {
	var self = this;

	self.body.$save(self.callback());

	// Clears view cache
	setTimeout(function() {
		F.cache.removeAll('cache.');
	}, 2000);
}

// Removes specific product
function json_products_remove() {
	var self = this;
	GETSCHEMA('Product').remove(self.body.id, self.callback());
}

// Clears all products
function json_products_clear() {
	var self = this;
	GETSCHEMA('Product').workflow('clear', null, null, self.callback(), true);
}

// Imports products from CSV
function json_products_import() {
	var self = this;
	var file = self.files[0];
	GETSCHEMA('Product').workflow('import', null, file.path, self.callback(), true);
}

// Reads all product categories
function json_products_categories() {
	var self = this;

	if (!F.global.categories)
		F.global.categories = [];

	self.json(F.global.categories);
}

// Replaces old category with new
function json_products_category_replace() {
	var self = this;
	GETSCHEMA('Product').workflow('category', null, self.body, self.callback(), true);
}

// Reads a specific product by ID
function json_products_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	GETSCHEMA('Product').get(options, self.callback());
}

// ==========================================================================
// ORDERS
// ==========================================================================

// Reads all orders
function json_orders_query() {
	var self = this;
	GETSCHEMA('Order').query(self.query, self.callback());
}

// Saves specific order (order must exist)
function json_orders_save() {
	var self = this;
	self.body.$save(self.callback());
}

// Removes specific order
function json_orders_remove() {
	var self = this;
	GETSCHEMA('Order').remove(self.body.id, self.callback());
}

// Clears all orders
function json_orders_clear() {
	var self = this;
	GETSCHEMA('Order').workflow('clear', null, null, self.callback(), true);
}

// Reads a specific order by ID
function json_orders_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	GETSCHEMA('Order').get(options, self.callback());
}

// ==========================================================================
// PAGES
// ==========================================================================

// Gets all pages
function json_pages_query() {
	var self = this;
	GETSCHEMA('Page').query(self.query, self.callback());
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
	setTimeout(function() {
		F.cache.removeAll('cache.');
	}, 2000);
}

// Reads a specific page
function json_pages_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	GETSCHEMA('Page').get(options, self.callback());
}

// Removes specific page
function json_pages_remove() {
	var self = this;
	GETSCHEMA('Page').remove(self.body.id, self.callback());
}

// Clears all pages
function json_pages_clear() {
	var self = this;
	GETSCHEMA('Page').workflow('clear', null, null, self.callback(), true);
}

function json_pages_sitemap() {
	this.json(F.global.sitemap);
}

// ==========================================================================
// WIDGETS
// ==========================================================================

// Gets all widgets
function json_widgets_query() {
	var self = this;
	GETSCHEMA('Widget').query(self.query, self.callback());
}

// Saves (updates or creates) specific widget
function json_widgets_save() {
	var self = this;
	self.body.$save(self.callback());

	// Clears view cache
	setTimeout(function() {
		F.cache.removeAll('cache.');
	}, 2000);
}

// Reads specific widget
function json_widgets_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	GETSCHEMA('Widget').get(options, self.callback());
}

// Removes specific widget
function json_widgets_remove() {
	var self = this;
	GETSCHEMA('Widget').remove(self.body.id, self.callback());
}

// Clears all widgets
function json_widgets_clear() {
	var self = this;
	GETSCHEMA('Widget').workflow('clear', null, null, self.callback(), true);
}

// ==========================================================================
// SETTINGS
// ==========================================================================

// Reads custom settings
function json_settings() {
	var self = this;
	GETSCHEMA('Settings').get(null, self.callback());
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
	var filter = function(path) {
		return !path.startsWith('/tmp');
	};

	F.backup(filename, F.path.root(), function() {
		self.file('~' + filename, 'website.backup', null, function() {
			F.fs.rm.temp('website.backup');
		});
	}, filter);
}

// Backup databases
function file_backup_database() {
	var self = this;
	var filename = F.path.temp('databases.backup');
	F.backup(filename, F.path.databases(), function() {
		self.file('~' + filename, 'databases.backup', null, function() {
			F.fs.rm.temp('databases.backup');
		});
	});
}

// Restore databases
function file_restore_database() {
	var self = this;
	var filename = F.path.temp('databases.backup');
	F.restore(self.files[0].path, F.path.databases(), function() {
		// Clear all databases instances
		F.databases = {};
		GETSCHEMA('Product').workflow('refresh', null, null, NOOP, true);
		self.json(SUCCESS(true));
	});
}

// ==========================================================================
// NEWSLETTER
// ==========================================================================

// Reads all emails from newsletter file
function json_newsletter() {
	var self = this;
	GETSCHEMA('Newsletter').query(self.callback());
}

// Downloads all email address as CSV
function file_newsletter() {
	var self = this;
	GETSCHEMA('Newsletter').workflow('download', null, self, null, true);
}

// Clears all email addreses in newsletter
function json_newsletter_clear() {
	var self = this;
	GETSCHEMA('Newsletter').workflow('clear', null, null, self.callback(), true);
}