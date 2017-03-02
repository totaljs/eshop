NEWSCHEMA('Newsletter').make(function(schema) {

	schema.define('email', 'Email', true);

	// Saves the model into the database
	schema.setSave(function(error, model, options, callback, controller) {

		model.datecreated = F.datetime;

		if (controller) {
			model.ip = controller.ip;
			model.language = controller.language;
		}

		var db = NOSQL('newsletter');

		db.upsert(model).where('email', model.email).callback(function(err, count) {
			if (count) {
				F.emit('newsletter.save', model);
				MODULE('webcounter').increment('newsletter');
				db.counter.hit('all', 1);
			}
		});

		callback(SUCCESS(true));
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);
		var filter = NOSQL('newsletter').find();

		options.language && filter.where('language', options.language);
		options.search && filter.like('email', options.search);

		filter.take(take);
		filter.skip(skip);
		filter.sort('datecreated');

		filter.callback(function(err, docs, count) {
			var data = {};
			data.count = count;
			data.items = docs;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max) || 1;
			data.page = options.page + 1;
			callback(data);
		});
	});

	// Performs download
	schema.addWorkflow('download', function(error, model, controller, callback) {
		NOSQL('newsletter').find().fields('email').callback(function(err, response) {

			var builder = [];
			for (var i = 0, length = response.length; i < length; i++)
				builder.push('"' + response[i].email + '"');

			controller.content(builder.join('\n'), U.getContentType('csv'), { 'Content-Disposition': 'attachment; filename="newsletter.csv"' });
			callback();
		});
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		NOSQL('newsletter').remove(F.path.databases('newsletter_removed.nosql')).callback(refresh_cache);
		callback(SUCCESS(true));
	});

	schema.addWorkflow('stats', function(error, model, options, callback) {
		NOSQL('newsletter').counter.monthly('all', callback);
	});
});