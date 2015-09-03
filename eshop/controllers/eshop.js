var PayPal = require('paypal-express-checkout');

exports.install = function() {
	// PRODUCTS
	F.route('/shop/',                     view_products);
	F.route('/shop/{category}/',          view_products_category);
	F.route('/shop/{category}/{linker}/', view_products_detail);

	// ORDERS
	F.route('/checkout/');
	F.route('/checkout/{linker}/',        view_checkout);
	F.route('/checkout/{linker}/paypal/', process_payment_paypal);
};

// ============================================
// PRODUCTS
// ============================================

// Gets products
function view_products() {
	var self = this;
	var options = {};

	if (self.query.q)
		options.search = self.query.q;

	if (self.query.page)
		options.page = self.query.page;

	// Increases the performance (1 minute cache)
	self.memorize('cache.' + options.page + (self.query.q ? self.query.q : ''), '1 minute', DEBUG || options.search !== undefined, function() {
		GETSCHEMA('Product').query(options, self.callback('products-all'));
	});
}

// Gets products by category
function view_products_category(category) {
	var self = this;
	var options = {};

	if (category)
		options.category = category;

	if (self.query.page)
		options.page = self.query.page;

	// Increases the performance (1 minute cache)
	self.memorize('cache.' + category + '.' + options.page, '1 minute', DEBUG, function() {
		GETSCHEMA('Product').query(options, function(err, data) {

			if (data.items.length === 0)
				return self.throw404();

			self.repository.linker_category = category;
			self.repository.category = data.items[0].category;

			self.title(data.items[0].category);
			self.view('products-category', data);
		});
	});
}

// Gets product detail
function view_products_detail(category, linker) {
	var self = this;
	var options = {};

	options.category = category;
	options.linker = linker;

	// Increases the performance (1 minute cache)
	self.memorize('cache.' + category + '.' + linker, '1 minute', DEBUG, function() {
		GETSCHEMA('Product').get(options, function(err, data) {

			if (!data || err)
				return self.throw404();

			self.repository.linker_category = category;
			self.repository.category = data.category;

			self.repository.linker = linker;
			self.repository.name = data.name;

			self.view('products-detail', data);
		});
	});
}

// ============================================
// ORDERS
// ============================================

// Gets order detail
function view_checkout(linker) {
	var self = this;
	var options = {};

	options.id = linker;

	GETSCHEMA('Order').get(options, function(err, data) {

		if (err || !data)
			return self.throw404();

		// Payment
		// ?pay=1 ---> redirect to PayPal if the order is not paid
		if (self.query.pay === '1' && !data.ispaid) {
			var redirect = F.config.custom.url + self.url + 'paypal/';
			var paypal = PayPal.create(F.config.custom.paypaluser, F.config.custom.paypalpassword, F.config.custom.paypalsignature, redirect, redirect, F.config.custom.paypaldebug);
			paypal.pay(data.id, data.price, F.config.name, F.config.custom.currency, function(err, url) {
				if (err)
					return self.throw500(err);
				self.redirect(url);
			});
			return;
		}

		self.view('checkout-detail', data);
	});
}

// Processes PayPal payment
function process_payment_paypal(linker) {
	var self = this;
	var redirect = F.config.custom.url + self.url;
	var paypal = PayPal.create(F.config.custom.paypaluser, F.config.custom.paypalpassword, F.config.custom.paypalsignature, redirect, redirect, F.config.custom.paypaldebug);

	paypal.detail(self, function(err, data, id, price) {

		if (err)
			return self.throw500(err);

		var success = false;

		switch ((data.PAYMENTSTATUS || '').toLowerCase()) {
			case 'pending':
			case 'completed':
			case 'processed':
				success = true;
				break;
		}

		if (!success)
			return self.view('checkout-error');

		GETSCHEMA('Order').workflow('paid', null, linker, function() {
			self.redirect('../?success=1');
		}, true);
	});
}