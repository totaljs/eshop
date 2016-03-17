// Online visitors counter
PING('GET /api/ping/');

$(document).ready(function() {

	if (window.localStorage) {
		// Loads last location (only for oauth2)
		var oauth2 = window.localStorage.getItem('oauth2');
		if (oauth2) {
			window.localStorage.setItem('oauth2', '');
			window.location.href = oauth2;
		}
	}

	var path = $('.breadcrumb a').eq(2).attr('href');
	if (path)
		$('.categories').find('a[href="' + path + '"]').addClass('selected');

	$(document).on('click', '.header-menu-button, .categories-button', function() {
		$('.categories').toggleClass('categories-toggle');
	});

	$(document).on('click', '.categories-button', function() {
		$('.categories').parent().toggleClass('categories-hide');
	});

	var buy = $('.detail-buy').on('click', function() {
		var el = $(this);
		var price = parseFloat(el.attr('data-price'));
		var id = el.attr('data-id');
		var checkout = FIND('checkout');
		checkout.append(id, price, 1);
		var target = $('.detail-checkout');
		target.find('.data-checkout-count').html(checkout.exists(id).count + 'x');
		target.slideDown(300);
	});

	// Is detail
	if (buy.length > 0) {
		setTimeout(function() {
			var item = FIND('checkout').exists(buy.attr('data-id'));
			if (!item)
				return;
			var target = $('.detail-checkout');
			target.find('.data-checkout-count').html(item.count + 'x');
			target.slideDown(300);
		}, 1000);
	}

	loading(false, 800);
});

COMPONENT('related', function() {
	var self = this;
	self.readonly();
	self.make = function() {
		$.components.GET('/api/products/', { html: 1, category: self.attr('data-category'), max: 8, skip: self.attr('data-id') }, function(response) {
			var parent = self.element.parent();
			if (parent.hasClass('hidden') && response.indexOf('id="empty"') === -1)
				parent.removeClass('hidden');
			self.html(response);
		});
	};
});

COMPONENT('emaildecode', function() {
	var self = this;
	self.readonly();
	self.make = function() {
		var m = self.element.html().replace(/\(\w+\)/g, function(value) {
			switch (value) {
				case '(at)':
					return '@';
				case '(dot)':
					return '.';
			}
			return value;
		});
		self.element.html('<a href="mailto:' + m + '">' + m + '</a>');
	};
});

COMPONENT('newsletter', function() {
	var self = this;
	var button;
	var input;

	self.readonly();
	self.make = function() {

		button = self.find('button');
		input = self.find('input');

		self.element.on('keydown', 'input', function(e) {
			if (e.keyCode !== 13)
				return;
			button.trigger('click');
		});

		button.on('click', function() {

			var mail = input.val();
			if (!mail.isEmail())
				return;

			$.components.POST('/api/newsletter/', { email: input.val() }, function(response) {

				if (response.success) {
					input.addClass('newsletter-success');
					input.val(self.attr('data-success'));
				}

				setTimeout(function() {
					input.val('');
					input.removeClass('newsletter-success');
				}, 3000);
			});
		});

	};
});

COMPONENT('checkout', function() {

	var self = this;
	var expiration = ((1000 * 60) * 60) * 168; // Valid for 7 days
	var currency = self.attr('data-currency');

	self.make = function() {
		self.refresh();
	};

	self.exists = function(id) {
		var cart = CACHE('cart');
		if (!cart)
			return;
		for (var i = 0, length = cart.length; i < length; i++) {
			if (cart[i].id === id)
				return cart[i];
		}
	};

	self.append = function(id, price, count) {
		var cart = CACHE('cart');
		var is = false;
		var counter = 0;

		if (cart) {
			for (var i = 0, length = cart.length; i < length; i++) {
				if (cart[i].id !== id)
					continue;
				cart[i].count += count;
				cart[i].price = price;
				is = true;
				break;
			}
		} else
			cart = [];

		if (!is)
			cart.push({ id: id, price: price, count: count });

		CACHE('cart', cart, expiration);
		self.refresh();
		return count;
	};

	self.update = function(id, count) {

		// Possible return values:
		// -1 = without change
		// 0  = removed
		// 1  = updated

		var cart = CACHE('cart');
		if (!cart)
			return -1;

		var removed = false;
		for (var i = 0, length = cart.length; i < length; i++) {
			var item = cart[i];
			if (item.id !== id)
				continue;

			if (count === item.count)
				return -1;

			if (count <= 0) {
				cart.splice(i, 1);
				removed = true;
			} else
				item.count = count;

			break;
		}
		CACHE('cart', cart, expiration);
		self.refresh(removed ? 1 : 0);
		return removed ? 1 : 0;
	};

	self.clear = function() {
		CACHE('cart', [], expiration);
		self.refresh(1);
	};

	self.read = function() {
		return CACHE('cart');
	};

	self.get = function(id) {
		var cart = CACHE('cart');
		if (!cart)
			return;
		return cart.findItem('id', id);
	};

	self.refresh = function() {

		var cart = CACHE('cart');
		if (!cart || !cart.length) {
			self.element.html(currency.format('0.00'));
			return;
		}

		var sum = 0;
		var count = 0;

		for (var i = 0, length = cart.length; i < length; i++) {
			sum += cart[i].price * cart[i].count;
			count += cart[i].count;
		}

		self.element.html(currency.format(sum.format(2)));
	};
});

function loading(visible, timeout) {
	var el = $('#loading');

	if (!visible && !el.length)
		return;

	if (!el.length) {
		$(document.body).append('<div id="loading"></div>');
		el = $('#loading');
	}

	setTimeout(function() {
		if (visible)
			el.fadeIn(500);
		else
			el.fadeOut(500);
	}, timeout || 0);
}
