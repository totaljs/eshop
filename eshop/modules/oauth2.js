// MIT License
// Copyright Peter Širka <petersirka@gmail.com>

const Qs = require('querystring');
const stats = { facebook: 0, google: 0,linkedin: 0, yahoo: 0, dropbox: 0, github: 0, yandex: 0, instagram: 0, vk: 0, live: 0 };
const OAUTH2_HEADER = { code: '', client_id: '', client_secret: '', redirect: '', grant_type: 'authorization_code' };
const OAUTH2_BEARER = { Authorization: '', 'User-Agent': 'total.js' };
const FLAG_POST = ['post'];
const FLAG_GET = ['get'];

exports.id = 'oauth2';
exports.version = 'v1.4.0';

exports.usage = function() {
	return stats;
};

function facebook_redirect(key, url) {
	return 'https://graph.facebook.com/oauth/authorize?type=web_server&client_id={0}&redirect_uri={1}&scope=email'.format(key, encodeURIComponent(url));
}

function facebook_profile(key, secret, code, url, callback) {
	U.request('https://graph.facebook.com/oauth/access_token?client_id={0}&redirect_uri={1}&client_secret={2}&code={3}'.format(key, url, secret, code), FLAG_GET, '', function(err, data) {
		if (err)
			return callback(err);
		if (data.indexOf('"error"') !== -1)
			return callback(data);
		U.request('https://graph.facebook.com/me?' + data + '&fields=email,first_name,last_name,gender,hometown,locale,name,id,timezone,picture', FLAG_GET, '', process('facebook', callback));
	});
}

function google_redirect(key, url) {
	return 'https://accounts.google.com/o/oauth2/auth?scope=email%20profile&redirect_uri={0}&response_type=code&client_id={1}'.format(encodeURIComponent(url), key);
}

function google_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://www.googleapis.com/oauth2/v3/token', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (!process_error(err, data, callback))
			return;
		OAUTH2_BEARER.Authorization = 'Bearer ' + data.parseJSON().access_token;
		U.request('https://www.googleapis.com/plus/v1/people/me', FLAG_GET, '', process('google', callback), null, OAUTH2_BEARER);
	});
}

function linkedin_redirect(key, url) {
	return 'https://www.linkedin.com/uas/oauth2/authorization?response_type=code&client_id={0}&redirect_uri={1}&state=987654321'.format(key, encodeURIComponent(url));
}

function linkedin_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://www.linkedin.com/uas/oauth2/accessToken', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (!process_error(err, data, callback))
			return;
		OAUTH2_BEARER.Authorization = 'Bearer ' + data.parseJSON().access_token;
		U.request('https://api.linkedin.com/v1/people/~:(id,first-name,last-name,headline,member-url-resources,picture-url,location,public-profile-url,email-address)?format=json', FLAG_GET, '', process('linkedin', callback), null, OAUTH2_BEARER);
	});
}

function yahoo_redirect(key, url) {
	return 'https://api.login.yahoo.com/oauth2/request_auth?client_id={0}&redirect_uri={1}&response_type=code&language=en-us'.format(key, encodeURIComponent(url));
}

function yahoo_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://api.login.yahoo.com/oauth2/get_token', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (!process_error(err, data, callback))
			return;
		OAUTH2_BEARER.Authorization = 'Bearer ' + data.parseJSON().access_token;
		U.request('https://social.yahooapis.com/v1/user/' + data.xoauth_yahoo_guid + '/profile?format=json', FLAG_GET, '', process('yahoo', callback), null, OAUTH2_BEARER);
	}, null, { 'Authorization': 'Basic ' + new Buffer(key + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' });
}

function github_redirect(key, url) {
	return 'https://github.com/login/oauth/authorize?scope=user%3Aemail&redirect_uri={0}&response_type=code&client_id={1}'.format(encodeURIComponent(url), key);
}

function github_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://github.com/login/oauth/access_token', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (err)
			return callback(err);
		OAUTH2_BEARER.Authorization = 'Bearer ' + Qs.parse(data).access_token;
		U.request('https://api.github.com/user', FLAG_GET, '', process('github', callback), null, OAUTH2_BEARER);
	});
}

function dropbox_redirect(key, url) {
	return 'https://www.dropbox.com/1/oauth2/authorize?redirect_uri={0}&response_type=code&client_id={1}'.format(encodeURIComponent(url), key);
}

function dropbox_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://api.dropbox.com/1/oauth2/token', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (!process_error(err, data, callback))
			return;
		OAUTH2_BEARER.Authorization = 'Bearer ' + data.parseJSON().access_token;
		U.request('https://api.dropbox.com/1/account/info', FLAG_GET, '', process('dropbox', callback), null, OAUTH2_BEARER);
	});
}

function live_redirect(key, url) {
	return 'https://login.live.com/oauth20_authorize.srf?client_id={1}&scope=wl.basic%2Cwl.signin%2Cwl.birthday%2Cwl.emails&response_type=code&redirect_uri={0}'.format(encodeURIComponent(url), encodeURIComponent(key));
}

