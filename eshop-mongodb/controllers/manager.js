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

	// ORDERS
	F.route(CONFIG('manager-url') + '/api/orders/',             json_orders_query, ['*Order']);
	F.route(CONFIG('manager-url') + '/api/orders/{id}/',        json_orders_read, ['*Order']);
	F.route(CONFIG('manager-url') + '/api/orders/',             json_orders_save, ['put', '*Order']);
	F.route(CONFIG('manager-url') + '/api/orders/',             json_orders_remove, ['delete', '*Order']);
	F.route(CONFIG('manager-url') + '/api/orders/clear/',       json_orders_clear, ['*Order']);

	// USERS
	F.route(CONFIG('manager-url') + '/api/users/',              json_users_query, ['*User']);
	F.route(CONFIG('manager-url') + '/api/users/{id}/',         json_users_read, ['*User']);
	F.route(CONFIG('manager-url') + '/api/users/',              json_users_save, ['put', '*User']);
	F.route(CONFIG('manager-url') + '/api/users/',              json_users_remove, ['delete', '*User']);
	F.route(CONFIG('manager-url') + '/api/users/clear/',        json_users_clear, ['*User']);

	// PRODUCTS
	F.route(CONFIG('manager-url') + '/api/products/',            json_products_query, ['*Product']);
	F.route(CONFIG('manager-url') + '/api/products/',            json_products_save, ['post', '*Product']);
	F.route(CONFIG('manager-url') + '/api/products/{id}/',       json_products_read, ['*Product']);
	F.route(CONFIG('manager-url') + '/api/products/',            json_products_remove, ['delete', '*Product']);
	F.route(CONFIG('manager-url') + '/api/products/clear/',      json_products_clear, ['*Product']);
	F.route(CONFIG('manager-url') + '/api/products/import/',     json_products_import, ['upload', 1000 * 60 * 5], 1024);
	F.route(CONFIG('manager-url') + '/api/products/export/',     json_products_export, ['*Product', 10000]);
	F.route(CONFIG('manager-url') + '/api/products/codelists/',  json_products_codelists);
	F.route(CONFIG('manager-url') + '/api/products/category/',   json_products_category_replace, ['post', '*Product']);

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
	var output = [];

	self.files.wait(function(file, next) {

		// Store current file into the HDD
		var index = file.filename.lastIndexOf('.');

		if (index === -1)
			file.extension = '.dat';
		else
			file.extension = file.filename.substring(index);

		var id = new ObjectID();

		GridStore.writeFile(DB(), id, file.path, file.filename, null, function(err) {

			if (err)
				return next();

			output.push(id.toString() + file.extension);
			setTimeout(next, 200);
		});

	}, function() {
		// Returns response
		self.json(output);
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

	var id = new ObjectID();
	var output = id.toString();

	switch (type) {
		case 'image/png':
			output += '.png';
			break;
		case 'image/jpeg':
			output += '.jpg';
			break;
		case 'image/gif':
			output += '.gif';
			break;
	}

	DB().writeBuffer(id, data, output, null, function(err) {
		self.json('/download/' + output);
	});
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
	var self = this;
	var nosql = DB();

	nosql.push('fs.chunks', function(collection, callback) {
		collection.drop(callback);
	});

	nosql.push('fs.files', function(collection, callback) {
		collection.drop(callback);
	});

	nosql.exec(() => self.json(SUCCESS(true)));
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
// PRODUCTS
// ==========================================================================

// Gets all products
function json_products_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

// Saves (update or create) specific product
function json_products_save() {
	var self = this;

	self.body.$save(self.callback());

	// Clears view cache
	setTimeout(() => F.cache.removeAll('cache.'), 2000);
}

// Removes specific product
function json_products_remove() {
	var self = this;
	self.$remove(self.body.id, self.callback());
}

// Clears all products
function json_products_clear() {
	var self = this;
	self.$workflow('clear', self.callback());
}

// Imports products from CSV
function json_products_import() {
	var self = this;
	var file = self.files[0];

	if (file.type !== 'text/xml' && file.type !== 'text/csv') {
		self.json(SUCCESS(false, 'The file type is not supported.'));
		return;
	}

	GETSCHEMA('Product').workflow2('import.' + file.type.substring(5), file.path, self.callback());
}

// Exports products to XML
function json_products_export() {
	var self = this;
	self.$workflow('export.xml', (err, response) => self.content(response, 'text/xml', { 'Content-Disposition': 'attachment; filename=products.xml' }));
}

// Reads all product categories and manufacturers
function json_products_codelists() {
	var self = this;

	if (!F.global.categories)
		F.global.categories = [];

	if (!F.global.manufacturers)
		F.global.manufacturers = [];

	var obj = {};
	obj.manufacturers = F.global.manufacturers;
	obj.categories = F.global.categories;
	self.json(obj);
}

// Replaces old category with new
function json_products_category_replace() {
	var self = this;
	self.$workflow('category', self.body, self.callback());
}

// Reads a specific product by ID
function json_products_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	self.$get(options, self.callback());
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
// ORDERS
// ==========================================================================

// Reads all orders
function json_orders_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

// Saves specific order (order must exist)
function json_orders_save() {
	var self = this;
	self.body.$save(self.callback());
}

// Removes specific order
function json_orders_remove() {
	var self = this;
	self.$remove(self.body.id, self.callback());
}

// Clears all orders
function json_orders_clear() {
	var self = this;
	self.$workflow('clear', self.callback());
}

// Reads a specific order by ID
function json_orders_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	self.$get(options, self.callback());
}

// ==========================================================================
// USERS
// ==========================================================================

// Reads all users
function json_users_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

// Saves specific user (user must exist)
function json_users_save() {
	var self = this;
	self.body.$save(self.callback());
}

// Removes specific user
function json_users_remove() {
	var self = this;
	self.$remove(self.body.id, self.callback());
}

// Reads a specific user by ID
function json_users_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	self.$get(options, self.callback());
}

// Clears all users
function json_users_clear() {
	var self = this;
	self.$workflow('clear', self.callback());
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