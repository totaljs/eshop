var common = {};

// Current page
common.page = '';

// Current form
common.form = '';

$(document).ready(function() {
	jR.clientside('.jrouting');
	$('.jrouting').each(function(index) {
		var el = $(this);
		(function(el) {
			setTimeout(function() {
				el.toggleClass('hidden', su.roles.length && su.roles.indexOf(el.attr('data-role')) === -1);
			}, index * 200);
		})(el);
	});

	FIND('loading', function() {
		this.hide(500);
	});

	$(window).on('resize', resizer);
	resizer();
});

function isError(arguments) {
	return false;
}

// Because of login form
if (window.su) {
	jRouting.route(managerurl + '/', function() {

		if (can('dashboard')) {
			SET('common.page', 'dashboard');
			return;
		}

		jRouting.redirect(managerurl + '/' + su.roles[0] + '/');
	});

	if (can('orders')) {
		jRouting.route(managerurl + '/orders/', function() {
			SET('common.page', 'orders');
		});
	}

	if (can('posts')) {
		jRouting.route(managerurl + '/posts/', function() {
			SET('common.page', 'posts');
		});
	}

	if (can('products')) {
		jRouting.route(managerurl + '/products/', function() {
			SET('common.page', 'products');
		});
	}

	if (can('newsletter')) {
		jRouting.route(managerurl + '/newsletter/', function() {
			SET('common.page', 'newsletter');
		});
	}

	if (can('settings')) {
		jRouting.route(managerurl + '/settings/', function() {
			SET('common.page', 'settings');
		});
	}

	if (can('users')) {
		jRouting.route(managerurl + '/users/', function() {
			SET('common.page', 'users');
		});
	}

	if (can('pages')) {
		jRouting.route(managerurl + '/pages/', function() {
			SET('common.page', 'pages');
		});
	}

	if (can('system')) {
		jRouting.route(managerurl + '/system/', function() {
			SET('common.page', 'system');
		});
	}
}

jRouting.on('location', function(url) {
	var nav = $('header nav');
	nav.find('.selected').removeClass('selected');
	nav.find('a[href="' + url + '"]').addClass('selected');
});

function resizer() {
	var h = $(window).height();
	var el = $('#body');
	if (!el.length)
		return;
	var t = el.offset().top + 100;
	el.css('min-height', h - t);
}

function success() {
	var el = $('#success');
	FIND('loading').hide(500);
	el.css({ right: '90%' }).delay(500).fadeIn(100).animate({ right: '0%' }, 1000, 'easeOutBounce', function() {
		setTimeout(function() {
			el.fadeOut(200);
		}, 800);
	});
}

function can(name) {
	if (su.roles.length === 0)
		return true;
	return su.roles.indexOf(name) !== -1;
}

Tangular.register('price', function(value, format) {
	if (value === undefined)
		value = 0;
	return currency.format(value.format(format));
});

Tangular.register('join', function(value) {
	if (value instanceof Array)
		return value.join(', ');
	return '';
});

Tangular.register('default', function(value, def) {
	if (value === undefined || value === null || value === '')
		return def;
	return value;
});

jQuery.easing.easeOutBounce = function(e, f, a, h, g) {
	if ((f /= g) < (1 / 2.75)) {
		return h * (7.5625 * f * f) + a
	} else {
		if (f < (2 / 2.75)) {
			return h * (7.5625 * (f -= (1.5 / 2.75)) * f + 0.75) + a
		} else {
			if (f < (2.5 / 2.75)) {
				return h * (7.5625 * (f -= (2.25 / 2.75)) * f + 0.9375) + a
			} else {
				return h * (7.5625 * (f -= (2.625 / 2.75)) * f + 0.984375) + a
			}
		}
	}
};

function getSelectionStartNode(context){
	if (!context.getSelection)
		return;
	var node = context.getSelection().anchorNode;
	var startNode = (node.nodeName == "#text" ? node.parentNode : node);
	return startNode;
}

function mainmenu() {
	$('header nav').toggleClass('mainmenu-visible');
}

jRouting.on('location', function() {
	$('header nav').removeClass('mainmenu-visible');
});
