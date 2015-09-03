$(document).ready(function() {
	var path = window.location.pathname.substring(1).split('/');
	$('.categories').find('a[href="/' + path[0] + '/' + path[1] + '/"]').addClass('selected');

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

	setTimeout(function() {
		$('#loading').fadeOut(300);
	}, 800);
});

COMPONENT('related', function() {
	var self = this;
	self.readonly();
	self.make = function() {
		$.components.GET('/api/products/', { html: 1, category: self.attr('data-category'), max: 8, skip: self.attr('data-id') }, function(response) {
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
			if (!mail.match(/^[a-z0-9A-Z_\.]+@[0-9a-zA-Z_]+?\.[a-zA-Z]{2,3}$/))
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
	var expiration = ((1000 * 60) * 60) * 168;
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
		return count
	};

	self.update = function(id, count) {
		var cart = CACHE('cart');
		if (!cart)
			return;

		for (var i = 0, length = cart.length; i < length; i++) {
			var item = cart[i];
			if (item.id !== id)
				continue;

			if (count === item.count)
				return;

			if (count <= 0)
				cart.splice(i, 1);
			else
				item.count = count;
			break;
		}

		CACHE('cart', cart, expiration);
		self.refresh();
	};

	self.clear = function() {
		CACHE('cart', [], expiration);
		self.refresh();
	};

	self.read = function() {
		return CACHE('cart');
	};

	self.refresh = function() {

		var cart = CACHE('cart');
		if (!cart || cart.length === 0) {
			self.element.addClass('hidden-xs');
			self.element.html('0.00 ' + currency);
			return;
		}

		self.element.removeClass('hidden-xs');

		var sum = 0;
		var count = 0;

		for (var i = 0, length = cart.length; i < length; i++) {
			sum += cart[i].price * cart[i].count;
			count += cart[i].count;
		}

		self.element.html(sum.format(2) + ' ' + currency);
	};

});