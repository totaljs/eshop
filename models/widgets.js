const Fs = require('fs');
const CSS = 'widgets.css';
const JS = 'widgets.js';
const JSEDITOR = 'editor.js';
const INSTALLED = {};

function WidgetInstace() {
}

WidgetInstace.prototype.globals = function(name, value) {
	$WORKFLOW('PageGlobals', 'add', { name: name, value: value }, NOOP);
};

NEWSCHEMA('Widget').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('name', 'String(50)', true);
	schema.define('category', 'String(50)');
	schema.define('body', String);
	schema.define('picture', 'String(50)'); // A preview
	schema.define('icon', 'Lower(20)');
	schema.define('reference', 'String(50)');

	// Gets listing
	schema.setQuery(function($) {
		var filter = NOSQL('widgets').find();
		filter.sort('datecreated', true);
		filter.fields('id', 'picture', 'name', 'icon', 'category', 'datecreated', 'reference');
		filter.callback((err, docs, count) => $.callback(filter.adminOutput(docs, count)));
	});

	// Gets widget detail
	schema.setGet(function($) {
		var opt = $.options;
		var filter = NOSQL('widgets').one();
		opt.url && filter.where('url', opt.url);
		opt.id && filter.where('id', opt.id);
		$.controller && filter.where('id', $.controller.id);
		filter.callback($.callback, 'error-widgets-404');
	});

	schema.setSave(function($) {

		var nosql = NOSQL('widgets');
		var user = $.user.name;
		var model = $.model;

		// Importing ...
		// It tries to find existing widget according to the reference
		if (model.reference && !model.id) {
			var keys = Object.keys(F.global.widgets);
			for (var i = 0; i < keys.length; i++) {
				if (F.global.widgets[keys[i]].reference === model.reference)
					model.id = keys[i];
			}
		}

		var isUpdate = !!model.id;

		if (isUpdate) {
			model.dateupdated = F.datetime;
		} else {
			model.id = UID();
			model.datecreated = F.datetime;
		}

		var db = isUpdate ? nosql.modify(model).where('id', model.id).backup(user).log('Update: ' + model.id, user) : nosql.insert(model).log('Create: ' + model.id, user);

		db.callback(function() {
			OPERATION('admin.notify', { type: 'widgets.save', message: model.name });
			EMIT('widgets.save', model);
			refresh();
			$.success();
		});
	});

	// Removes a specific widget
	schema.setRemove(function($) {
		var user = $.user.name;
		var id = $.body.id;
		NOSQL('widgets').remove().where('id', id).backup(user).log('Remove: ' + id, user).callback(function(err, count) {

			if (INSTALLED[id]) {
				var w = F.global.widgets[id];
				w && w.total && w.total.uninstall && w.total.uninstall();
				delete INSTALLED[id];
			}

			$.success();
			count && setTimeout2('widgets', function() {
				refresh(null, true);
			}, 1000);
		});
	});

	schema.addWorkflow('editor', function($) {
		var body = F.global.widgets[$.controller.id];
		$.callback(body ? body.html : '');
	});

});

NEWSCHEMA('WidgetGlobals').make(function(schema) {

	schema.define('css', 'String');
	schema.define('js', 'String');

	schema.setSave(function($) {
		Fs.writeFile(F.path.databases('widgetsglobals.json'), JSON.stringify($.model.$clean()), function() {
			refresh(null, true);
			$.success();
		});
	});

	schema.setGet(function($) {
		Fs.readFile(F.path.databases('widgetsglobals.json'), function(err, data) {

			if (data) {
				data = data.toString('utf8').parseJSON(true);
				$.model.css = data.css;
				$.model.js = data.js;
			}

			$.callback();
		});
	});
});

function compile(html) {

	var beg = -1;
	var end = -1;

	var body_script = '';
	var body_editor = '';
	var body_style = '';
	var body_html = '';
	var body_total = '';
	var raw = html;

	while (true) {

		beg = html.indexOf('<script', end);
		if (beg === -1)
			break;

		end = html.indexOf('</script>', beg);
		if (end === -1)
			break;

		var body = html.substring(beg, end);
		var beg = body.indexOf('>') + 1;
		var type = body.substring(0, beg);

		body = body.substring(beg);
		raw = raw.replace(type + body + '</script>', '');

		body = body.trim();

		if (type.indexOf('html') !== -1 || type.indexOf('plain') !== -1)
			body_html = body;
		else if (type.indexOf('total') !== -1 || type.indexOf('totaljs') !== -1)
			body_total = body;
		else if (type.indexOf('editor') !== -1)
			body_editor = body;
		else
			body_script = body;

		end += 9;
	}

	beg = raw.indexOf('<style');
	if (beg !== -1) {
		end = raw.indexOf('</style>');
		var tmp = raw.substring(raw.indexOf('>', beg) + 1, end);
		raw = raw.replace(raw.substring(beg, end + 8), '');
		body_style = tmp.trim();
	}

	if (!body_html) {
		raw = raw.trim();
		raw && (body_html = raw);
	}

	var obj = {};

	obj.js = body_script;
	obj.jschecksum = obj.js.hash();
	obj.editor = body_editor;
	obj.editorchecksum = obj.editor.hash();
	obj.css = body_style;
	obj.csschecksum = obj.css.hash();
	obj.html = body_html;
	obj.htmlchecksum = obj.html.hash();

	if (body_total) {
		obj.total = body_total;
		obj.totalchecksum = obj.total.hash();
	} else
		obj.totalchecksum = 0;

	return obj;
}

