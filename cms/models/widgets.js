NEWSCHEMA('Widget').make(function(schema) {

	schema.define('id', 'String(10)');
	schema.define('name', 'String(50)', true);
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

		var filter = function(doc) {
			return { id: doc.id, icon: doc.icon, name: doc.name, istemplate: doc.istemplate };
		};

		DB('widgets').all(filter, function(err, docs, count) {
			callback(docs);
		});
	});

	// Gets a specific widget
	schema.setGet(function(error, model, options, callback) {

		// options.url {String}
		// options.id {String}

		// Filter for reading
		var filter = function(doc) {

			if (options.url && doc.url !== options.url)
				return;

			if (options.id && doc.id !== options.id)
				return;

			return doc;
		};

		// Gets a specific document
		DB('widgets').one(filter, function(err, doc) {

			if (doc)
				return callback(doc);

			error.push('error-404-widget');
			callback();
		});
	});

	// Removes specific widget
	schema.setRemove(function(error, id, callback) {

		// Filter for removing
		var updater = function(doc) {
			if (doc.id !== id)
				return doc;
			return null;
		};

		// Updates database file
		DB('widgets').update(updater, callback);
	});

	// Saves the widget into the database
	schema.setSave(function(error, model, options, callback) {

		// options.id {String}
		// options.url {String}

		var count = 0;

		if (!model.id)
			model.id = U.GUID(10);

		if (model.datecreated)
			model.datecreated = model.datecreated.format();

		// Filter for updating
		var updater = function(doc) {
			if (doc.id !== model.id)
				return doc;
			count++;
			return model;
		};

		// Updates database file
		DB('widgets').update(updater, function() {

			// Creates record if not exists
			if (count === 0)
				DB('widgets').insert(model);

			// Returns response
			callback(SUCCESS(true));
		});
	});

	// Clears widget database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		DB('widgets').clear(NOOP);
		callback(SUCCESS(true));
	});

	// Loads widgets for rendering
	schema.addWorkflow('load', function(error, model, widgets, callback) {

		// widgets - contains String Array of ID widgets

		var output = {};

		var filter = function(doc) {
			if (doc.istemplate)
				return;
			if (widgets.indexOf(doc.id) !== -1)
				output[doc.id] = doc;
		};

		DB('widgets').all(filter, function() {
			callback(output);
		});
	});

});