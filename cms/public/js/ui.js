COMPONENT('click', function() {
	var self = this;

	self.make = function() {

		self.element.on('click', function() {
			self.get(self.attr('data-component-path'))();
		});

		var enter = self.attr('data-enter');
		if (!enter)
			return;
		$(enter).on('keydown', 'input', function(e) {
			if (e.keyCode !== 13)
				return;
			setTimeout(function() {
				if (self.element.get(0).disabled === true)
					return;
				self.get(self.attr('data-component-path'))();
			}, 100);
		});
	};

	self.readonly();
});

COMPONENT('visible', function() {
	var self = this;
	var condition = self.attr('data-if');
	self.readonly();
	self.setter = function(value) {

		var is = true;

		if (condition)
			is = EVALUATE(self.path, condition);
		else
			is = value ? true : false;

		self.element.toggleClass('hidden', !is);
	};
});

COMPONENT('message', function() {
	var self = this;
	var is = false;
	var visible = false;
	var timer;

	self.readonly();
	self.singleton();

	self.make = function() {
		self.element.addClass('ui-message hidden');

		self.element.on('click', 'button', function() {
			self.hide();
		});

		$(window).on('keyup', function(e) {
			if (!visible)
				return;
			if (e.keyCode === 27)
				self.hide();
		});
	};

	self.warning = function(message, icon) {
		self.content('ui-message-warning', message, icon || 'fa-warning');
	};

	self.success = function(message, icon) {
		self.content('ui-message-success', message, icon || 'fa-check-circle');
	};

	self.hide = function() {
		self.element.removeClass('ui-message-visible');
		if (timer)
			clearTimeout(timer);
		timer = setTimeout(function() {
			visible = false;
			self.element.addClass('hidden');
		}, 1000);
	};

	self.content = function(cls, text, icon) {

		if (!is)
			self.element.html('<div><div class="ui-message-body"><span class="fa fa-warning"></span><div class="ui-center"></div></div><button>' + (self.attr('data-button') || 'Close') + '</button></div>');

		if (timer)
			clearTimeout(timer);

		visible = true;
		self.element.find('.ui-message-body').removeClass().addClass('ui-message-body ' + cls);
		self.element.find('.fa').removeClass().addClass('fa ' + icon);
		self.element.find('.ui-center').html(text);
		self.element.removeClass('hidden');
		setTimeout(function() {
			self.element.addClass('ui-message-visible');
		}, 5);
	};
});

COMPONENT('validation', function() {

	var self = this;
	var path = self.path;
	var buttons;

	if (path.lastIndexOf('*') === -1)
		path += '.*';

	self.readonly();

	self.make = function() {
		buttons = self.element.find('button');
		buttons.prop({ disabled: true });
		self.evaluate = self.attr('data-if');
		self.watch(self.path, function() {
			var disabled = $.components.disable(path);
			if (!disabled && self.evaluate)
				disabled = !EVALUATE(self.path, self.evaluate);
			buttons.prop({ disabled: disabled });
		}, true);
	};

	self.state = function() {
		var disabled = $.components.disable(path);
		if (!disabled && self.evaluate)
			disabled = !EVALUATE(self.path, self.evaluate);
		buttons.prop({ disabled: disabled });
	};
});

COMPONENT('checkbox', function() {

	var self = this;
	var isRequired = self.element.attr('data-required') === 'true';

	self.validate = function(value) {
		var is = false;
		var t = typeof(value);

		if (t === 'undefined' || t === 'object')
			value = '';
		else
			value = value.toString();

		is = isRequired ? value === 'true' || value === 'on' : true;
		return is;
	};

	self.make = function() {
		var element = self.element;
		var html = '<label><input type="checkbox" data-component-bind="" /> <span' + (isRequired ? ' class="ui-checkbox-label-required"' : '') + '>' + element.html() + '</span></label>';
		element.addClass('ui-checkbox');
		element.html(html);
	};
});

COMPONENT('dropdown', function() {

	var self = this;
	var isRequired = self.attr('data-required') === 'true';

	self.validate = function(value) {

		if (value === null || value === undefined || typeof(value) === 'object')
			value = '';
		else
			value = value.toString();

		return isRequired ? self.type === 'number' ? value > 0 : value.length > 0 : true;
	};

	self.render = function(arr) {

		var builder = [];
		var value = self.get();
		var el = self.find('select').empty();
		var kt = self.attr('data-source-text') || 'name';
		var kv = self.attr('data-source-value') || 'id';

		if (self.attr('data-empty') === 'true')
			builder.push('<option value="">' + (self.attr('data-empty-text') || '') + '</option>');

		for (var i = 0, length = arr.length; i < length; i++) {
			var item = arr[i];
			if (typeof(item) === 'string')
				builder.push('<option value="' + item + '"' + (value == item ? ' selected="selected"' : '') + '>' + item + '</option>');
			else
				builder.push('<option value="' + item[kv] + '"' + (value == item[kv] ? ' selected="selected"' : '') + '>' + item[kt] + '</option>');
		}

		var disabled = arr.length === 0;
		el.parent().toggleClass('ui-disabled', disabled);
		el.prop('disabled', disabled);
		el.html(builder.join(''));
	};

	self.make = function() {

		var options = [];
		var element = self.element;
		var arr = (element.attr('data-options') || '').split(';');

		for (var i = 0, length = arr.length; i < length; i++) {
			var item = arr[i].split('|');
			options.push('<option value="' + (item[1] === undefined ? item[0] : item[1]) + '">' + item[0] + '</option>');
		}

		self.element.addClass('ui-dropdown-container');

		var content = element.html();
		var icon = element.attr('data-icon');
		var html = '<div class="ui-dropdown"><span class="fa fa-sort"></span><select data-component-bind="">' + options.join('') + '</select></div>';

		if (content.length > 0) {
			element.empty();
			element.append('<div class="ui-dropdown-label' + (isRequired ? ' ui-dropdown-label-required' : '') + '">' + (icon ? '<span class="fa ' + icon + '"></span> ' : '') + content + ':</div>');
			element.append('<div class="ui-dropdown-values">' + html + '</div>');
		} else {
			element.addClass('ui-dropdown-values');
			element.append(html);
		}

		var datasource = element.attr('data-source');
		if (!datasource)
			return;

		var prerender = function(path) {
			var value = self.get(datasource);
			if (NOTMODIFIED(self.id, value))
				return;
			if (value === undefined || value === null)
				value = [];
			self.render(value);
		};

		self.watch(datasource, prerender, true);
	};

	self.state = function(type) {
		self.find('.ui-dropdown').toggleClass('ui-dropdown-invalid', self.isInvalid());
	};
});

