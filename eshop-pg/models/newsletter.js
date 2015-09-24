var Newsletter = NEWSCHEMA('Newsletter');
Newsletter.define('email', 'String(200)', true);
Newsletter.define('ip', 'String(80)');
Newsletter.define('language', 'String(3)');

// Saves the model into the database
Newsletter.setSave(function(error, model, options, callback) {

	// Saves to database
	var sql = DB();

	// Checks if the email exists in DB.
	sql.exists('email', 'tbl_newsletter').where('email', model.email);

	// If yes, then skips inserting
	sql.validate(function(error, response, resume) {
		if (response.email)
			return resume(false);
		resume();
	});

	sql.insert('tbl_newsletter').set(model).primary('email');
	sql.exec(F.error());

	// Writes stats
	MODULE('webcounter').increment('newsletter');

	// Returns response
	callback(SUCCESS(true));
});

// Gets listing
Newsletter.setQuery(function(error, options, callback) {

	var sql = DB(error);

	sql.select('newsletter', 'tbl_newsletter');
	sql.exec(function(err, response) {

		if (err)
			return callback();

		var output = '';
		for (var i = 0, length = response.newsletter.length; i < length; i++) {
			var item = response.newsletter[i];
			output += item.email + ';' + item.ip + ';' + item.language + ';' + item.datecreated.format('yyyy-MM-dd') + '\n';
		}

		callback(output);
	});
});

// Performs download
Newsletter.addWorkflow('download', function(error, model, controller, callback) {

	var sql = DB(error);
	sql.select('newsletter', 'tbl_newsletter');
	sql.exec(function(err, response) {

		if (err)
			return callback();

		// Creates CSV
		var output = '';
		for (var i = 0, length = response.newsletter.length; i < length; i++) {
			var item = response.newsletter[i];
			output += item.email + ';' + item.ip + ';' + item.language + ';' + item.datecreated.format('yyyy-MM-dd') + '\n';
		}

		controller.content(output, 'text/csv', { 'Content-Disposition': 'attachment; filename=newsletter.csv' });
		callback();
	});

});

// Clears DB
Newsletter.addWorkflow('clear', function(error, model, options, callback) {
	var sql = DB();
	sql.remove('tbl_newsletter');
	sql.exec(F.error());
	callback(SUCCESS(true));
});