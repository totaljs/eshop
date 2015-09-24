var common = {};
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Current page
common.page = '';

// Current form
common.form = '';

$(document).ready(function() {
	$('.jrouting').jRouting().each(function() {
		var el = $(this);
		var role = el.attr('data-role');
		if (su.roles.length > 0 && su.roles.indexOf(role) === -1)
			el.hide();
	});

	loading(false, 1000);
	$(window).on('resize', resizer);
	resizer();
});

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

jRouting.on('location', function(url) {
	var nav = $('nav');
	nav.find('.selected').removeClass('selected');
	nav.find('a[href="' + url + '"]').addClass('selected');
});

function loading(v, timeout) {
	setTimeout(function() {
		$('#loading').toggle(v);
	}, timeout || 0);
}

function resizer() {
	var h = $(window).height();
	var el = $('#body');
	var t = el.offset().top + 100;
	el.css('min-height', h - t);
}

function success() {
	loading(false, 1000);
	var el = $('#success');
	el.css({ top: '0%' }).fadeIn(100).animate({ top: '50%' }, 1000, 'easeOutBounce', function() {
		setTimeout(function() {
			el.fadeOut(300);
		}, 1000);
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
	return value.format(format) + ' ' + currency;
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

// CodeMirror HTML formatting
!function(){CodeMirror.extendMode("css",{commentStart:"/*",commentEnd:"*/",newlineAfterToken:function(e,t){return/^[;{}]$/.test(t)}}),CodeMirror.extendMode("javascript",{commentStart:"/*",commentEnd:"*/",newlineAfterToken:function(e,t,n,o){return this.jsonMode?/^[\[,{]$/.test(t)||/^}/.test(n):";"==t&&o.lexical&&")"==o.lexical.type?!1:/^[;{}]$/.test(t)&&!/^;/.test(n)}}),CodeMirror.extendMode("xml",{commentStart:"<!--",commentEnd:"-->",newlineAfterToken:function(e,t,n){return"tag"==e&&/>$/.test(t)||/^</.test(n)}}),CodeMirror.defineExtension("commentRange",function(e,t,n){var o=this,r=CodeMirror.innerMode(o.getMode(),o.getTokenAt(t).state).mode;o.operation(function(){if(e)o.replaceRange(r.commentEnd,n),o.replaceRange(r.commentStart,t),t.line==n.line&&t.ch==n.ch&&o.setCursor(t.line,t.ch+r.commentStart.length);else{var i=o.getRange(t,n),a=i.indexOf(r.commentStart),s=i.lastIndexOf(r.commentEnd);a>-1&&s>-1&&s>a&&(i=i.substr(0,a)+i.substring(a+r.commentStart.length,s)+i.substr(s+r.commentEnd.length)),o.replaceRange(i,t,n)}})}),CodeMirror.defineExtension("autoIndentRange",function(e,t){var n=this;this.operation(function(){for(var o=e.line;o<=t.line;o++)n.indentLine(o,"smart")})}),CodeMirror.defineExtension("autoFormatRange",function(e,t){function n(){c+="\n",m=!0,++d}for(var o=this,r=o.getMode(),i=o.getRange(e,t).split("\n"),a=CodeMirror.copyState(r,o.getTokenAt(e).state),s=o.getOption("tabSize"),c="",d=0,m=0==e.ch,l=0;l<i.length;++l){for(var f=new CodeMirror.StringStream(i[l],s);!f.eol();){var g=CodeMirror.innerMode(r,a),u=r.token(f,a),M=f.current();f.start=f.pos,(!m||/\S/.test(M))&&(c+=M,m=!1),!m&&g.mode.newlineAfterToken&&g.mode.newlineAfterToken(u,M,f.string.slice(f.pos)||i[l+1]||"",g.state)&&n()}!f.pos&&r.blankLine&&r.blankLine(a),m||n()}o.operation(function(){o.replaceRange(c,e,t);for(var n=e.line+1,r=e.line+d;r>=n;++n)o.indentLine(n,"smart");o.setSelection(e,o.getCursor(!1))})})}();