COMPONENT('textbox', function() {

	var self = this;
	var isRequired = self.attr('data-required') === 'true';

	self.validate = function(value) {

		var is = false;
		var t = typeof(value);

		if (self.find('input').prop('disabled'))
			return true;

		if (t === 'undefined' || t === 'object')
			value = '';
		else
			value = value.toString();

		if (window.$calendar)
			window.$calendar.hide();
		is = isRequired ? self.type === 'email' ? value.isEmail() : self.type === 'currency' ? value > 0 : value.length > 0 : true;
		return is;
	};

	self.make = function() {

		var attrs = [];

		function attr(name) {
			var a = self.element.attr(name);
			if (!a)
				return;
			attrs.push(name.substring(name.indexOf('-') + 1) + '="' + a + '"');
		}

		attr('data-placeholder');
		attr('data-maxlength');

		var content = self.html();
		var icon = self.attr('data-icon');
		var align = self.attr('data-align');
		var cicon = self.attr('data-control-icon');
		var delay = self.attr('data-component-keypress-delay');
		var keypress = self.attr('data-component-keypress');
		var increment = self.attr('data-increment') === 'true';

		if (self.type === 'date' && !cicon)
			cicon = 'fa-calendar';

		var html = '<input' + (keypress ? ' data-component-keypress="' + keypress + '"' : '') + (delay ? ' data-component-keypress-delay="' + delay + '"' : '') + ' type="' + (self.type === 'password' ? 'password' : 'text') + '" data-component-bind=""' + (attrs.length ? ' ' + attrs.join('') : '') + (align ? ' class="ui-' + align + '"' : '')  + (self.attr('data-autofocus') === 'true' ? ' autofocus="autofocus"' : '') + ' />' + (cicon ? '<div><span class="fa ' + cicon + '"></span></div>' : increment ? '<div><span class="fa fa-caret-up"></span><span class="fa fa-caret-down"></span></div>' : '');

		if (increment) {
			self.element.on('click', '.fa-caret-up,.fa-caret-down', function(e) {
				var el = $(this);
				var inc = -1;
				if (el.hasClass('fa-caret-up'))
					inc = 1;
				self.change(true);
				self.inc(inc);
			});
		}

		if (self.type === 'date') {
			self.element.on('click', '.fa-calendar', function(e) {
				e.preventDefault();
				if (!window.$calendar)
					return;
				var el = $(this);
				window.$calendar.toggle(el.parent().parent(), self.element.find('input').val(), function(date) {
					self.set(date);
				});
			});
		}

		if (content.length === 0) {
			self.element.addClass('ui-textbox ui-textbox-container');
			self.element.append(html);
			return;
		}

		self.element.empty();
		self.element.addClass('ui-textbox-container');
		self.element.append('<div class="ui-textbox-label' + (isRequired ? ' ui-textbox-label-required' : '') + '">' + (icon ? '<span class="fa ' + icon + '"></span> ' : '') + content + ':</div><div class="ui-textbox">' + html + '</div>');
	};

	self.state = function(type) {
		self.find('.ui-textbox').toggleClass('ui-textbox-invalid', self.isInvalid());
	};
});

COMPONENT('textarea', function() {

	var self = this;
	var isRequired = self.attr('data-required') === 'true';

	this.validate = function(value) {
		var is = false;
		var t = typeof(value);

		if (t === 'undefined' || t === 'object')
			value = '';
		else
			value = value.toString();

		is = isRequired ? self.type === 'number' ? value > 0 : value.length > 0 : true;
		return is;
	};

	self.make = function() {

		var attrs = [];

		function attr(name) {
			var a = self.attr(name);
			if (!a)
				return;
			attrs.push(name.substring(name.indexOf('-') + 1) + '="' + a + '"');
		}

		attr('data-placeholder');
		attr('data-maxlength');

		var element = self.element;
		var height = element.attr('data-height');
		var icon = element.attr('data-icon');
		var content = element.html();
		var html = '<textarea data-component-bind=""' + (attrs.length > 0 ? ' ' + attrs.join('') : '') + (height ? ' style="height:' + height + '"' : '') + (element.attr('data-autofocus') === 'true' ? ' autofocus="autofocus"' : '') + '></textarea>';

		if (content.length === 0) {
			element.addClass('ui-textarea');
			element.append(html);
			return;
		}

		element.empty();
		element.append('<div class="ui-textarea-label' + (isRequired ? ' ui-textarea-label-required' : '') + '">' + (icon ? '<span class="fa ' + icon + '"></span> ' : '') + content + ':</div>');
		element.append('<div class="ui-textarea">' + html + '</div>');
	};

	self.state = function(type) {
		self.element.find('.ui-textarea').toggleClass('ui-textarea-invalid', self.isInvalid());
	};
});

COMPONENT('template', function() {
	var self = this;

	self.readonly();

	self.make = function(template) {

		if (template) {
			self.template = Tangular.compile(template);
			return;
		}

		var script = self.element.find('script');
		self.template = Tangular.compile(script.html());
		script.remove();
	};

	self.setter = function(value) {
		if (value === null)
			return self.element.addClass('hidden');
		if (NOTMODIFIED(self.id, value))
			return;
		self.element.html(self.template(value)).removeClass('hidden');
	};
});

COMPONENT('repeater', function() {

	var self = this;
	self.readonly();

	self.make = function() {
		var element = self.element.find('script');
		var html = element.html();
		element.remove();
		self.template = Tangular.compile(html);
	};

	self.setter = function(value) {

		if (!value || value.length === 0) {
			self.element.html('');
			return;
		}

		var builder = '';
		for (var i = 0, length = value.length; i < length; i++) {
			var item = value[i];
			item.index = i;
			builder += self.template(item).replace(/\$index/g, i.toString()).replace(/\$/g, self.path + '[' + i + ']');
		}

		self.element.empty().append(builder);
	};
});

