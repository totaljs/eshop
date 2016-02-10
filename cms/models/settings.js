var Fs = require('fs');
var filename = F.path.databases('settings.json');

NEWSCHEMA('SuperUser').make(function(schema) {

	schema.define('login', String, true);
	schema.define('password', String, true);
	schema.define('roles', '[String]');

});

NEWSCHEMA('Settings').make(function(schema) {

	schema.define('emailcontactform', String, true);
	schema.define('emailreply', String, true);
	schema.define('emailsender', String, true);
	schema.define('url', String, true);
	schema.define('templates', '[String]');
	schema.define('navigations', '[String]');
	schema.define('users', '[SuperUser]');

	// Saves settings into the file
	schema.setSave(function(error, model, options, callback) {
		var settings = U.extend({}, model.$clean());

		if (settings.url.endsWith('/'))
			settings.url = settings.url.substring(0, settings.url.length - 1);

		settings.datebackuped = new Date().format();
		DB('settings_backup').insert(JSON.parse(JSON.stringify(settings)));
		delete settings.datebackuped;

		// Writes settings into the file
		Fs.writeFile(filename, JSON.stringify(settings), function() {

			F.emit('settings.save', settings);

			// Returns response
			callback(SUCCESS(true));
		});
	});

	// Gets settings
	schema.setGet(function(error, model, options, callback) {
		Fs.readFile(filename, function(err, data) {
			var settings = {};
			if (!err)
				settings = JSON.parse(data.toString('utf8'));
			callback(settings);
		});
	});

	// Loads settings + rewrites framework configuration
	schema.addWorkflow('load', function(error, model, options, callback) {
		schema.get(null, function(err, settings) {

			F.config.custom = settings;

			// Refreshes internal informations
			if (!F.config.custom.users)
				F.config.custom.users = [];

			// Adds an admin (service) account
			var sa = CONFIG('manager-superadmin').split(':');
			F.config.custom.users.push({ login: sa[0], password: sa[1], roles: [], sa: true });

			// Optimized for the performance
			var users = {};
			for (var i = 0, length = F.config.custom.users.length; i < length; i++) {
				var user = F.config.custom.users[i];
				var key = (user.login + ':' + user.password).hash();
				users[key] = user;
			}

			F.config.custom.users = users;

			// Rewrites internal framework settings
			F.config['mail.address.from'] = F.config.custom.emailsender;
			F.config['mail.address.reply'] = F.config.custom.emailreply;

			// Returns response
			callback(SUCCESS(true));
		});
	});
});