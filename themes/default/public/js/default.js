UPTODATE('1 day');

var common = {};

// Online statistics for visitors
(function() {

	if (navigator.onLine != null && !navigator.onLine)
		return;

	var options = {};
	options.type = 'GET';
	options.headers = { 'x-ping': location.pathname, 'x-cookies': navigator.cookieEnabled ? '1' : '0', 'x-referrer': document.referrer };

	options.success = function(r) {
		if (r) {
			try {
				(new Function(r))();
			} catch (e) {}
		}
	};

	options.error = function() {
		setTimeout(function() {
			location.reload(true);
		}, 2000);
	};

	var url = '/$visitors/';
	var param = MAIN.parseQuery();
	$.ajax(url + (param.utm_medium || param.utm_source || param.campaign_id ? '?utm_medium=1' : ''), options);
	return setInterval(function() {
		options.headers['x-reading'] = '1';
		$.ajax(url, options);
	}, 30000);
})();

$(document).ready(function() {

	refresh_category();
	refresh_prices();

	$(document).on('click', '.addcart', function() {
		var btn = $(this);
		SETTER('shoppingcart', 'add', btn.attrd('id'), +btn.attrd('price'), 1, btn.attrd('name'), btn.attrd('idvariant'), btn.attrd('variant'));
		setTimeout(refresh_addcart, 200);
	});

	$(document).on('focus', '#search', function() {
		var param = {};
		SETTER('autocomplete', 'attach', $(this), function(query, render) {

			if (query.length < 3) {
				render(EMPTYARRAY);
				return;
			}

			param.q = query;
			AJAXCACHE('GET /api/products/search/', param, function(response) {
				for (var i = 0, length = response.length; i < length; i++)
					response[i].type = response[i].category;
				render(response);
			}, '2 minutes');

		}, function(value) {
			location.href = value.linker;
		}, 15, -11, 72);
	});

	$(document).on('click', '#mainmenu', function() {
		$('.categoriescontainer').tclass('categoriesvisible');
		$(this).find('.fa').tclass('fa-chevron-down fa-chevron-up');
	});

	$('.emailencode').each(function() {
		var el = $(this);
		el.html('<a href="mailto:{0}">{0}</a>'.format(el.html().replace(/\(at\)/g, '@').replace(/\(dot\)/g, '.')));
	});
});

ON('@shoppingcart', refresh_addcart);

SETTER(true, 'modificator', 'register', 'shoppingcart', function(value, element, e) {
	if (e.type === 'init')
		return;
	if (e.animate)
		return;
	element.aclass('animate');
	e.animate = setTimeout(function() {
		e.animate = null;
		element.rclass('animate');
	}, 500);
});

function refresh_addcart() {
	var com = FIND('shoppingcart');
	$('.addcart').each(function() {
		var el = $(this);
		com.has(el) && el.aclass('is').find('.fa').rclass2('fa-').aclass('fa-check-circle');
	});
}

function refresh_category() {
	var el = $('#categories');
	var linker = el.attrd('url');
	el.find('a').each(function() {
		var el = $(this);
		if (linker.indexOf(el.attr('href')) !== -1) {
			el.aclass('selected');
			var next = el.next();
			if (next.length && next.is('nav'))
				el.find('.fa').rclass('fa-caret-right').aclass('fa-caret-down');
		}
	});
}

function refresh_prices() {

	var items = $('.product');
	if (!items.length)
		return;

	FIND('shoppingcart', function(com) {
		var discount = com.config.discount;
		items.each(function() {

			var t = this;

			if (t.$priceprocessed)
				return;

			t.$priceprocessed = true;

			var el = $(t);
			var price = +el.attrd('new');
			var priceold = +el.attrd('old');
			var currency = el.attrd('currency');
			var p;

			if (discount)
				p = discount;
			else if (priceold && price < priceold)
				p = 100 - (price / (priceold / 100));

			p && el.prepend('<div class="diff">-{0}%</div>'.format(p.format(0)));

			if (discount) {
				var plus = p ? '<span>{0}</span>'.format(currency.format(price.format(2))) : '';
				el.find('.price > div').html(currency.format(price.inc('-' + discount + '%').format(2)) + plus);
			}
		});

		setTimeout(function() {
			items.find('.diff').each(function(index) {
				setTimeout(function(el) {
					el.aclass('animate');
				}, index * 100, $(this));
			});
		}, 1000);
	});
}