COMPONENT('error', function() {
	var self = this;
	var element;

	self.readonly();

	self.make = function() {
		self.element.append('<ul class="ui-error hidden"></ul>');
		element = self.element.find('ul');
	};

	self.setter = function(value) {

		if (!(value instanceof Array) || value.length === 0) {
			element.addClass('hidden');
			return;
		}

		var builder = [];
		for (var i = 0, length = value.length; i < length; i++)
			builder.push('<li><span class="fa fa-times-circle"></span> ' + value[i].error + '</li>');

		element.html(builder.join(''));
		element.removeClass('hidden');
	};
});

COMPONENT('cookie', function() {
	var self = this;
	self.make = function() {
		var cookie = localStorage.getItem('cookie');
		if (cookie) {
			self.element.addClass('hidden');
			return;
		}

		self.element.removeClass('hidden').addClass('ui-cookie');
		self.element.append('<button>' + (self.attr('data-button') || 'OK') + '</button>');
		self.element.on('click', 'button', function() {
			localStorage.setItem('cookie', '1');
			self.element.addClass('hidden');
		});
	};
});

// ==========================================================
// @{BLOCK manager}
// ==========================================================

COMPONENT('textboxtags', function() {

	var self = this;
	var isRequired = self.attr('data-required') === 'true';
	var isString = false;
	var container;

	if (!window.$textboxtagstemplate)
		window.$textboxtagstemplate = Tangular.compile('<li class="ui-textboxtags-tag" data-name="{{ name }}">{{ name }}<span class="fa fa-times"></span></li>');

	var template = window.$textboxtagstemplate;

	self.validate = function(value) {
		return isRequired ? value && value.length > 0 : true;
	};

	self.make = function() {

		var height = self.attr('data-height');
		var icon = self.attr('data-icon');
		var content = self.html();
		var html = '<div class="ui-textboxtags-values"' + (height ? ' style="min-height:' + height + '"' : '') + '><ul></ul><input type="text" placeholder="' + (self.attr('data-placeholder') || '') + '" /></div>';

		isString = self.type === 'string';

		if (content.length === 0) {
			self.element.addClass('ui-textboxtags');
			self.element.append(html);
		} else {
			self.element.empty();
			self.element.append('<div class="ui-textboxtags-label' + (isRequired ? ' ui-textboxtags-label-required' : '') + '">' + (icon ? '<span class="fa ' + icon + '"></span> ' : '') + content + ':</div>');
			self.element.append('<div class="ui-textboxtags">' + html + '</div>');
		}

		self.element.on('click', function(e) {
			self.element.find('input').focus();
		});

		container = self.element.find('ul');
		container.on('click', '.fa-times', function(e) {

			e.preventDefault();
			e.stopPropagation();

			var el = $(this);
			var arr = self.get();

			if (isString)
				arr = self.split(arr);

			if (!arr || !(arr instanceof Array) || !arr.length)
				return;

			var index = arr.indexOf(el.parent().attr('data-name'));
			if (index === -1)
				return;

			arr.splice(index, 1);
			self.change(true);
			self.set(isString ? arr.join(', ') : arr);
		});

		self.element.on('keydown', 'input', function(e) {

			if (e.keyCode === 8) {
				if (this.value)
					return;
				var arr = self.get();
				if (isString)
					arr = self.split(arr);
				if (!arr || !(arr instanceof Array) || !arr.length)
					return;
				arr.pop();
				self.change(true);
				self.set(isString ? arr.join(', ') : arr);
				return;
			}

			if (e.keyCode !== 13)
				return;

			if (!this.value)
				return;

			var arr = self.get();
			var value = this.value;

			if (isString)
				arr = self.split(arr);

			if (!(arr instanceof Array))
				arr = [];

			if (arr.indexOf(value) === -1)
				arr.push(value);
			else
				return;

			this.value = '';
			self.change(true);
			self.set(isString ? arr.join(', ') : arr);
		});
	};

	self.split = function(value) {
		if (!value)
			return new Array(0);
		var arr = value.split(',');
		for (var i = 0, length = arr.length; i < length; i++)
			arr[i] = arr[i].trim();
		return arr;
	};

	self.setter = function(value) {

		if (NOTMODIFIED(self.id, value))
			return;

		container.empty();

		if (!value || !value.length)
			return;

		var arr = isString ? self.split(value) : value;
		var builder = '';
		for (var i = 0, length = arr.length; i < length; i++)
			builder += template({ name: arr[i] });

		container.append(builder);
	};

	self.state = function(type) {
		self.element.find('.ui-textboxtags').toggleClass('ui-textboxtags-invalid', self.isInvalid());
	};
});

COMPONENT('page', function() {
	var self = this;
	var isProcessed = false;
	var isProcessing = false;

	self.hide = function() {
		self.set('');
	};

	self.getter = null;
	self.setter = function(value) {

		if (isProcessing)
			return;

		var el = self.element;
		var is = el.attr('data-if') == value;

		if (isProcessed || !is) {
			el.toggleClass('hidden', !is);
			return;
		}

		loading(true);
		isProcessing = true;
		INJECT(el.attr('data-template'), el, function() {
			isProcessing = false;
			var init = el.attr('data-init');
			if (init) {
				var fn = GET(init || '');
				if (typeof(fn) === 'function')
					fn(self);
			}

			isProcessed = true;
			el.toggleClass('hidden', !is);
			loading(false, 1200);
		});
	};
});

