// Trims empty fields
languages = languages.trim();

var common = {};

// Current page
common.page = '';

// Current form
common.form = '';

$(document).ready(function() {
	jR.clientside('.jrouting');

	$('.jrouting').each(function(index) {
		var el = $(this);
		(function(el) { setTimeout(function() {
				el.toggleClass('hidden', su.roles.length && su.roles.indexOf(el.attr('data-role')) === -1);
			}, 120 * index);
		})(el);
	});

	FIND('loading', FN('() => this.hide(800)'));
	$(window).on('resize', resizer);
	resizer();
});

// Because of login form
if (window.su) {
	jR.route(managerurl + '/', function() {
		if (can('dashboard'))
			SET('common.page', 'dashboard');
		else
			jR.redirect('{0}/{1}/'.format(managerurl, su.roles[0]));
	});

	can('orders') && jRouting.route(managerurl + '/orders/', function() {
		SET('common.page', 'orders');
	});

	can('posts') && jRouting.route(managerurl + '/posts/', function() {
		SET('common.page', 'posts');
	});

	can('products') && jRouting.route(managerurl + '/products/', function() {
		SET('common.page', 'products');
	});

	can('newsletter') && jRouting.route(managerurl + '/newsletter/', function() {
		SET('common.page', 'newsletter');
	});

	can('settings') && jRouting.route(managerurl + '/settings/', function() {
		SET('common.page', 'settings');
	});

	can('users') && jRouting.route(managerurl + '/users/', function() {
		SET('common.page', 'users');
	});

	can('pages') && jRouting.route(managerurl + '/pages/', function() {
		SET('common.page', 'pages');
	});

	can('system') && jRouting.route(managerurl + '/system/', function() {
		SET('common.page', 'system');
	});
}

jR.on('location', function(url) {
	url = url.split('/');
	var nav = $('header nav');
	nav.find('.selected').removeClass('selected');
	nav.find('a[href="' + '/' + url[1] + '/' + (url[2] && url[2] + '/') + '"]').addClass('selected');
});

function resizer() {
	var h = $(window).height();
	var el = $('#body');
	if (el.length) {
		var t = el.offset().top + 100;
		el.css('min-height', h - t);
	}
}

function success() {
	var el = $('#success');
	el.show();
	el.addClass('success-animation');
	setTimeout(function() {
		el.removeClass('success-animation');
		setTimeout(function() {
			el.hide();
		}, 1000);
	}, 1500);
	FIND('loading').hide(500);
}

function can(name) {
	return su.roles.length ? su.roles.indexOf(name) !== -1 : true;
}

Tangular.register('price', function(value, format) {
	return currency.format((value || 0).format(format));
});

Tangular.register('join', function(value, delimiter) {
	return value instanceof Array ? value.join(delimiter || ', ') : '';
});

Tangular.register('default', function(value, def) {
	return value == null || value === '' ? def : value;
});

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

jR.on('location', function() {
	$('header nav').removeClass('mainmenu-visible');
});