function live_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://login.live.com/oauth20_token.srf', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (!process_error(err, data, callback))
			return;
		OAUTH2_BEARER.Authorization = 'Bearer ' + data.parseJSON().access_token;
		U.request('https://apis.live.net/v5.0/me/', FLAG_GET, '', process('live', callback), null, OAUTH2_BEARER);
	});
}

function instagram_redirect(key, url) {
	return 'https://api.instagram.com/oauth/authorize/?redirect_uri={0}&response_type=code&client_id={1}&scope=basic+likes'.format(encodeURIComponent(url), key);
}

function instagram_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://api.instagram.com/oauth/access_token', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (!process_error(err, data, callback))
			return;
		process('instagram', callback)(null, data);
	});
}

function yandex_redirect(key, url) {
	return 'https://oauth.yandex.com/authorize/?response_type=code&client_id={1}'.format(encodeURIComponent(url), key);
}

function yandex_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://oauth.yandex.com/token', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (!process_error(err, data, callback))
			return;
		OAUTH2_BEARER.Authorization = 'Bearer ' + data.parseJSON().access_token;
		U.request('https://login.yandex.ru/info', FLAG_GET, '', process('yandex', callback), null, OAUTH2_BEARER);
	});
}

function vk_redirect(key, url) {
	return 'https://oauth.vk.com/authorize?redirect_uri={0}&response_type=code&client_id={1}&scope=email'.format(encodeURIComponent(url), key);
}

function vk_profile(key, secret, code, url, callback) {

	OAUTH2_HEADER.code = code;
	OAUTH2_HEADER.client_id = key;
	OAUTH2_HEADER.client_secret = secret;
	OAUTH2_HEADER.redirect_uri = url;

	U.request('https://oauth.vk.com/access_token', FLAG_POST, OAUTH2_HEADER, function(err, data) {
		if (!process_error(err, data, callback))
			return;
		data = data.parseJSON();
		U.request('https://api.vk.com/method/users.get', FLAG_GET, 'uid=' + data.user_id + '&access_token=' + data.access_token + '&fields=nickname,screen_name,photo_big,sex,country,email', process('vk', callback));
	});
}

function process_error(err, data, callback) {

	if (err) {
		callback(err);
		return;
	}

	if (!data.trim().isJSON()) {
		callback(data);
		return;
	}

	if (data.indexOf('"error"') !== -1) {
		callback(data.parseJSON());
		return;
	}

	return true;
}

function process(name, callback) {
	return function(err, data) {

		stats[name]++;

		if (err) {
			callback(err);
			return;
		}

		var user = data.parseJSON();

		if (!user) {
			callback(new Error('User data from OAuth2 ' + name + ' doesn\'t exist.'), user);
			return;
		}

		if (name === 'yahoo') {
			if (!user.profile && !user.guid) {
				err = user;
				user = null;
			}
		} else if (!user.id && !user.uid) {
			err = user;
			user = null;
		}

		callback(err, user);
	};
}

exports.redirect = function(type, key, url, controller) {
	switch (type) {
		case 'facebook':
			controller.redirect(facebook_redirect(key, url));
			break;
		case 'google':
			controller.redirect(google_redirect(key, url));
			break;
		case 'yahoo':
			controller.redirect(yahoo_redirect(key, url));
			break;
		case 'linkedin':
			controller.redirect(linkedin_redirect(key, url));
			break;
		case 'github':
			controller.redirect(github_redirect(key, url));
			break;
		case 'dropbox':
			controller.redirect(dropbox_redirect(key, url));
			break;
		case 'live':
			controller.redirect(live_redirect(key, url));
			break;
		case 'instagram':
			controller.redirect(instagram_redirect(key, url));
			break;
		case 'yandex':
			controller.redirect(yandex_redirect(key, url));
			break;
		case 'vk':
			controller.redirect(vk_redirect(key, url));
			break;
	}
};

exports.callback = function(type, key, secret, url, controller, callback) {
	switch (type) {
		case 'facebook':
			facebook_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'google':
			google_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'yahoo':
			yahoo_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'linkedin':
			linkedin_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'github':
			github_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'dropbox':
			dropbox_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'live':
			live_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'instagram':
			instagram_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'yandex':
			yandex_profile(key, secret, controller.query.code, url, callback);
			break;
		case 'vk':
			vk_profile(key, secret, controller.query.code, url, callback);
			break;
	}
};

exports.facebook_redirect = facebook_redirect;
exports.facebook_profile = facebook_profile;
exports.google_redirect = google_redirect;
exports.google_profile = google_profile;
exports.linkedin_redirect = linkedin_redirect;
exports.linkedin_profile = linkedin_profile;
exports.yahoo_redirect = yahoo_redirect;
exports.yahoo_profile = yahoo_profile;
exports.github_redirect = github_redirect;
exports.github_profile = github_profile;
exports.dropbox_redirect = dropbox_redirect;
exports.dropbox_profile = dropbox_profile;
exports.live_profile = live_profile;
exports.live_redirect = live_redirect;
exports.instagram_profile = instagram_profile;
exports.instagram_redirect = instagram_redirect;
exports.yandex_profile = yandex_profile;
exports.yandex_redirect = yandex_redirect;
exports.vk_profile = vk_profile;
exports.vk_redirect = vk_redirect;