COMPONENT('grid', function() {

	var self = this;
	var button;
	var element;
	var lastpage = -1;

	self.click = function(index, row, button) {console.log(index, row, button)};
	self.next = function(page) {};

	self.hidemore = function() {
		button.toggleClass('hidden', true);
	};

	self.make = function(template) {

		element = self.element.find('script');
		self.template = Tangular.compile(element.html());

		self.element.on('click', 'tr', function() {});
		self.element.addClass('ui-grid');

		element.replaceWith('<div></div>');
		element = self.element.find('div:first-child');

		if (self.attr('data-options-button'))
			self.element.append('<div class="row"><div class="col-md-4"><button class="hidden" name="ui-grid-more"><span class="fa fa-plus-circle"></span> ' + self.attr('data-options-button') + '</button></div>');

		button = self.element.find('button');

		self.element.on('click', 'button', function() {
			switch (this.name) {
				case 'ui-grid-more':
					self.next(getPages(self.get().length, self.max) + 1);
					break;
				default:
					var index = parseInt($(this).parent().parent().attr('data-index'));
					self.click(index, self.get()[index], this);
					break;
			}
		});

		setTimeout(function() {
			var max = self.attr('data-max');
			if (max === 'auto')
				self.max = (Math.floor(($(window).height() - (self.element.offset().top + 208)) / 26));
			else
				self.max = parseInt(max);

			if (self.max < 10)
				self.max = 10;
		}, 10);
	};

	self.refresh = function() {
		self.set(self.get());
	};

	self.prerender = function(index, row) {
		return self.template(row).replace('<tr', '<tr data-index="' + index + '"');
	};

	self.setter = function(value) {

		if (value === null || value === undefined){
			button.toggleClass('hidden', true);
			return;
		}

		var pages = getPages(value.length, self.max);
		var output = '';

		button.toggleClass('hidden', value.length === 0 || value.length % self.max !== 0);

		for (var i = 0; i < pages; i++) {

			var skip = i * self.max;
			var items = '';

			for (var j = skip; j < skip + self.max; j++) {
				if (value[j])
					items += self.prerender(j, value[j]);
			}

			if (items.length > 0)
				output += (self.attr('data-options-page') ? '<div class="ui-grid-page">' + self.attr('data-options-page').replace('#', i + 1).replace('$', value.length) + '</div>' : '') + '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>' + items + '</tbody></table>';
		}

		element.html(output);
	};
});

function getPages(length, max) {
	var pages = (length - 1) / max;
	if (pages % max !== 0)
		pages = Math.floor(pages) + 1;
	if (pages === 0)
		pages = 1;
	return pages;
}

COMPONENT('form', function() {

	var self = this;
	var autocenter;

	if (!$cmanager.$$form) {
		$cmanager.$$form = true;
		$(document).on('click', '.ui-form-button-close', function() {
			SET($.components.findById($(this).attr('data-id')).path, '');
		});
	}

	var hide = self.hide = function() {
		self.set('');
	};

	self.readonly();
	self.submit = function(hide) { self.hide(); };
	self.cancel = function(hide) { self.hide(); };

	self.make = function() {
		var content = self.element.html();
		var width = self.attr('data-width') || '800px';
		var submit = self.attr('data-submit');
		var enter = self.attr('data-enter');

		autocenter = self.attr('data-autocenter') !== 'false';
		self.condition = self.attr('data-if');
		self.element.empty();

		$(document.body).append('<div id="' + self._id + '" class="hidden ui-form-container"' + (self.attr('data-top') ? ' style="z-index:10"' : '') + '><div class="ui-form-container-padding"><div class="ui-form" style="max-width:' + width + '"><div class="ui-form-title"><span class="fa fa-times ui-form-button-close" data-id="' + self.id + '"></span>' + self.attr('data-title') + '</div>' + content + '</div></div>');

		self.element = $('#' + self._id);
		self.element.data(COM_ATTR, self);

		self.element.on('scroll', function() {
			if (window.$calendar)
				window.$calendar.hide();
		});

		self.element.find('button').on('click', function(e) {
			switch (this.name) {
				case 'submit':
					self.submit(hide);
					break;
				case 'cancel':
					if (!this.disabled)
						self[this.name](hide);
					break;
			}
		});

		if (enter === 'true') {
			self.element.on('keydown', 'input', function(e) {
				if (e.keyCode !== 13)
					return;
				var btn = self.element.find('button[name="submit"]');
				if (btn.get(0).disabled)
					return;
				self.submit(hide);
			});
		}

		return true;
	};

	self.getter = null;
	self.setter = function(value) {

		var isHidden = !EVALUATE(self.path, self.condition);
		self.element.toggleClass('hidden', isHidden);

		if (window.$calendar)
			window.$calendar.hide();

		if (!isHidden) {

			if (autocenter) {
				var ui = self.find('.ui-form');
				var fh = ui.innerHeight();
				var wh = $(window).height();

				var r = (wh / 2) - (fh / 2);
				if (r > 20)
					ui.css({ marginTop: (r - 15) + 'px' });
				else
					ui.css({ marginTop: '20px' });
			}

			var el = self.element.find('input,select,textarea');
			if (el.length > 0)
				el.eq(0).focus();

			self.element.animate({ scrollTop: 0 }, 0, function() {
				setTimeout(function() {
					self.element.find('.ui-form').addClass('ui-form-animate');
				}, 300);
			});

		} else
			self.element.find('.ui-form').removeClass('ui-form-animate');
	};
});

COMPONENT('pictures', function() {

	var self = this;

	self.skip = false;

	self.make = function() {
		self.element.addClass('ui-pictures');
	};

	self.readonly();

	self.setter = function(value) {

		if (typeof(value) === 'string')
			value = value.split(',');

		if (this.skip) {
			this.skip = false;
			return;
		}

		this.element.find('.fa').unbind('click');
		this.element.find('img').unbind('click');
		this.element.empty();

		if (!(value instanceof Array) || value.length === 0)
			return;

		for (var i = 0, length = value.length; i < length; i++) {
			var id = value[i];
			if (id)
				this.element.append('<div data-id="' + id + '" class="col-xs-3 m"><span class="fa fa-times"></span><img src="/images/small/' + id + '.jpg" class="img-responsive" alt="" /></div>');
		}

		var self = this;
		this.element.find('.fa').bind('click', function(e) {

			var el = $(this).parent().remove();
			var id = [];

			self.element.find('div').each(function() {
				id.push($(this).attr('data-id'));
			});

			self.skip = true;
			self.set(id);
		});

		this.element.find('img').bind('click', function() {

			var selected = self.element.find('.selected');
			var el = $(this);

			el.toggleClass('selected');

			if (selected.length === 0)
				return;

			var id1 = el.parent().attr('data-id');
			var id2 = selected.parent().attr('data-id');
			var arr = self.get();

			var index1 = arr.indexOf(id1);
			var index2 = arr.indexOf(id2);

			arr[index1] = id2;
			arr[index2] = id1;

			setTimeout(function() {
				self.change();
				self.set(arr);
			}, 500);
		});
	};
});

