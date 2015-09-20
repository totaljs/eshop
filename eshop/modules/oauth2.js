// MIT License
// Copyright Peter Širka <petersirka@gmail.com>

var Qs = require('querystring');

exports.id = 'oauth2';
exports.version = '1.20';

var stats = { facebook: 0, google: 0,linkedin: 0, yahoo: 0, dropbox: 0, github: 0, yandex: 0, instagram: 0, twitter: 0, vk: 0 };

exports.usage = function() {
	return stats;
};

function facebook_redirect(key, url) {
	return 'https://graph.facebook.com/oauth/authorize?type=web_server&client_id={0}&redirect_uri={1}&scope=email,user_birthday,user_hometown'.format(key, encodeURIComponent(url));
}

function facebook_profile(key, secret, code, url, callback) {
	U.request('https://graph.facebook.com/oauth/access_token?client_id={0}&redirect_uri={1}&client_secret={2}&code={3}'.format(key, url, secret, code), ['get'], '', function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		U.request('https://graph.facebook.com/me?' + data + '&fields=email,first_name,last_name,gender,hometown,locale,name,address,id,timezone,picture', ['get'], '', function(err, data, status) {

			if (err)
				return callback(err, null);

			stats.facebook++;
			callback(null, JSON.parse(data));
		});
	});
}

function google_redirect(key, url) {
	return 'https://accounts.google.com/o/oauth2/auth?scope=email%20profile&redirect_uri={0}&response_type=code&client_id={1}'.format(encodeURIComponent(url), key);
}

function google_profile(key, secret, code, url, callback) {
	U.request('https://www.googleapis.com/oauth2/v3/token', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		data = JSON.parse(data);
		U.request('https://www.googleapis.com/plus/v1/people/me', ['get'], '', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.google++;
			callback(null, user);
		}, null, { 'Authorization': 'Bearer ' + data.access_token });
	});
}

function linkedin_redirect(key, url) {
	return 'https://www.linkedin.com/uas/oauth2/authorization?response_type=code&client_id={0}&redirect_uri={1}&state=987654321'.format(key, encodeURIComponent(url));
}

function linkedin_profile(key, secret, code, url, callback) {
	U.request('https://www.linkedin.com/uas/oauth2/accessToken', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		data = JSON.parse(data);
		U.request('https://api.linkedin.com/v1/people/~:(id,first-name,last-name,headline,member-url-resources,picture-url,location,public-profile-url,email-address)?format=json', ['get'], '', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.linkedin++;
			callback(null, user);
		}, null, { 'Authorization': 'Bearer ' + data.access_token });
	});
}

function yahoo_redirect(key, url) {
	return 'https://api.login.yahoo.com/oauth2/request_auth?client_id={0}&redirect_uri={1}&response_type=code&language=en-us'.format(key, encodeURIComponent(url));
}

function yahoo_profile(key, secret, code, url, callback) {
	U.request('https://api.login.yahoo.com/oauth2/get_token', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		data = JSON.parse(data);
		U.request('https://social.yahooapis.com/v1/user/' + data.xoauth_yahoo_guid + '/profile?format=json', ['get'], '', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.yahoo++;
			callback(null, user);
		}, null, { 'Authorization': 'Bearer ' + data.access_token });
	}, null, { 'Authorization': 'Basic ' + new Buffer(key + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' });
}

function twitter_profile(key, secret, code, url, callback) {
	U.request('https://api.login.yahoo.com/oauth2/get_token', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		data = JSON.parse(data);
		U.request('https://social.yahooapis.com/v1/user/' + data.xoauth_yahoo_guid + '/profile?format=json', ['get'], '', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.twitter++;
			callback(null, user);
		}, null, { 'Authorization': 'Bearer ' + data.access_token });
	}, null, { 'Authorization': 'Basic ' + new Buffer(key + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' });
}

function github_redirect(key, url) {
	return 'https://github.com/login/oauth/authorize?scope=user%3Aemail&redirect_uri={0}&response_type=code&client_id={1}'.format(encodeURIComponent(url), key);
}

function github_profile(key, secret, code, url, callback) {

	U.request('https://github.com/login/oauth/access_token', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(Qs.parse(data), null);

		data = Qs.parse(data);
		U.request('https://api.github.com/user', ['get'], '', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.github++;
			callback(null, user);
		}, null, { 'Authorization': 'Bearer ' + data.access_token, 'User-Agent': 'total.js' });
	});
}

function dropbox_redirect(key, url) {
	return 'https://www.dropbox.com/1/oauth2/authorize?redirect_uri={0}&response_type=code&client_id={1}'.format(encodeURIComponent(url), key);
}

function dropbox_profile(key, secret, code, url, callback) {
	U.request('https://api.dropbox.com/1/oauth2/token', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		data = JSON.parse(data);
		U.request('https://api.dropbox.com/1/account/info', ['get'], '', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.dropbox++;
			callback(null, user);
		}, null, { 'Authorization': 'Bearer ' + data.access_token });
	});
}

function live_redirect(key, url) {
	return 'https://login.live.com/oauth20_authorize.srf?client_id={1}&scope=wl.basic%2Cwl.signin%2Cwl.birthday%2Cwl.emails&response_type=code&redirect_uri={0}'.format(encodeURIComponent(url), encodeURIComponent(key));
}

function live_profile(key, secret, code, url, callback) {
	U.request('https://login.live.com/oauth20_token.srf', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		data = JSON.parse(data);
		U.request('https://apis.live.net/v5.0/me/', ['get'], '', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.dropbox++;
			callback(null, user);
		}, null, { 'Authorization': 'Bearer ' + data.access_token });
	});
}

function instagram_redirect(key, url) {
	return 'https://api.instagram.com/oauth/authorize/?redirect_uri={0}&response_type=code&client_id={1}&scope=basic+likes'.format(encodeURIComponent(url), key);
}

function instagram_profile(key, secret, code, url, callback) {
	U.request('https://api.instagram.com/oauth/access_token', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {
		if (err)
			return callback(err, null);
		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);
		var obj = JSON.parse(data);
		if (!obj || !obj.user)
			return callback(new Error(obj));
		stats.instagram++;
		callback(null, obj.user);
	});
}

function yandex_redirect(key, url) {
	return 'https://oauth.yandex.com/authorize/?response_type=code&client_id={1}'.format(encodeURIComponent(url), key);
}

function yandex_profile(key, secret, code, url, callback) {
	U.request('https://oauth.yandex.com/token', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		data = JSON.parse(data);
		U.request('https://login.yandex.ru/info', ['get'], '', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.yandex++;
			callback(null, user);
		}, null, { 'Authorization': 'Bearer ' + data.access_token });
	});
}

function vk_redirect(key, url) {
	return 'https://oauth.vk.com/authorize?redirect_uri={0}&response_type=code&client_id={1}&scope=email'.format(encodeURIComponent(url), key);
}

function vk_profile(key, secret, code, url, callback) {
	U.request('https://oauth.vk.com/access_token', ['post'], { code: code, client_id: key, client_secret: secret, redirect_uri: url, grant_type: 'authorization_code' }, function(err, data, status, headers) {

		if (err)
			return callback(err, null);

		if (data.indexOf('"error"') !== -1)
			return callback(JSON.parse(data), null);

		data = JSON.parse(data);

		U.request('https://api.vk.com/method/users.get', ['get'], 'uid=' + data.user_id + '&access_token=' + data.access_token + '&fields=nickname,screen_name,photo_big,sex,country,email', function(err, data, status) {
			if (err)
				return callback(err, null);
			var user = JSON.parse(data);
			stats.vk++;
			callback(null, user);
		}, null);
	});
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
