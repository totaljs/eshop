var PayPal = require('paypal-express-checkout');

exports.install = function() {
	// PRODUCTS
	F.route('/shop/',                     view_products);
	F.route('/shop/{category}/*',         view_products_category);
	F.route('/product/{linker}/',         view_products_detail);

	// ORDERS
	F.route('/checkout/');
	F.route('/checkout/{linker}/',        view_checkout);
	F.route('/checkout/{linker}/paypal/', process_payment_paypal);

	// USER ACCOUNT
	F.route('/account/',                  view_account, ['authorized']);
	F.route('/account/logoff/',           redirect_account_logoff, ['authorized']);
	F.route('/account/',                  'account-oauth2', ['unauthorized']);
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

	options.category = self.req.path.slice(1).join('/');

	var category = F.global.categories.find('linker', options.category);;
	if (!category)
		return self.throw404();

	if (self.query.page)
		options.page = self.query.page;

	self.repository.category = category;

	// Increases the performance (1 minute cache)
	self.memorize('cache.' + category + '.' + options.page, '1 minute', DEBUG, function() {
		GETSCHEMA('Product').query(options, function(err, data) {

			if (data.items.length === 0)
				return self.throw404();

			self.repository.subcategories = F.global.categories.where('parent', options.category);
			self.title(category.name);
			self.view('products-category', data);
		});
	});
}

// Gets product detail
function view_products_detail(linker) {
	var self = this;
	var options = {};

	options.linker = linker;

	// Increases the performance (1 minute cache)
	self.memorize('cache.product.' + linker, '1 minute', DEBUG, function() {
		GETSCHEMA('Product').get(options, function(err, data) {

			if (!data || err)
				return self.throw404();

			self.repository.category = F.global.categories.find('linker', data.linker_category);

			if (!self.repository.category)
				return self.throw404();

			self.repository.subcategories = F.global.categories.where('parent', data.linker_category);
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

// ============================================
// ACCOUNT
// ============================================

function view_account() {
	var self = this;
	var model = {};
	var options = {};

	options.type = 0;
	options.iduser = self.user.id;
	options.max = 100;

	// Reads all orders
	GETSCHEMA('Order').query(options, self.callback('account'));
}

// Logoff
function redirect_account_logoff() {
	var self = this;
	MODEL('users').logoff(self.req, self.res, self.user);
	self.redirect('/account/');
}