COMPONENT('fileupload', function() {

	var self = this;

	self.error = function(err) {};
	self.readonly();
	self.setter = null;

	var isRequired = this.element.attr('data-required') === 'true';

	this.make = function() {

		var element = this.element;
		var content = self.html();
		var placeholder = self.attr('data-placeholder');
		var icon = self.attr('data-icon');
		var accept = self.attr('data-accept');
		var url = self.attr('data-url');

		if (!url) {
			if (window.managerurl)
				url = window.managerurl + '/upload/';
			else
				url = window.location.pathname
		}

		var multiple = self.attr('data-multiple') === 'true';
		var html = '<span class="fa fa-folder"></span><input type="file"' + (accept ? ' accept="' + accept + '"' : '') + (multiple ? ' multiple="multiple"' : '') + ' class="ui-fileupload-input" /><input type="text" placeholder="' + (placeholder ? placeholder : '') + '" readonly="readonly" />';

		if (content.length > 0) {
			element.empty();
			element.append('<div class="ui-fileupload-label' + (isRequired ? ' ui-fileupload-label-required' : '') + '">' + (icon ? '<span class="fa ' + icon + '"></span> ' : '') + content + ':</div>');
			element.append('<div class="ui-fileupload">' + html + '</div>');
		} else {
			element.addClass('ui-fileupload');
			element.append(html);
		}

		element.find('.ui-fileupload-input').bind('change', function(evt) {
			var files = evt.target.files;
			var filename = [];
			var el = this;
			$(el).parent().find('input[type="text"]').val(filename.join(', '));

			var data = new FormData();
			for (var i = 0, length = files.length; i < length; i++)
				data.append('file' + i, files[i]);

				if (typeof(window.loading) === 'function')
					window.loading(true);

			$.components.UPLOAD(url, data, function(response, err) {

				if (err) {

					if (typeof(window.loading) === 'function')
						window.loading(false, 500);

					var message = FIND('message');
					if (message)
						message.warning(self.attr('data-error-large'));
					else
						alert(self.attr('data-error-large'));

					return;
				}

				self.change();
				el.value = '';

				if (self.attr('data-extension') === 'false') {
					for (var i = 0, length = response.length; i < length; i++) {
						var filename = response[i];
						var index = filename.lastIndexOf('.');
						if (index === -1)
							continue;
						response[i] = filename.substring(0, index);
					}
				}

				if (self.attr('data-singlefile') === 'true')
					self.set(response[0]);
				else
					self.push(response);

				if (typeof(window.loading) === 'function')
					window.loading(false, 500);
			});
		});
	};
});

COMPONENT('repeater-group', function() {

	var self = this;
	var template_group;
	var group;

	self.readonly();

	self.make = function() {
		group = self.attr('data-group');
		self.element.find('script').each(function(index) {
			var element = $(this);
			var html = element.html();
			element.remove();

			if (index === 0) {
				self.template = Tangular.compile(html);
				return;
			}

			template_group = Tangular.compile(html);
		});
	};

	self.setter = function(value) {

		if (!value || value.length === 0) {
			self.element.html('');
			return;
		}

		var length = value.length;
		var groups = {};

		for (var i = 0; i < length; i++) {
			var name = value[i][group];
			if (!name)
				name = '0';

			if (!groups[name])
				groups[name] = [value[i]];
			else
				groups[name].push(value[i]);
		}

		var index = 0;
		var builder = '';
		var keys = Object.keys(groups);
		keys.sort();
		keys.forEach(function(key) {
			var arr = groups[key];

			if (key !== '0') {
				var options = {};
				options[group] = key;
				options.length = arr.length;
				builder += template_group(options);
			}

			for (var i = 0, length = arr.length; i < length; i++) {
				var item = arr[i];
				item.index = index++;
				builder += self.template(item).replace(/\$index/g, index.toString()).replace(/\$/g, self.path + '[' + index + ']');
			}
		});

		self.element.empty().append(builder);
	};
});