function refresh(callback, force) {
	NOSQL('widgets').find().fields('id', 'reference', 'body').callback(function(err, items) {

		var css = [];
		var js = [];
		var jseditor = [];
		var exports = {};
		var old = F.global.widgets;

		F.global.widgets = {};
		F.global.widgets.$ready = false;

		var rebuildcss = !!force;
		var rebuildjs = !!force;
		var rebuildeditor = !!force;

		for (var i = 0, length = items.length; i < length; i++) {

			var item = items[i];
			var meta = INSTALLED[item.id];
			var prev = old ? old[item.id] : null;
			var type = 1;
			var rebuild = false;

			if (!meta) {
				meta = {};
				type = 0;
			}

			var obj = compile(item.body);

			obj.css && css.push(obj.css);

			if (obj.csschecksum !== meta.csschecksum) {
				meta.csschecksum = obj.csschecksum;
				rebuildcss = true;
			}

			obj.css = undefined;

			obj.js && js.push(obj.js);

			if (obj.jschecksum !== meta.jschecksum) {
				meta.jschecksum = obj.jschecksum;
				rebuildjs = true;
			}

			obj.js = undefined;

			obj.editor && jseditor.push('widget' + item.id + '=function(option,exports){' + obj.editor + '};');

			if (obj.editorchecksum !== meta.editorchecksum) {

				obj.def = {};
				meta.editorchecksum = obj.editorchecksum;

				// Applies default settings
				if (obj.editor) {
					var fn = new Function('option', 'exports', obj.editor);
					fn((name, label, value) => obj.def[name] = value, exports);
				}

				rebuildeditor = true;
			} else if (prev)
				obj.def = prev.def;

			obj.id = item.id;
			obj.reference = item.reference;
			obj.istemplate = !(obj.total && obj.total.render);

			if (obj.totalchecksum !== meta.totalchecksum) {

				if (obj.total) {
					var o = new WidgetInstace();
					try {
						(new Function('exports', obj.total))(o);
					} catch (e) {
						F.error(e, 'Widget {0}: processing'.format(obj.name));
					}
					obj.total = o;
					rebuild = true;
				}

				meta.totalchecksum = obj.totalchecksum;

				// Widget exists but it was modified
				if (type === 1) {
					var e = F.global.widgets[obj.id];
					e && e.total && e.total.uninstall && e.total.uninstall();
				}
			}

			F.global.widgets[obj.id] = obj;
			INSTALLED[obj.id] = meta;

			if (rebuild) {
				try {
					obj.total && obj.total.install && obj.total.install();
				} catch (e) {
					F.error(e, 'Widget {0}: install'.format(obj.name));
				}
			} else if (prev)
				obj.total = prev.total;
		}

		if (rebuildcss || rebuildjs || rebuildeditor) {
			$GET('WidgetGlobals', function(err, response) {

				var version = U.GUID(5);

				if (rebuildcss) {
					Fs.writeFile(F.path.temp(CSS), U.minifyStyle('/*auto*/\n' + (response.css ? response.css + '\n' : '') + css.join('\n')), NOOP);
					F.touch(CSS);
					F.global.css = '/' + CSS + '?ts=' + version;
				}

				if (rebuildjs) {
					Fs.writeFile(F.path.temp(JS), U.minifyScript((response.js ? response.js + ';\n' : '') + js.join('\n')), NOOP);
					F.touch(JS);
					F.global.js = '/' + JS + '?ts=' + version;
				}

				if (rebuildeditor) {
					Fs.writeFile(F.path.temp(JSEDITOR), U.minifyScript(jseditor.join('\n')), NOOP);
					F.touch(JSEDITOR);
					F.global.jseditor = '/' + JSEDITOR + '?ts=' + version;
				}

				if (typeof(callback) === 'function')
					callback();

				F.global.widgets.$ready = true;
				F.cache.removeAll('cachecms');
			});
		} else {
			F.global.widgets.$ready = true;
			F.cache.removeAll('cachecms');
		}
	});
}

FILE('/' + CSS, (req, res) => res.file(F.path.temp(CSS)));
FILE('/' + JS, (req, res) => res.file(F.path.temp(JS)));
FILE('/' + JSEDITOR, (req, res) => res.file(F.path.temp(JSEDITOR)));

ON('settings', refresh);