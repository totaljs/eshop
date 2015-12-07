NEWSCHEMA('Widget').make(function(schema) {

	schema.define('id', 'String(10)');
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
		var builder = new MongoBuilder();
		builder.where('isremoved', false);
		builder.fields('id', 'icon', 'name', 'category', 'istemplate');
		builder.sort('name');
		builder.find(DB('widgets'), callback);
	});

	// Gets a specific widget
	schema.setGet(function(error, model, options, callback) {

		// options.url {String}
		// options.id {String}

		var builder = new MongoBuilder();
		builder.where('isremoved', false);

		if (options.url)
			builder.where('url', options.url);

		if (options.id)
			builder.where('id', options.id);

		builder.findOne(DB('widgets'), function(err, doc) {
			if (doc)
				return callback(doc);
			error.push('error-404-widget');
			callback();
		});
	});

	// Removes specific widget
	schema.setRemove(function(error, id, callback) {
		var builder = new MongoBuilder();
		builder.where('id', id);
		builder.where('isremoved', false);
		builder.set('isremoved', true);
		builder.updateOne(DB('widgets'), callback);
	});

	// Saves the widget into the database
	schema.setSave(function(error, model, options, callback) {

		// options.id {String}
		// options.url {String}

		var count = 0;
		var isnew = false;

		if (!model.id) {
			model.id = U.GUID(10);
			model.datecreated = new Date();
			isnew = true;
		} else
			model.dateupdated = new Date();

		model.isremoved = false;

		var builder = new MongoBuilder();
		builder.set(model);

		var cb = function(err, doc) {
			// Returns response
			callback(SUCCESS(true));
		};

		if (isnew)
			builder.insert(DB('widgets'), cb);
		else
			builder.updateOne(DB('widgets'), cb);
	});

	// Clears widget database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var builder = new MongoBuilder();
		builder.remove(DB('widgets'), F.error());
		callback(SUCCESS(true));
	});

	// Loads widgets for rendering
	schema.addWorkflow('load', function(error, model, widgets, callback) {

		// widgets - contains String Array of ID widgets

		var output = {};
		var builder = new MongoBuilder();

		builder.in('id', widgets);
		builder.where('isremoved', false);

		var filter = function(doc) {
			if (doc.istemplate)
				return;
			if (widgets.indexOf(doc.id) !== -1)
				output[doc.id] = doc;
		};

		builder.find(DB('widgets'), function(err, docs) {
			for (var i = 0, length = docs.length; i < length; i++)
				output[docs[i].id] = docs[i];
			callback(output);
		});
	});

});