COMPONENT('dropdowncheckbox', function() {

	var self = this;
	var isRequired = self.element.attr('data-required') === 'true';
	var datasource = '';
	var container;
	var data = [];

	if (!window.$dropdowncheckboxtemplate)
		window.$dropdowncheckboxtemplate = Tangular.compile('<div><label><input type="checkbox" value="{{ index }}" /><span>{{ text }}</span></label></div>');

	var template = window.$dropdowncheckboxtemplate;

	self.validate = function(value) {
		return isRequired ? value && value.length > 0 : true;
	};

	self.make = function() {

		var options = [];
		var element = self.element;
		var arr = (element.attr('data-options') || '').split(';');

		for (var i = 0, length = arr.length; i < length; i++) {
			var item = arr[i].split('|');
			var value = item[1] === undefined ? item[0] : item[1];
			if (self.type === 'number')
				value = parseInt(value);
			var obj = { value: value, text: item[0], index: i };
			options.push(template(obj));
			data.push(obj);
		}

		var content = element.html();
		var icon = element.attr('data-icon');
		var html = '<div class="ui-dropdowncheckbox"><span class="fa fa-sort"></span><div class="ui-dropdowncheckbox-selected"></div></div><div class="ui-dropdowncheckbox-values hidden">' + options.join('') + '</div>';

		if (content.length > 0) {
			element.empty();
			element.append('<div class="ui-dropdowncheckbox-label' + (isRequired ? ' ui-dropdowncheckbox-label-required' : '') + '">' + (icon ? '<span class="fa ' + icon + '"></span> ' : '') + content + ':</div>');
			element.append(html);
		} else
			element.append(html);

		self.element.addClass('ui-dropdowncheckbox-container');
		container = self.element.find('.ui-dropdowncheckbox-values');

		self.element.on('click', '.ui-dropdowncheckbox', function(e) {
			container.toggleClass('hidden');

			if (window.$dropdowncheckboxelement) {
				window.$dropdowncheckboxelement.addClass('hidden');
				window.$dropdowncheckboxelement = null;
			}

			if (!container.hasClass('hidden'))
				window.$dropdowncheckboxelement = container;

			e.stopPropagation();
		});

		self.element.on('click', 'input,label', function(e) {

			e.stopPropagation();

			var is = this.checked;
			var index = parseInt(this.value);
			var value = data[index];

			if (value === undefined)
				return;

			value = value.value;

			var arr = self.get();
			if (!(arr instanceof Array))
				arr = [];

			var index = arr.indexOf(value);

			if (is) {
				if (index === -1)
					arr.push(value);
			} else {
				if (index !== -1)
					arr.splice(index, 1);
			}

			self.reset(true);
			self.set(arr, undefined, 2);
		});

		var ds = self.attr('data-source');

		if (!ds)
			return;

		self.watch(ds, prepare);
		setTimeout(function() {
			prepare(ds, GET(ds));
		}, 500);
	};

	function prepare(path, value) {

		if (NOTMODIFIED(path, value))
			return;

		if (!value)
			value = [];

		var kv = self.attr('data-source-value') || 'id';
		var kt = self.attr('data-source-text') || 'name';
		var builder = '';

		data = [];
		for (var i = 0, length = value.length; i < length; i++) {

			var item;
			if (typeof(value[i]) === 'string')
				item = { value: value[i], text: value[i], index: i };
			else
				item = { value: value[i][kv], text: value[i][kt], index: i };

			data.push(item);
			builder += template(item);
		}

		container.empty().append(builder);
		self.setter(self.get());
	}

	self.setter = function(value) {

		if (!value) {
			self.element.find('.ui-dropdowncheckbox-selected').html('');
			self.element.find('input').prop('checked', false);
			return;
		}

		var label = '';
		for (var i = 0, length = value.length; i < length; i++) {
			var selected = value[i];
			var index = 0;
			while (true) {
				var item = data[index++];
				if (item === undefined)
					break;
				if (item.value != selected)
					continue;
				label += (label ? ', ' : '') + item.text;
			}
		}

		container.find('input').each(function() {
			var index = parseInt(this.value);
			var checked = data[index];
			if (checked === undefined)
				checked = false;
			else
				checked = value.indexOf(checked.value) !== -1;
			this.checked = checked;
		});

		self.element.find('.ui-dropdowncheckbox-selected').html(label);
	};

	self.state = function(type) {
		self.element.find('.ui-dropdowncheckbox').toggleClass('ui-dropdowncheckbox-invalid', self.isInvalid());
	};

	if (window.$dropdowncheckboxevent)
		return;

	window.$dropdowncheckboxevent = true;
	$(document).on('click', function(e) {
		if (!window.$dropdowncheckboxelement)
			return;
		window.$dropdowncheckboxelement.addClass('hidden');
		window.$dropdowncheckboxelement = null;
	});
});

COMPONENT('crop', function() {
	var self = this;
	var width, height, canvas, context;
	var img = new Image();
	var can = false;
	var is = false;
	var zoom = 100;
	var current = { x: 0, y: 0 };
	var offset = { x: 0, y: 0 };

	self.noValid();
	self.getter = null;

	img.onload = function () {
		can = true;
		zoom = 100;

		 // centering
		current.x = (width / 2) - (img.width / 2);
		current.y = (height / 2) - (img.height / 2);
		self.redraw();
	};

	self.resize = function(w, h) {
		width = w;
		height = h;
		canvas.width = w;
		canvas.height = h;
		self.element.find('div').html(w + 'x' + h);
	};

	self.output = function(type) {
		if (type)
			return canvas.toDataURL(type);
		if (isTransparent(context))
			return canvas.toDataURL('image/png');
		var w = canvas.width;
		return canvas.toDataURL('image/jpeg', w > 800 ? 0.7 : w > 500 ? 0.8 : 0.9);
	};

	self.make = function() {

		width = parseInt(self.attr('data-width') || 0);
		height = parseInt(self.attr('data-height') || 0);
		self.element.addClass('ui-crop');
		self.append('<input type="file" style="display:none" accept="image/*" /><ul><li data-type="upload"><span class="fa fa-folder"></span></li><li data-type="plus"><span class="fa fa-plus"></span></li><li data-type="refresh"><span class="fa fa-refresh"></span></li><li data-type="minus"><span class="fa fa-minus"></span></li></ul>');
		self.append(Tangular.render('<canvas width="{{ width }}" height="{{ height }}"></canvas><div></div>', { width: width, height: height }));
		canvas = self.find('canvas').get(0);
		context = canvas.getContext('2d');

		self.element.on('click', 'li', function(e) {

			e.preventDefault();
			e.stopPropagation();

			var count = parseInt();

			switch ($(this).attr('data-type')) {
				case 'upload':
					self.find('input').trigger('click');
					break;
				case 'plus':
					zoom += 5;
					if (zoom > 300)
						zoom = 300;
					self.redraw();
					break;
				case 'minus':
					zoom -= 5;
					if (zoom < 5)
						zoom = 5;
					self.redraw();
					break;
				case 'refresh':
					zoom = 100;
					self.redraw();
					break;
			}
		});

		self.find('input').on('change', function() {
			var input = this;
			var file = this.files[0];
			var reader = new FileReader();

			reader.onload = function () {
				img.src = reader.result;
				input.value = '';
				setTimeout(function() {
					self.change();
				}, 500);
			};

			reader.readAsDataURL(file);
		});

		$(canvas).on('mousedown', function (e) {

			if (self.disabled || !can)
				return;

			is = true;
			var rect = canvas.getBoundingClientRect();
			var x = e.clientX - rect.left;
			var y = e.clientY - rect.top;
			offset.x = x - current.x;
			offset.y = y - current.y;
		});

		var allow = (self.attr('data-dragdrop') || 'true') === 'true';

		if (allow) {
			$(canvas).on('dragenter dragover dragexit drop dragleave', function (e) {

				if (self.disabled)
					return;

				e.stopPropagation();
				e.preventDefault();

				switch (e.type) {
					case 'drop':
						self.element.removeClass('ui-crop-dragdrop');
						break;
					case 'dragenter':
					case 'dragover':
						self.element.addClass('ui-crop-dragdrop');
						return;
					case 'dragexit':
					case 'dragleave':
					default:
						self.element.removeClass('ui-crop-dragdrop');
						return;
				}

				var files = e.originalEvent.dataTransfer.files;
				var reader = new FileReader();

				reader.onload = function () {
					img.src = reader.result;
					setTimeout(function() {
						self.change();
					}, 500);
				};

				reader.readAsDataURL(files[0]);
			});
		}

		self.element.on('mousemove mouseup', function (e) {

			if (e.type === 'mouseup') {
				if (is) self.change();
				is = false;
				return;
			}

			if (self.disabled)
				return;

			if (!can || !is) return;
			var rect = canvas.getBoundingClientRect();
			var x = e.clientX - rect.left;
			var y = e.clientY - rect.top;
			current.x = x - offset.x;
			current.y = y - offset.y;
			self.redraw();
		});
	};

	self.redraw = function() {

		var w = img.width;
		var h = img.height;

		w = ((w / 100) * zoom) >> 0;
		h = ((h / 100) * zoom) >> 0;

		context.clearRect(0, 0, width, height);

		if (can)
			context.drawImage(img, current.x || 0, current.y || 0, w, h);
	};

	self.setter = function(value) {

		if (!value) {
			can = false;
			self.redraw();
			return;
		}

		img.src = value;
	};

	function isTransparent(ctx) {
		var id = ctx.getImageData(0, 0, width, height);
		for (var i = 0, length = id.data.length; i < length; i += 4)
		if (id.data[i + 3] !== 255) return true;
		return false;
	}
});

