const Fs = require('fs');
const filename = F.path.databases('newsletter.csv');

NEWSCHEMA('Newsletter').make(function(schema) {

	schema.define('email', 'Email', true);
	schema.define('ip', 'String(80)');
	schema.define('language', 'Lower(2)');

	// Saves the model into the database
	schema.setSave(function(error, model, options, callback, controller) {

		model.datecreated = F.datetime;
		model.ip = controller.ip;
		model.language = controller.language;

		var nosql = DB(error);
		nosql.insert('newsletter').set(model);
		nosql.exec(function(err, doc) {
			if (doc) {
				F.emit('newsletter.save', model);
				MODULE('webcounter').increment('newsletter');
			}
		}, -1);

		callback(SUCCESS(true));
	});
        
	// Gets listing
	schema.setQuery(function(error, options, callback) {
                // options.search {String}
		// options.navigation {String}
		// options.language {String}
		// options.ispartial {Boolean}
		// options.page {String or Number}
		// options.max {String or Number}

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.page < 0)
			options.page = 0;

                var nosql = DB(error);
		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);
                
                nosql.listing('newsletter', 'newsletter').make(function(builder) {

			options.language && builder.where('language', options.language);
			options.search && builder.in('search', options.search);

			builder.fields('email', 'ip','language');
			builder.sort('datecreated');
			builder.take(take);
			builder.skip(skip);
		});
                
                nosql.exec(function(err, response) {

			var data = {};
			data.count = response.pages.count;
			data.items = response.pages.items;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max) || 1;
			data.page = options.page + 1;

			callback(data);
		});
	});

	// Performs download
	schema.addWorkflow('download', function(error, model, controller, callback) {
		schema.query(function(err, response) {

			var builder = [];
			for (var i = 0, length = response.length; i < length; i++)
				builder.push('"' + response[i].email + '"');

			controller.content(builder.join('\n'), U.getContentType('csv'), { 'Content-Disposition': 'attachment; filename="newsletter.csv"' });
			callback();
		});
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var nosql = DB(error);
		nosql.remove('newsletter');
		nosql.exec(SUCCESS(callback));
	});

	schema.addWorkflow('stats', function(error, model, options, callback) {
		NOSQL('newsletter').counter.monthly('all', callback);
	});
});