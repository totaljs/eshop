var Widget = NEWSCHEMA('Widget')
Widget.define('id', 'String(10)');
Widget.define('name', 'String(50)', true);
Widget.define('body', String);
Widget.define('icon', 'String(20)');
Widget.define('istemplate', Boolean);
Widget.define('datecreated', Date);

// Sets default values
Widget.setDefault(function(name) {
	switch (name) {
		case 'datecreated':
			return new Date();
	}
});

// Gets listing
Widget.setQuery(function(error, options, callback) {

	var sql = DB();

	sql.select('items', 'tbl_widget').make(function(builder) {
		builder.where('isremoved', false);
		builder.fields('id', 'icon', 'name', 'istemplate');
	});

	sql.exec(callback, 'items');
});

// Gets a specific widget
Widget.setGet(function(error, model, options, callback) {

	// options.url {String}
	// options.id {String}

	var sql = DB();

	sql.select('item', 'tbl_widget').make(function(builder) {
		builder.where('isremoved', false);
		if (options.url)
			builder.where('url', options.url);
		if (options.id)
			builder.where('id', options.id);
		builder.first();
	});

	sql.validate('item', 'error-404-widget');
	sql.exec(callback, 'item');
});

// Removes specific widget
Widget.setRemove(function(error, id, callback) {

	var sql = DB();

	sql.update('tbl_widget').make(function(builder) {
		builder.set('isremoved', true);
		builder.where('id', id);
	});

	sql.exec(function(err) {
		error.push(err);
		callback(SUCCESS(true));
	});
});

// Saves the widget into the database
Widget.setSave(function(error, model, options, callback) {

	// options.id {String}
	// options.url {String}

	var count = 0;
	var isNew = model.id ? false : true;
	var sql = DB();

	if (!model.id)
		model.id = U.GUID(10);

	sql.save('item', 'tbl_widget', isNew, function(builder, isNew) {
		builder.set(model);
		if (isNew)
			return;
		builder.rem('id');
		builder.rem('datecreated');
		builder.where('id', model.id);
	});

	sql.exec(function(err) {
		// Returns response
		callback(SUCCESS(true));
	});
});

// Clears widget database
Widget.addWorkflow('clear', function(error, model, options, callback) {
	var sql = DB();
	sql.remove('tbl_widget');
	sql.exec(F.error());
	callback(SUCCESS(true));
});

// Loads widgets for rendering
Widget.addWorkflow('load', function(error, model, widgets, callback) {

	// widgets - contains String Array of ID widgets
	var sql = DB();
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