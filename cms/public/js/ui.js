COMPONENT('click', function() {
	var self = this;

	self.make = function() {
		self.element.on('click', function() {
			self.get(self.attr('data-component-path'))();
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

COMPONENT('validation', function() {

	var self = this;
	var path = self.path;
	var buttons;

	if (path.lastIndexOf('*') === -1)
		path += '.*';

	self.noValid();
	self.noDirty();

	self.setter = null;
	self.getter = null;

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

        is = isRequired ? self.type === 'email' ? value.match(/^[a-zA-Z_\.]+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/) !== null : self.type === 'currency' ? value > 0 : value.length > 0 : true;
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

	self.hide = function() {
		self.set('');
	};

	self.getter = null;
	self.setter = function(value) {
		var el = self.element;
		var is = el.attr('data-if') == value;

		if (isProcessed || !is) {
			el.toggleClass('hidden', !is);
			return;
		}

		loading(true);
		INJECT(el.attr('data-template'), el, function() {
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

	if (!$cmanager.$$form) {
		$cmanager.$$form = true;
		$(document).on('click', '.ui-form-button-close', function() {
			SET($.components.findById($(this).attr('data-id')).path, '');
		});
	}

	var hide = self.hide = function() {
		self.set('');
	};

	self.noValid();
	self.noDirty();
	self.submit = function(hide) { self.hide(); };
	self.cancel = function(hide) { self.hide(); };

	self.make = function() {
		var content = self.element.html();
		var width = self.attr('data-width') || '800px';
		var submit = self.attr('data-submit');

		self.condition = self.attr('data-if');
		self.element.empty();

		$(document.body).append('<div id="' + self._id + '" class="hidden ui-form-container"' + (self.attr('data-top') ? ' style="z-index:10"' : '') + '><div class="ui-form-container-padding"><div class="ui-form" style="max-width:' + width + '"><div class="ui-form-title"><span class="fa fa-times ui-form-button-close" data-id="' + self.id + '"></span>' + self.attr('data-title') + '</div>' + content + '</div></div>');

		self.element = $('#' + self._id);
		self.element.data(COM_ATTR, self);

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

		return true;
	};

	self.getter = null;
	self.setter = function(value) {
		var isHidden = !EVALUATE(self.path, self.condition);
		self.element.toggleClass('hidden', isHidden);
		if (!isHidden) {
			var el = self.element.find('input');

			if (el.length === 0)
				el = self.element.find('textarea');

			if (el.length > 0)
				el.eq(0).focus();

			self.element.animate({ scrollTop: 0 }, 0);
		}
	};
});

COMPONENT('pictures', function() {

	var self = this;

	self.skip = false;

	self.make = function() {
		self.element.addClass('ui-pictures');
	};

	self.noValid();
	self.noDirty();

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

COMPONENT('template', function() {
	var self = this;

	self.noDirty();
	self.noValid();
	self.getter = null;

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

			$.components.UPLOAD(url, data, function(response, err) {
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

				self.push(response);
			});
		});
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

Tangular.register('pluralize', function(value, zero, one, other, many) {
	if (value === 0)
		return value + ' ' + zero;
	if (value === 1)
		return value + ' ' + one;
	if (value > 4)
		return value + ' ' +  many;
	return value + ' ' + other;
});

$.components.$formatter.push(function(path, value, type) {

	if (type !== 'currency')
		return value;

	if (typeof(value) !== 'number') {
		value = parseFloat(value);
		if (isNaN(value))
			value = 0;
	}

	return value.format(2);
});