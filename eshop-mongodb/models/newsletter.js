NEWSCHEMA('Newsletter').make(function(schema) {

	schema.define('email', 'Email', true);
	schema.define('ip', 'String(80)');
	schema.define('language', 'Lower(2)');

	// Saves the model into the database
	schema.setSave(function(error, model, options, callback) {

		model.datecreated = F.datetime;

		var nosql = DB(error);
		nosql.insert('newsletter').set(model);
		nosql.exec(SUCCESS(callback), -1);
		F.emit('newsletter.save', model);

		// Writes stats
		MODULE('webcounter').increment('newsletter');
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {
		var nosql = DB(error);
		nosql.select('newsletter');
		nosql.exec(function(err, docs) {

			if (err)
				return callback();

			var buffer = [];
			for (var i = 0, length = docs.length; i < length; i++) {
				var doc = docs[i];
				buffer.push(doc.email + ';' + doc.ip + ';' + doc.language + ';' + doc.datecreated.format('yyyy-MM-dd'));
			}

			callback(buffer.join('\n'));
		}, 0);
	});

	// Performs download
	schema.addWorkflow('download', function(error, model, controller, callback) {
		schema.query(function(err, response) {
			controller.binary(new Buffer(buffer, 'utf8'), 'text/csv', 'utf8', 'newsletter.csv');
			callback();
		});
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var nosql = DB(error);
		nosql.remove('newsletter');
		nosql.exec(SUCCESS(callback));
	});
});