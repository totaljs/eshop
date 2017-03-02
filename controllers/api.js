// API for e.g. Mobile application
// This API uses the website

exports.install = function() {
	// COMMON
	F.route('/api/ping/',                 json_ping);

	// ORDERS
	F.route('/api/checkout/create/',      json_orders_create, ['post', '*Order']);
	F.route('/api/checkout/{id}/',        json_orders_read, ['*Order']);

	// USERS
	F.route('/api/users/create/',         json_users, ['post', '*UserRegistration']);
	F.route('/api/users/password/',       json_users, ['post', '*UserPassword']);
	F.route('/api/users/login/',          json_users, ['post', '*UserLogin']);
	F.route('/api/users/settings/',       json_users_settings, ['put', '*UserSettings', 'authorize']);

	// PRODUCTS
	F.route('/api/products/',             json_products_query, ['*Product']);
	F.route('/api/products/{id}/',        json_products_read, ['*Product']);
	F.route('/api/products/categories/',  json_products_categories);

	// NEWSLETTER
	F.route('/api/newsletter/',           json_save, ['post', '*Newsletter']);

	// CONTACTFORM
	F.route('/api/contact/',              json_save, ['post', '*Contact']);
};

// ==========================================================================
// COMMON
// ==========================================================================

function json_ping() {
	var self = this;
	self.plain('null');
}

// ==========================================================================
// PRODUCTS
// ==========================================================================

// Reads product categories
function json_products_categories() {
	var self = this;

	if (!F.global.categories)
		F.global.categories = [];

	self.json(F.global.categories);
}

// Reads products
function json_products_query() {
	var self = this;

	// Renders related products
	if (self.query.html) {
		// Disables layout
		self.layout('');
		self.$query(self.query, self.callback('~eshop/partial-products'));
		return;
	}

	self.$query(self.query, self.callback());
}

// Reads a specific product
function json_products_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	self.$get(options, self.callback());
}

// Reads all product categories
function json_products_categories() {
	var self = this;

	if (!F.global.categories)
		F.global.categories = [];

	self.json(F.global.categories);
}

// ==========================================================================
// ORDERS
// ==========================================================================

// Creates a new order
function json_orders_create() {
	var self = this;
	self.body.$workflow('create', self.callback());
}

// Reads a specific order
function json_orders_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	self.$get(options, self.callback());
}

// ==========================================================================
// USERS
// ==========================================================================

function json_users() {
	var self = this;
	var options = {};

	options.controller = self;
	options.ip = self.ip;

	self.body.$workflow('exec', options, self.callback());
}

function json_users_settings() {
	var self = this;
	var options = {};
	options.controller = self;
	self.body.id = self.user.id;
	self.body.$save(options, self.callback());
}

// ==========================================================================
// NEWSLETTER & CONTACTFORM
// ==========================================================================

// Appends a new email into the newsletter list
function json_save() {
	var self = this;
	self.body.$save(self.callback());
}