var Fs = require('fs');
var filename = F.path.databases('newsletter.csv');

var Newsletter = NEWSCHEMA('Newsletter');
Newsletter.define('email', 'String(200)', true);
Newsletter.define('ip', 'String(80)');
Newsletter.define('language', 'String(3)');

// Saves the model into the database
Newsletter.setSave(function(error, model, options, callback) {

	// Appends new email into tohe newsletter file
	Fs.appendFile(filename, model.email + ';' + model.ip + ';' + model.language + ';' + (new Date()).format('yyyy-MM-dd') + '\n');

	// Writes stats
	MODULE('webcounter').increment('newsletter');

	// Returns response
	callback(SUCCESS(true));
});

// Gets listing
Newsletter.setQuery(function(error, options, callback) {
	Fs.readFile(filename, function(err, buffer) {
		if (err)
			buffer = '';
		else if (buffer)
			buffer = buffer.toString('utf8');
		callback(buffer);
	});
});

// Performs download
Newsletter.addWorkflow('download', function(error, model, controller, callback) {
	// Returns CSV
	controller.file('~' + filename, 'newsletter.csv');
	callback();
});

// Clears DB
Newsletter.addWorkflow('clear', function(error, model, options, callback) {
	Fs.unlink(filename, NOOP);
	callback(SUCCESS(true));
});