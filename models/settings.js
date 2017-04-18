const Fs = require('fs');
const filename = F.path.databases('settings.json');

NEWSCHEMA('SuperUser').make(function(schema) {
	schema.define('name', String, true);
	schema.define('login', String, true);
	schema.define('password', String, true);
	schema.define('roles', '[String]');
});

NEWSCHEMA('Settings').make(function(schema) {

	schema.define('currency', String, true);
	schema.define('currency_entity', String);
	schema.define('emailcontactform', 'Email', true);
	schema.define('emailorderform', 'Email', true);
	schema.define('emailreply', 'Email', true);
	schema.define('emailsender', 'Email', true);
	schema.define('emailuserform', 'Email', true);
	schema.define('url', 'Url', true);
	schema.define('templates', '[String]');
	schema.define('templatesposts', '[String]');
	schema.define('templatesproducts', '[String]');
	schema.define('posts', '[String]');
	schema.define('navigations', '[String]');
	schema.define('deliverytypes', '[String]');
	schema.define('paymenttypes', '[String]');
	schema.define('defaultorderstatus', String);
	schema.define('users', '[SuperUser]');
	schema.define('languages', '[Lower(2)]');

	// PayPal account
	schema.define('paypaluser', String);
	schema.define('paypalpassword', String);
	schema.define('paypalsignature', String);
	schema.define('paypaldebug', Boolean);

	// OAuth2
	schema.define('oauth2_facebook_key', String);
	schema.define('oauth2_facebook_secret', String);
	schema.define('oauth2_google_key', String);
	schema.define('oauth2_google_secret', String);
	schema.define('oauth2_instagram_key', String);
	schema.define('oauth2_instagram_secret', String);
	schema.define('oauth2_yahoo_key', String);
	schema.define('oauth2_yahoo_secret', String);
	schema.define('oauth2_live_key', String);
	schema.define('oauth2_live_secret', String);
	schema.define('oauth2_dropbox_key', String);
	schema.define('oauth2_dropbox_secret', String);
	schema.define('oauth2_vk_key', String);
	schema.define('oauth2_vk_secret', String);
	schema.define('oauth2_linkedin_key', String);
	schema.define('oauth2_linkedin_secret', String);

	// Saves settings into the file
	schema.setSave(function(error, model, options, callback) {
		var settings = U.extend({}, model.$clean());

		if (settings.url.endsWith('/'))
			settings.url = settings.url.substring(0, settings.url.length - 1);

		settings.datebackup = F.datetime;
		NOSQL('settings_backup').insert(JSON.parse(JSON.stringify(settings)));
		settings.datebackup = undefined;

		// Writes settings into the file
		Fs.writeFile(filename, JSON.stringify(settings), function() {
			F.emit('settings.save', settings);
			callback(SUCCESS(true));
		});
	});

	// Gets settings
	schema.setGet(function(error, model, options, callback) {
		Fs.readFile(filename, function(err, data) {
			if (err)
				settings = { 'manager-superadmin': 'admin:admin', currency: 'EUR', currency_entity: '&euro;' };
			else
				settings = data.toString('utf8').parseJSON();
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
			F.config.custom.users.push({ name: 'Administrator', login: sa[0], password: sa[1], roles: [], sa: true });

			// Optimized for the performance
			var users = {};
			for (var i = 0, length = F.config.custom.users.length; i < length; i++) {
				var user = F.config.custom.users[i];
				var key = (user.login + ':' + user.password).hash();
				users[key] = user;
			}

			F.config.custom.users = users;

			// Rewrites internal framework settings
			F.config['mail-address-from'] = F.config.custom.emailsender;
			F.config['mail-address-reply'] = F.config.custom.emailreply;

			if (!F.config.custom.languages)
				F.config.custom.languages = [];

			// Currency settings
			switch (F.config.custom.currency.toLowerCase()) {
				case 'eur':
					F.config.custom.currency_entity = '&euro; {0}';
					break;
				case 'usd':
					F.config.custom.currency_entity = '&dollar; {0}';
					break;
				case 'gbp':
					F.config.custom.currency_entity = '{0} &pound;';
					break;
				case 'jpy':
					F.config.custom.currency_entity = '&yen; {0}';
					break;
				case 'czk':
					F.config.custom.currency_entity = '{0} Kč';
					break;
				case 'brl':
					F.config.custom.currency_entity = 'R&dollar; {0}';
					break;
				default:
					F.config.custom.currency_entity = '{0} ' + F.config.custom.currency;
					break;
			}

			if (!F.config.custom.paymenttypes)
				F.config.custom.paymenttypes = [];

			if (!F.config.custom.deliverytypes)
				F.config.custom.deliverytypes = [];

			F.emit('settings', settings);
			callback(SUCCESS(true));
		});
	});
});
