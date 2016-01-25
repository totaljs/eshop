NEWSCHEMA('Newsletter').make(function(schema) {

	schema.define('email', 'String(200)', true);
	schema.define('ip', 'String(80)');
	schema.define('language', 'String(3)');

	// Saves the model into the database
	schema.setSave(function(error, model, options, callback) {

		var builder = new MongoBuilder();

		model.datecreated = new Date();
		builder.where('email', model.email);

		builder.set(model);
		builder.insert(DB('newsletter'));

		F.emit('newsletter.save', model);

		// Writes stats
		MODULE('webcounter').increment('newsletter');

		// Returns response
		callback(SUCCESS(true));
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {
		var builder = new MongoBuilder();
		builder.find(DB('newsletter'), function(err, docs) {
			var buffer = '';
			for (var i = 0, length = docs.length; i < length; i++) {
				var doc = docs[i];
				buffer += doc.email + ';' + doc.ip + ';' + doc.language + ';' + doc.datecreated.format('yyyy-MM-dd') + '\n';
			}
			callback(buffer);
		});
	});

	// Performs download
	schema.addWorkflow('download', function(error, model, controller, callback) {
		var builder = new MongoBuilder();
		builder.find(DB('newsletter'), function(err, docs) {
			var buffer = '';
			for (var i = 0, length = docs.length; i < length; i++) {
				var doc = docs[i];
				buffer += doc.email + ';' + doc.ip + ';' + doc.language + ';' + doc.datecreated.format('yyyy-MM-dd') + '\n';
			}

			// Returns CSV
			controller.binary(new Buffer(buffer, 'utf8'), 'text/csv', 'utf8', 'newsletter.csv');
			callback();

		});

	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var builder = new MongoBuilder();
		builder.remove(DB('newsletter'), F.error());
		callback(SUCCESS(true));
	});
});