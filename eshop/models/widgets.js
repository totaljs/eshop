NEWSCHEMA('Widget').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('name', 'String(50)', true);
	schema.define('category', 'String(50)');
	schema.define('body', String);
	schema.define('icon', 'String(20)');
	schema.define('istemplate', Boolean);
	schema.define('datecreated', Date);

	// Gets listing
	schema.setQuery(function(error, options, callback) {
		var filter = NOSQL('widgets').find();
		filter.sort('name');
		filter.fields('id', 'icon', 'name', 'category', 'istemplate');
		filter.callback((err, docs) => callback(docs));
	});

	// Gets a specific widget
	schema.setGet(function(error, model, options, callback) {
		var filter = NOSQL('widgets').one();
		options.url && filter.where('url', options.url);
		options.id && filter.where('id', options.id);
		filter.callback(callback, 'error-404-widget');
	});

	// Removes a specific widget
	schema.setRemove(function(error, id, callback) {
		NOSQL('widgets').remove().where('id', id).callback(callback);
	});

	// Saves the widget into the database
	schema.setSave(function(error, model, options, callback) {

		var newbie = model.id ? false : true;
		var nosql = NOSQL('widgets');

		if (newbie) {
			newbie = true;
			model.id = UID();
			model.datecreated = F.datetime;
		}

		(newbie ? nosql.insert(model) : nosql.modify(model).where('id', model.id)).callback(function() {
			F.emit('widgets.save', model);
			callback(SUCCESS(true));
			model.datebackuped = F.datetime;
			DB('widgets_backup').insert(model);
			setTimeout2('cache', () => F.cache.removeAll('cache.'), 1000);
		});
	});

	// Clears widget database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		NOSQL('widgets').remove();
		callback(SUCCESS(true));
	});

	// Loads widgets for rendering
	schema.addWorkflow('load', function(error, model, widgets, callback) {

		var output = {};
		var filter = NOSQL('widgets').find();

		filter.filter(function(doc) {
			if (!doc.istemplate && widgets.indexOf(doc.id) !== -1)
				output[doc.id] = doc;
		});

		filter.callback(() => callback(output));
	});

});