COMPONENT('codemirror', function() {

	var self = this;
	var editor;
	var isRequired = self.attr('data-required') === 'true';
	var skipA = false;
	var skipB = false;
	var timeout;

	self.validate = function(value) {
		return isRequired ? value && value.length > 0 : true;
	};

	self.make = function() {

		var height = self.element.attr('data-height');
		var icon = self.element.attr('data-icon');
		var content = self.element.html();

		self.element.empty();
		self.element.append('<div class="ui-codemirror-label' + (isRequired ? ' ui-codemirror-label-required' : '') + '">' + (icon ? '<span class="fa ' + icon + '"></span> ' : '') + content + ':</div><div class="ui-codemirror"></div>');
		var container = self.element.find('.ui-codemirror');

		editor = CodeMirror(container.get(0), { lineNumbers: self.attr('data-linenumbers') === 'true', mode: self.attr('data-type') || 'htmlmixed', indentUnit: 4 });

		if (height !== 'auto')
			editor.setSize('100%', height || '200px');

		editor.on('change', function(a, b) {
			clearTimeout(timeout);

			if (skipB) {
				skipB = false;
				return;
			}

			timeout = setTimeout(function() {
				skipA = true;
				self.reset(true);
				self.dirty(false);
				self.set(editor.getValue());
			}, 200);
		});

		skipB = true;
	};

	self.getter = null;
	self.setter = function(value, path) {

		if (skipA === true) {
			skipA = false;
			return;
		}

		skipB = true;
		editor.setValue(value || '');
		editor.refresh();
		skipB = true;

		CodeMirror.commands['selectAll'](editor);
		var f = editor.getCursor(true);
		var t = editor.getCursor(false);
		skipB = true;
		editor.setValue(editor.getValue());
		skipB = true;

		setTimeout(function() {
			editor.refresh();
		}, 200);

		setTimeout(function() {
			editor.refresh();
		}, 1000);
	};

	self.state = function(type) {
		self.element.find('.ui-codemirror').toggleClass('ui-codemirror-invalid', self.isInvalid());
	};
});

