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
		var filter = DB('widgets').find();
		filter.sort('name');
		filter.fields('id', 'icon', 'name', 'category', 'istemplate');
		filter.callback((err, docs) => callback(docs));
	});

	// Gets a specific widget
	schema.setGet(function(error, model, options, callback) {

		// options.url {String}
		// options.id {String}

		// Gets a specific document
		var filter = DB('widgets').one();

		if (options.url)
			filter.where('url', options.url);

		if (options.id)
			filter.where('id', options.id);

		filter.callback(callback, 'error-404-widget');
	});

	// Removes a specific widget
	schema.setRemove(function(error, id, callback) {
		// Updates database file
		DB('widgets').remove().where('id', id).callback(callback);
	});

	// Saves the widget into the database
	schema.setSave(function(error, model, options, callback) {

		// options.id {String}
		// options.url {String}

		var newbie = false;

		if (!model.id) {
			newbie = true;
			model.id = UID();
		}


		var fn = function(err, count) {
			// Returns response
			callback(SUCCESS(true));

			if (!count)
				return;

			F.emit('widgets.save', model);

			if (newbie)
				return;

			model.datebackuped = new Date();
			DB('widgets_backup').insert(model);
		};

		if (newbie) {
			DB('widgets').insert(model).callback(fn);
			return;
		}

		DB('widgets').update(model).where('id', model.id).callback(fn);
	});

	// Clears widget database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		DB('widgets').remove();
		callback(SUCCESS(true));
	});

	// Loads widgets for rendering
	schema.addWorkflow('load', function(error, model, widgets, callback) {
		// widgets - contains String Array of ID widgets
		var output = {};

		var filter = DB('widgets').find();

		filter.filter(function(doc) {
			if (doc.istemplate)
				return;
			if (widgets.indexOf(doc.id) !== -1)
				output[doc.id] = doc;
		});

		filter.callback(() => callback(output));
	});

});