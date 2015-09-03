var Fs = require('fs');
var filename = F.path.databases('settings.json');

var SuperUser = NEWSCHEMA('SuperUser');
SuperUser.define('login', String, true);
SuperUser.define('password', String, true);
SuperUser.define('roles', '[String]');

var Settings = NEWSCHEMA('Settings');
Settings.define('currency', String, true);
Settings.define('currency_entity', String);
Settings.define('emailcontactform', String, true);
Settings.define('emailorderform', String, true);
Settings.define('emailreply', String, true);
Settings.define('emailsender', String, true);
Settings.define('url', String, true);
Settings.define('templates', '[String]');
Settings.define('navigations', '[String]');
Settings.define('deliverytypes', '[String]');
Settings.define('defaultorderstatus', String);
Settings.define('users', '[SuperUser]', true);

// PayPal account
Settings.define('paypaluser', String);
Settings.define('paypalpassword', String);
Settings.define('paypalsignature', String);
Settings.define('paypaldebug', Boolean);

// Saves settings into the file
Settings.setSave(function(error, model, options, callback) {
	var settings = U.extend({}, model.$clean());

	if (settings.url.endsWith('/'))
		settings.url = settings.url.substring(0, settings.url.length - 1);

	switch (settings.currency.toLowerCase()) {
		case 'eur':
			settings.currency_entity = '&euro;';
			break;
		case 'usd':
			settings.currency_entity = '&dollar;';
			break;
		case 'gbp':
			settings.currency_entity = '&pound;';
			break;
		case 'jpy':
			settings.currency_entity = '&yen;';
			break;
		case 'czk':
			settings.currency_entity = 'Kč';
			break;
		default:
			settings.currency_entity = settings.currency;
			break;
	}

	// Writes settings into the file
	Fs.writeFile(filename, JSON.stringify(settings), NOOP);

	// Returns response
	callback(SUCCESS(true));
});

// Gets settings
Settings.setGet(function(error, model, options, callback) {
	Fs.readFile(filename, function(err, data) {
		var settings = {};
		if (!err)
			settings = JSON.parse(data.toString('utf8'));
		callback(settings);
	});
});

// Loads settings + rewrites framework configuration
Settings.addWorkflow('load', function(error, model, options, callback) {
	Settings.get(null, function(err, settings) {

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
			users[user.login + ':' + user.password] = user;
		}

		F.config.custom.users = users;

		// Rewrites internal framework settings
		F.config['mail.address.from'] = F.config.custom.emailsender;
		F.config['mail.address.reply'] = F.config.custom.emailreply;

		// Returns response
		callback(SUCCESS(true));
	});
});