COMPONENT('calendar', function() {

	var self = this;
	var skip = false;
	var skipDay = false;
	var callback;

	self.days = self.attr('data-days').split(',');
	self.months = self.attr('data-months').split(',');
	self.first = parseInt(self.attr('data-firstday'));
	self.today = self.attr('data-today');
	self.months_short = [];

	for (var i = 0, length = self.months.length; i < length; i++) {
		var m = self.months[i];
		if (m.length > 4)
			m = m.substring(0, 3) + '.';
		self.months_short.push(m);
	}

	self.readonly();
	self.click = function(date) {};

	function getMonthDays(dt) {

		var m = dt.getMonth();
		var y = dt.getFullYear();

		if (m === -1) {
			m = 11;
			y--;
		}

		return (32 - new Date(y, m, 32).getDate());
	}

	function calculate(year, month, selected) {

		var d = new Date(year, month, 1);
		var output = { header: [], days: [], month: month, year: year };
		var firstDay = self.first;
		var firstCount = 0;
		var from = d.getDay() - firstDay;
		var today = new Date();
		var ty = today.getFullYear();
		var tm = today.getMonth();
		var td = today.getDate();
		var sy = selected ? selected.getFullYear() : -1;
		var sm = selected ? selected.getMonth() : -1;
		var sd = selected ? selected.getDate() : -1;
		var days = getMonthDays(d);

		if (from < 0)
			from = 7 + from;

		while (firstCount++ < 7) {
			output.header.push({ index: firstDay, name: self.days[firstDay] });
			firstDay++;
			if (firstDay > 6)
				firstDay = 0;
		}

		var index = 0;
		var indexEmpty = 0;
		var count = 0;
		var prev = getMonthDays(new Date(year, month - 1, 1)) - from;

		for (var i = 0; i < days + from; i++) {

			count++;
			var obj = { isToday: false, isSelected: false, isEmpty: false, isFuture: false, number: 0, index: count };

			if (i >= from) {
				index++;
				obj.number = index;
				obj.isSelected = sy === year && sm === month && sd === index;
				obj.isToday = ty === year && tm === month && td === index;
				obj.isFuture = ty < year;

				if (!obj.isFuture && year === ty) {
					if (tm < month)
						obj.isFuture = true;
					else if (tm === month)
						obj.isFuture = td < index;
				}

			} else {
				indexEmpty++;
				obj.number = prev + indexEmpty;
				obj.isEmpty = true;
			}

			output.days.push(obj);
		}

		indexEmpty = 0;
		for (var i = count; i < 42; i++) {
			count++;
			indexEmpty++;
			var obj = { isToday: false, isSelected: false, isEmpty: true, isFuture: false, number: indexEmpty, index: count };
			output.days.push(obj);
		}

		return output;
	}

	self.hide = function() {
		if (self.element.hasClass('hidden'))
			return;
		self.element.addClass('hidden');
		return self;
	};

	self.toggle = function(el, value, callback, offset) {
		if (self.element.hasClass('hidden'))
			self.show(el, value, callback, offset);
		else
			self.hide();
		return self;
	};

	self.show = function(el, value, callback, offset) {

		if (!el)
			return self.hide();

		var off = el.offset();
		var h = el.innerHeight();

		self.element.css({ left: off.left + (offset || 0), top: off.top + h + 12 }).removeClass('hidden');
		self.click = callback;
		self.date(value);
		return self;
	};

	self.make = function() {

		self.element.addClass('ui-calendar hidden');

		self.element.on('click', '.ui-calendar-today', function() {
			var dt = new Date();
			self.hide();
			if (self.click)
				self.click(dt);
		});

		self.element.on('click', '.ui-calendar-day', function() {
			var arr = this.getAttribute('data-date').split('-');
			var dt = new Date(parseInt(arr[0]), parseInt(arr[1]), parseInt(arr[2]));
			skip = true;
			self.element.find('.ui-calendar-selected').removeClass('ui-calendar-selected');
			$(this).addClass('ui-calendar-selected');
			self.hide();
			if (self.click)
				self.click(dt);
		});

		self.element.on('click', 'button', function(e) {

			e.preventDefault();
			e.stopPropagation();

			var arr = this.getAttribute('data-date').split('-');
			var dt = new Date(parseInt(arr[0]), parseInt(arr[1]), 1);
			switch (this.name) {
				case 'prev':
					dt.setMonth(dt.getMonth() - 1);
					break;
				case 'next':
					dt.setMonth(dt.getMonth() + 1);
					break;
			}
			skipDay = true;
			self.date(dt);
		});

		$(document.body).on('scroll', function() {
			if (window.$calendar)
				window.$calendar.hide();
		});

		window.$calendar = self;
	};

	self.date = function(value) {

		if (typeof(value) === 'string')
			value = value.parseDate();

		var empty = !value;

		if (skipDay) {
			skipDay = false;
			empty = true;
		}

		if (skip) {
			skip = false;
			return;
		}

		if (!value)
			value = new Date();

		old = value;

		var output = calculate(value.getFullYear(), value.getMonth(), value);
		var builder = [];

		for (var i = 0; i < 42; i++) {

			var item = output.days[i];

			if (i % 7 === 0) {
				if (builder.length > 0)
					builder.push('</tr>');
				builder.push('<tr>');
			}

			var cls = [];

			if (item.isEmpty)
				cls.push('ui-calendar-disabled');
			else
				cls.push('ui-calendar-day');

			if (!empty && item.isSelected)
				cls.push('ui-calendar-selected');

			if (item.isToday)
				cls.push('ui-calendar-day-today');

			builder.push('<td class="' + cls.join(' ') + '" data-date="' + output.year + '-' + output.month + '-' + item.number + '">' + item.number + '</td>');
		}

		builder.push('</tr>');

		var header = [];
		for (var i = 0; i < 7; i++)
			header.push('<th>' + output.header[i].name + '</th>');

		self.element.html('<div class="ui-calendar-header"><button class="ui-calendar-header-prev" name="prev" data-date="' + output.year + '-' + output.month + '"><span class="fa fa-chevron-left"></span></button><div class="ui-calendar-header-info">' + self.months[value.getMonth()] + ' ' + value.getFullYear() + '</div><button class="ui-calendar-header-next" name="next" data-date="' + output.year + '-' + output.month + '"><span class="fa fa-chevron-right"></span></button></div><table cellpadding="0" cellspacing="0" border="0"><thead>' + header.join('') + '</thead><tbody>' + builder.join('') + '</tbody></table>' + (self.today ? '<div><a href="javascript:void(0)" class="ui-calendar-today">' + self.today + '</a></div>' : ''));
	};
});

COMPONENT('tabmenu', function() {
	var self = this;
	self.make = function() {
		self.element.on('click', 'li', function() {
			var el = $(this);
			if (el.hasClass('selected'))
				return;
			self.set(el.attr('data-value'));
		});
	};
	self.setter = function(value) {
		self.element.find('.selected').removeClass('selected');
		self.element.find('li[data-value="' + value + '"]').addClass('selected');
	};
});

// ==========================================================
// @{end}
// ==========================================================

Tangular.register('pluralize', function(value, zero, one, other, many) {
	if (!value)
		return '0 ' + zero;
	if (value === 1)
		return value + ' ' + one;
	if (value > 4)
		return value + ' ' +  many;
	return value + ' ' + other;
});

$.components.$parser.push(function(path, value, type) {

	if (type === 'date') {
		if (value instanceof Date)
			return value;

		if (!value)
			return null;

		var isEN = value.indexOf('.') === -1;
		var tmp = isEN ? value.split('-') : value.split('.');
		if (tmp.length !== 3)
			return null;
		var dt = isEN ? new Date(parseInt(tmp[0]) || 0, (parseInt(tmp[1], 10) || 0) - 1, parseInt(tmp[2], 10) || 0) : new Date(parseInt(tmp[2]) || 0, (parseInt(tmp[1], 10) || 0) - 1, parseInt(tmp[0], 10) || 0);
		return dt;
	}

	return value;
});

$.components.$formatter.push(function(path, value, type) {

	if (type === 'date') {
		if (value instanceof Date)
			return value.format(this.attr('data-component-format'));
		if (!value)
			return value;
		return new Date(Date.parse(value)).format(this.attr('data-component-format'));
	}

	if (type !== 'currency')
		return value;

	if (typeof(value) !== 'number') {
		value = parseFloat(value);
		if (isNaN(value))
			value = 0;
	}

	return value.format(2);
});