exports.install = function() {
	ROUTE('#popular', view_popular);
	ROUTE('#top', view_top);
	ROUTE('#new', view_new);
	ROUTE('#category', view_category);
	ROUTE('#detail', view_detail);
	ROUTE('#checkout');
	ROUTE('#order', view_order);
	ROUTE('#account', 'account', ['authorize']);
	ROUTE('#settings', 'settings', ['authorize']);
	ROUTE('#account', view_signin, ['unauthorize']);
	ROUTE('#logoff', redirect_logoff, ['authorize']);

	// Payment process
	ROUTE('#order/paypal/', paypal_process, ['*Order', 10000]);
};

function view_category() {
	var self = this;
	var url = self.sitemap_url('category');
	var linker = self.url.substring(url.length, self.url.length - 1);
	var category = null;

	if (linker !== '/') {
		category = F.global.categories.findItem('linker', linker);
		if (category == null) {
			self.throw404();
			return;
		}
	}

	// Binds a sitemap
	self.sitemap();

	var options = {};

	if (category) {
		options.category = category.linker;
		self.title(category.name);
		self.repository.category = category;

		var path = self.sitemap_url('category');
		var tmp = category;
		while (tmp) {
			self.sitemap_add('category', tmp.name, path + tmp.linker + '/');
			tmp = tmp.parent;
		}

	} else
		self.title(self.sitemap_name('category'));

	options.published = true;
	options.limit = 15;

	self.query.page && (options.page = self.query.page);
	self.query.manufacturer && (options.manufacturer = self.query.manufacturer);
	self.query.size && (options.size = self.query.size);
	self.query.color && (options.color = self.query.color);
	self.query.q && (options.search = self.query.q);
	self.query.sort && (options.sort = self.query.sort);

	$QUERY('Product', options, function(err, response) {
		self.repository.linker_category = linker;
		self.view('category', response);
	});
}

function view_popular() {
	var self = this;
	var options = {};
	options.published = true;
	self.query.manufacturer && (options.manufacturer = self.query.manufacturer);
	self.query.size && (options.size = self.query.size);
	self.sitemap();
	$WORKFLOW('Product', 'popular', options, self.callback('special'));
}

function view_new() {
	var self = this;
	var options = {};
	options.isnew = true;
	options.published = true;
	self.query.manufacturer && (options.manufacturer = self.query.manufacturer);
	self.query.size && (options.size = self.query.size);
	self.sitemap();
	$QUERY('Product', options, self.callback('special'));
}

function view_top() {
	var self = this;
	var options = {};
	options.istop = true;
	options.published = true;
	self.query.manufacturer && (options.manufacturer = self.query.manufacturer);
	self.query.size && (options.size = self.query.size);
	self.sitemap();
	$QUERY('Product', options, self.callback('special'));
}

function view_detail(linker) {
	var self = this;
	var options = {};
	options.linker = linker;

	$GET('Product', options, function(err, response) {

		if (err)
			return self.invalid().push(err);

		// Binds a sitemap
		self.sitemap();

		var path = self.sitemap_url('category');
		var tmp = response.category;

		while (tmp) {
			self.sitemap_add('category', tmp.name, path + tmp.linker + '/');
			tmp = tmp.parent;
		}

		// Category menu
		self.repository.linker_category = response.category.linker;

		self.title(response.name);
		self.sitemap_change('detail', 'url', linker);
		self.view('~cms/' + (response.template || 'product'), response);
	});
}

function view_order(id) {
	var self = this;
	var options = {};

	self.id = options.id = id;

	$GET('Order', options, function(err, response) {

		if (err) {
			self.invalid().push(err);
			return;
		}

		if (!response.ispaid) {
			switch (self.query.payment) {
				case 'paypal':
					paypal_redirect(response, self);
					return;
			}
		}

		self.sitemap('order');
		self.view('order', response);
	});
}

function redirect_logoff() {
	var self = this;
	MODEL('users').logoff(self, self.user);
	self.redirect(self.sitemap_url('account'));
}

function view_signin() {
	var self = this;
	var hash = self.query.hash;

	// Auto-login
	if (hash && hash.length) {
		var user = F.decrypt(hash);
		if (user && user.expire > F.datetime.getTime()) {
			MODEL('users').login(self, user.id);
			self.redirect(self.sitemap_url('settings') + '?password=1');
			return;
		}
	}

	self.sitemap();
	self.view('signin');
}

function paypal_redirect(order, controller) {
	var redirect = F.global.config.url + controller.sitemap_url('order', controller.id) + 'paypal/';
	var paypal = require('paypal-express-checkout').create(F.global.config.paypaluser, F.global.config.paypalpassword, F.global.config.paypalsignature, redirect, redirect, F.global.config.paypaldebug);
	paypal.pay(order.id, order.price, F.config.name, F.global.config.currency, function(err, url) {
		if (err) {
			LOGGER('paypal', order.id, err);
			controller.throw500(err);
		} else
			controller.redirect(url);
	});
}

function paypal_process(id) {

	var self = this;
	var redirect = F.global.config.url + self.url;
	var paypal = require('paypal-express-checkout').create(F.global.config.paypaluser, F.global.config.paypalpassword, F.global.config.paypalsignature, redirect, redirect, F.global.config.paypaldebug);

	self.id = id;

	paypal.detail(self, function(err, data) {

		LOGGER('paypal', self.id, JSON.stringify(data));

		var success = false;

		switch ((data.PAYMENTSTATUS || '').toLowerCase()) {
			case 'pending':
			case 'completed':
			case 'processed':
				success = true;
				break;
		}

		var url = self.sitemap_url('order', self.id);

		if (success)
			self.$workflow('paid', () => self.redirect(url + '?paid=1'));
		else
			self.redirect(url + '?paid=0');
	});
}