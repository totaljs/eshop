// API for e.g. Mobile application
// This API uses the website

exports.install = function() {
	// ORDERS
	F.route('/api/checkout/create/',      json_orders_create, ['post', '*Order']);
	F.route('/api/checkout/{id}/',        json_orders_read);

	// PRODUCTS
	F.route('/api/products/',             json_products_query);
	F.route('/api/products/{id}/',        json_products_read);
	F.route('/api/products/categories/',  json_products_categories);

	// NEWSLETTER
	F.route('/api/newsletter/',           json_newsletter, ['post', '*Newsletter']);

	// CONTACTFORM
	F.route('/api/contact/',              json_contact, ['post', '*Contact']);
};

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

		GETSCHEMA('Product').query(self.query, self.callback('~eshop/partial-products'));
		return;
	}

	GETSCHEMA('Product').query(self.query, self.callback());
}

// Reads a specific product
function json_products_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	GETSCHEMA('Product').get(options, self.callback());
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
	self.body.ip = self.ip;
	self.body.$workflow('create', self.callback());
}

// Reads a specific order
function json_orders_read(id) {
	var self = this;
	var options = {};
	options.id = id;
	GETSCHEMA('Order').get(options, self.callback());
}

// ==========================================================================
// NEWSLETTER
// ==========================================================================

// Appends a new email into the newsletter list
function json_newsletter() {
	var self = this;
	self.body.language = self.language || '';
	self.body.ip = self.ip;
	self.body.$save(self.callback());
}

// ==========================================================================
// CONTACTFORM
// ==========================================================================

// Processes the contact form
function json_contact() {
	var self = this;
	self.body.language = self.language || '';
	self.body.ip = self.ip;
	self.body.$save(self.callback());
}