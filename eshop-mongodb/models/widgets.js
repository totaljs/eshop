NEWSCHEMA('Widget').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('name', 'String(50)', true);
	schema.define('category', 'String(50)');
	schema.define('body', String);
	schema.define('icon', 'String(20)');
	schema.define('istemplate', Boolean);
	schema.define('datecreated', Date);

	// Sets default values
	schema.setDefault(function(name) {
		switch (name) {
			case 'datecreated':
				return new Date();
		}
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {
		var nosql = DB(error);
		nosql.select('widgets').make(function(builder) {
			builder.where('isremoved', false);
			builder.fields('id', 'icon', 'name', 'category', 'istemplate');
			builder.sort('name');
		});

		nosql.exec(callback, 0);
	});

	// Gets a specific widget
	schema.setGet(function(error, model, options, callback) {

		// options.url {String}
		// options.id {String}

		var nosql = DB(error);

		nosql.select('widgets', 'widgets').make(function(builder) {
			builder.where('isremoved', false);

			if (options.url)
				builder.where('url', options.url);

			if (options.id)
				builder.where('id', options.id);

			builder.first();
		});

		nosql.validate('widgets', 'error-404-widget');
		nosql.exec(callback, 'widgets');
	});

	// Removes a specific widget
	schema.setRemove(function(error, id, callback) {
		var nosql = DB(error);

		nosql.update('widgets').make(function(builder) {
			builder.set('isremoved', true);
			builder.where('id', id);
			builder.where('isremoved', false);
			builder.first();
		});

		nosql.exec(SUCCESS(callback), -1);
	});

	// Saves the widget into the database
	schema.setSave(function(error, model, options, callback) {

		// options.id {String}
		// options.url {String}

		var isnew = false;

		if (!model.id) {
			model.id = UID();
			model.datecreated = new Date();
			isnew = true;
		} else
			model.dateupdated = new Date();

		model.isremoved = false;

		var nosql = DB(error);

		nosql.save('widgets', 'widgets', isnew, function(builder) {
			builder.set(model);
			if (isnew)
				return;
			builder.set('dateupdated', new Date());
			builder.rem('datecreated');
			builder.rem('id');
			builder.where('id', model.id);
		});

		nosql.exec(function(err, response) {
			// Returns response
			callback(SUCCESS(true));
			if (err)
				return;
			F.emit('widgets.save', model);
		});
	});

	// Clears widget database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var nosql = DB(error);
		nosql.remove('widgets');
		nosql.exec(SUCCESS(callback));
	});

	// Loads widgets for rendering
	schema.addWorkflow('load', function(error, model, widgets, callback) {

		// widgets - contains String Array of ID widgets

		var output = {};
		var nosql = DB(error);

		nosql.select('widgets').make(function(builder) {
			builder.in('id', widgets);
			builder.where('isremoved', false);
		});

		nosql.exec(function(err, docs) {
			for (var i = 0, length = docs.length; i < length; i++)
				output[docs[i].id] = docs[i];
			callback(output);
		}, 0);
	});
});