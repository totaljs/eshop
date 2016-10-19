const Fs = require('fs');
const CSS = 'widgets.css';

NEWSCHEMA('Widget').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('name', 'String(50)', true);
	schema.define('category', 'String(50)');
	schema.define('body', String);
	schema.define('css', String);
	schema.define('icon', 'String(20)');
	schema.define('istemplate', Boolean);

	// Gets listing
	schema.setQuery(function(error, options, callback) {

		var sql = DB(error);

		sql.select('items', 'tbl_widget').make(function(builder) {
			builder.where('isremoved', false);
			builder.fields('id', 'icon', 'name', 'istemplate', 'category');
		});

		sql.exec(callback, 'items');
	});

	// Gets a specific widget
	schema.setGet(function(error, model, options, callback) {

		// options.url {String}
		// options.id {String}

		var sql = DB(error);

		sql.select('item', 'tbl_widget').make(function(builder) {
			builder.where('isremoved', false);
			options.url && builder.where('url', options.url);
			options.id && builder.where('id', options.id);
			builder.first();
		});

		sql.validate('item', 'error-404-widget');
		sql.exec(callback, 'item');
	});

	// Removes specific widget
	schema.setRemove(function(error, id, callback) {

		var sql = DB(error);

		sql.update('tbl_widget').make(function(builder) {
			builder.set('isremoved', true);
			builder.where('id', id);
		});

		sql.exec(() => callback(SUCCESS(true)));
	});

	// Saves the widget into the database
	schema.setSave(function(error, model, controller, callback) {

		var newbie = model.id ? false : true;
		var sql = DB();

		if (newbie) {
			model.id = UID();
			model.datecreated = F.datetime;
			model.admincreated = controller.user.name;
		} else {
			model.dateupdated = F.datetime;
			model.adminupdated = controller.user.name;
		}

		model.body = U.minifyHTML(model.body);

		sql.save('item', 'tbl_widget', newbie, function(builder) {
			builder.set(model);
			if (newbie)
				return;
			builder.set('dateupdated', F.datetime);
			builder.rem('id');
			builder.rem('datecreated');
			builder.where('id', model.id);
		});

		sql.exec(function(err) {
			callback(SUCCESS(true));
			if (err)
				return;
			F.emit('widgets.save', model);
			refresh();
		});
	});

	// Clears widget database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var sql = DB();
		sql.remove('tbl_widget');
		sql.exec(F.error());
		callback(SUCCESS(true));
	});

	// Loads widgets for rendering
	schema.addWorkflow('load', function(error, model, widgets, callback) {

		if (!widgets || !widgets.length)
			return callback(EMPTYOBJECT);

		// widgets - contains String Array of ID widgets
		var sql = DB(error);

		sql.select('items', 'tbl_widget').make(function(builder) {
			builder.in('id', widgets);
			builder.where('istemplate', false);
			builder.fields('id', 'name', 'icon', 'body');
		});

		sql.exec(function(err, response) {

			if (err) {
				error.push(err);
				return callback();
			}

			var output = {};
			for (var i = 0, length = response.items.length; i < length; i++) {
				var widget = response.items[i];
				output[widget.id] = widget;
			}

			callback(output);
		});
	});

});

function refresh() {
	var nosql = DB();

	nosql.select('items', 'widgets').make(function(builder) {
		builder.where('isremoved', false);
		builder.fields('css');
	})

	nosql.exec(function(err, response) {

		if (err)
			return;

		var builder = [];
		var docs = response.items;
		docs.forEach(item => item.css && builder.push(item.css));
		Fs.writeFile(F.path.temp(CSS), U.minifyStyle(builder.join('\n')), NOOP);
		F.touch('/' + CSS);
		F.global.css = '/' + CSS + '?ts=' + U.GUID(5);
	});
}

F.file('/' + CSS, function(req, res) {
	res.file(F.path.temp(CSS));
});