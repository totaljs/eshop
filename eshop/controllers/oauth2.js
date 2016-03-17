exports.install = function() {
	F.route('/oauth2/{type}/', oauth2_login);
	F.route('/oauth2/{type}/callback/', oauth2_login_callback);
};

function oauth2_login(type) {
	var is = false;
	var self = this;

	switch (type) {
		case 'facebook':
		case 'linkedin':
		case 'google':
		case 'github':
		case 'yandex':
		case 'vk':
		case 'yahoo':
		case 'instagram':
		case 'live':
		case 'dropbox':
			is = true;
			break;
	}

	var error = 'OAuth2 "' + type + '" is not supported.';

	if (!is) {
		self.plain(error);
		return;
	}

	var id = 'oauth2_' + type + '_key';
	var key = F.config.custom[id];

	id = 'oauth2_' + type + '_secret';
	var secret = F.config.custom[id];

	if (!key || !secret) {
		self.plain(error);
		return;
	}

	MODULE('oauth2').redirect(type, key, F.config.custom.url + '/oauth2/' + type + '/callback/', self);
}

function oauth2_login_callback(type) {
    var self = this;
    var url = F.config.custom.url + '/oauth2/' + type + '/callback/';

	var error = 'OAuth2 "' + type + '" is not supported.';

	var id = 'oauth2_' + type + '_key';
	var key = F.config.custom[id];

	id = 'oauth2_' + type + '_secret'; ;
	var secret = F.config.custom[id];

	if (!key || !secret) {
		self.plain(error);
		return;
	}

	MODULE('oauth2').callback(type, key, secret, url, self, function(err, user) {

		if (err) {
			self.plain(err);
			return;
		}

		var profile = {};
		var options = {};
		var id = 'id' + type;
		var tmp;

		profile.name = '';
		profile.email = '';
		profile.gender = null;
		profile.ip = self.ip;

		if (user.gender) {
			user.gender = user.gender.toLowerCase();
			profile.gender = user.gender === 'male' || user.gender === 'female' ? user.gender : '';
		} else if (user.sex) {
			user.sex = user.sex.toLowerCase();
			profile.gender = user.sex === 'male' || user.sex === 'female' ? user.sex : '';
		}

		switch (type) {
			case 'facebook':
				profile[id] = user.id.toString();
				profile.name = user.name;
				profile.email = user.email;
				profile.firstname = user.first_name;
				profile.lastname = user.last_name;
				break;

			case 'google':
				profile[id] = user.id.toString();
				profile.name = user.displayName;
				profile.email = user.emails[0].value;

				if (user.name) {
					profile.firstname = user.name.givenName;
					profile.lastname = user.name.familyName;
				}

				break;
			case 'instagram':
				profile[id] = user.id.toString();
				profile.name = user.full_name;
				tmp = user.full_name.split(' ');
				profile.firstname = tmp[0];
				profile.lastname = tmp[1];
				break;
			case 'dropbox':
				profile[id] = user.uid.toString();
				profile.name = user.display_name;
				profile.email = user.email;

				if (user.name_details) {
					profile.firstname = user.name_details.given_name;
					profile.lastname = user.name_details.surname;
				}

				break;
			case 'live':
				profile[id] = user.id.toString();
				profile.name = user.name;
				profile.email = user.emails.preferred;
				profile.firstname = user.first_name;
				profile.lastname = user.last_name;
				break;
			case 'yandex':
				profile[id] = user.id.toString();
				profile.name = user.real_name;
				profile.email = user.default_email;
				profile.firstname = user.first_name;
				profile.lastname = user.last_name;
				break;
			case 'linkedin':
				profile[id] = user.id.toString();
				profile.name = user.firstName + ' ' + user.lastName;
				profile.firstname = user.firstName;
				profile.lastname = user.lastName;
				profile.email = user.emailAddress;
				break;
			case 'yahoo':
				user = user.profile;
				profile[id] = user.guid.toString();
				profile.name = user.nickname;
				break;
			case 'vk':
				user = user.response[0];
				profile[id] = user.uid.toString().trim();
				profile.name = user.first_name + ' ' + user.last_name;
				profile.firstname = user.first_name;
				profile.lastname = user.last_name;
				if (user.email)
					profile.email = user.email;
				break;
		}

		if (!profile.name) {
			var error = self.invalid();
			error.push('error-user-data');
			return;
		}

		options.type = type;
		options.controller = self;
		options.profile = profile;

		GETSCHEMA('User').workflow('login', null, options, function(err, response) {
			self.redirect('/');
		}, true);
	});
}