// MIT License
// Copyright 2017 (c) Peter Širka <petersirka@gmail.com>

const CONCAT = [];
const COOKIE = 'visit';
const DBNAME = 'visitors';
const REG_ROBOT = /search|agent|bot|crawler/i;
const TIMEOUT_VISITORS = 1200; // 20 MINUTES
const VISITOR = {};
const Fs = require('fs');

var FILE_CACHE = 'visitors.cache';
var W = {};

W.stats = { pages: 0, day: 0, month: 0, year: 0, hits: 0, unique: 0, uniquemonth: 0, count: 0, search: 0, direct: 0, social: 0, unknown: 0, advert: 0, mobile: 0, desktop: 0, visitors: 0, robots: 0, hours: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
W.online = 0;
W.arr = [0, 0];
W.interval = 0;
W.index = 0;
W.current = 0;
W.last = 0;
W.lastvisit = null;
W.social = ['plus.url.google', 'plus.google', 'twitter', 'facebook', 'linkedin', 'tumblr', 'flickr', 'instagram', 'vkontakte', 'snapchat', 'skype', 'whatsapp', 'wechat'];
W.search = ['google', 'bing', 'yahoo', 'duckduckgo', 'yandex', 'seznam'];

W.$blacklist = null;
W.$blacklistlength = 0;

W.blacklist = function(path) {
	!W.$blacklist && (W.$blacklist = []);
	W.$blacklist.push(path);
	W.$blacklistlength = W.$blacklist.length;
	return W;
};

W.clean = function() {

	W.index++;
	W.index % 2 === 0 && W.save();

	F.datetime = new Date();
	W.current = F.datetime.getTime();

	var stats = W.stats;
	var day = F.datetime.getDate();
	var month = F.datetime.getMonth() + 1;
	var year = F.datetime.getFullYear();

	if (stats.day !== day || stats.month !== month || stats.year !== year) {
		if (stats.day || stats.month || stats.year) {
			W.append();
			var visitors = stats.visitors;
			var keys = Object.keys(stats);
			for (var i = 0, length = keys.length; i < length; i++) {
				if (keys[i] === 'hours') {
					for (var j = 0; j < stats.hours.length; j++)
						stats.hours[j] = 0;
				} else
					stats[keys[i]] = 0;
			}
			stats.visitors = visitors;
		}
		stats.day = day;
		stats.month = month;
		stats.year = year;
		W.index = 0;
		W.save();
	}

	var arr = W.arr;
	var tmp1 = arr[1];
	var tmp0 = arr[0];

	arr[1] = 0;
	arr[0] = tmp1;

	if (tmp0 !== arr[0] || tmp1 !== arr[1]) {
		var online = arr[0] + arr[1];
		if (online != W.last)
			W.last = online;
	}
};

W.increment = W.inc = function(type) {
	if (W.stats[type])
		W.stats[type]++;
	else
		W.stats[type] = 1;
	return W;
};

W.counter = function(req, res) {

	var h = req.headers;
	var agent = h['user-agent'];

	if (!agent)
		return false;

	// Custom header defined on client-side:
	var url = h['x-ping'];
	if (!url)
		return false;

	if (!agent || (W.$blacklist && isBlacklist(url)))
		return false;

	if (REG_ROBOT.test(agent)) {
		W.stats.robots++;
		return false;
	}

	if (!h['accept'] || !h['accept-language'])
		return false;

	var cookies = h['x-cookies'];

	// CORS request
	if (!cookies || cookies === '0') {
		// Writes referrer only
		VISITOR.referer = getHostname(h['x-referrer'] || h['x-referer'] || h['referer']);
		VISITOR.referer && VISITOR.referer.indexOf(W.hostname) === -1 && NOSQL(DBNAME).counter.hit(VISITOR.referer);
		return false;
	}

	F.datetime = new Date();

	var cookie = req.cookie(COOKIE);
	req.idvisitor = cookie ? cookie.substring(cookie.length - 5) : Math.random().toString().substring(2, 7);

	var user = cookie ? cookie.substring(0, cookie.length - 5).parseInt() : 0;
	var ticks = F.datetime.getTime();
	var sum = user ? (ticks - user) / 1000 : 1000;
	var exists = sum < 91;

	req.lastvisit = user;

	if (user)
		sum = Math.abs(W.current - user) / 1000;

	var isHits = user ? sum >= TIMEOUT_VISITORS : true;

	if (isHits)
		W.stats.hits++;

	VISITOR.id = req.idvisitor;
	VISITOR.unique = false;
	VISITOR.ping = h['x-reading'] === '1';

	if (exists) {
		F.$events.visitor && W.emitvisitor('browse', req);
		return true;
	}

	if (user) {

		// 20 minutes
		if (sum < TIMEOUT_VISITORS) {
			W.arr[1]++;
			W.lastvisit = F.datetime;
			res.cookie(COOKIE, ticks + req.idvisitor, F.datetime.add('5 days'));
			F.$events.visitor && W.emitvisitor('visitor', req);
			return true;
		}

		var date = new Date(user);
		if (date.getDate() !== F.datetime.getDate() || date.getMonth() !== F.datetime.getMonth() || date.getFullYear() !== F.datetime.getFullYear())
			VISITOR.unique = true;

		date.diff('months') < 0 && (W.stats.uniquemonth++);

	} else {
		VISITOR.unique = true;
		W.stats.uniquemonth++;
	}

	if (VISITOR.unique) {
		W.stats.unique++;
		if (req.mobile)
			W.stats.mobile++;
		else
			W.stats.desktop++;
	}

	W.arr[1]++;
	W.lastvisit = F.datetime;
	res.cookie(COOKIE, ticks + req.idvisitor, F.datetime.add('5 days'));

	var online = W.arr[0] + W.arr[1];
	var hours = F.datetime.getHours();

	if (W.stats.hours[hours] < online)
		W.stats.hours[hours] = online;

	if (W.last !== online)
		W.last = online;

	W.stats.count++;
	W.stats.visitors++;

	if (req.query.utm_medium || req.query.utm_source) {
		W.stats.advert++;
		F.$events.visitor && W.emitvisitor('advert', req);
		return true;
	}

	VISITOR.referer = getHostname(h['x-referrer'] || h['x-referer'] || h['referer']);

	if (!VISITOR.referer || (W.hostname && VISITOR.referer.indexOf(W.hostname) !== -1)) {
		W.stats.direct++;
		F.$events.visitor && W.emitvisitor('direct', req);
		return true;
	}

	VISITOR.referer && VISITOR.unique && NOSQL(DBNAME).counter.hit(VISITOR.referer);

	for (var i = 0, length = W.social.length; i < length; i++) {
		if (VISITOR.referer.indexOf(W.social[i]) !== -1) {
			W.stats.social++;
			F.$events.visitor && W.emitvisitor('social', req);
			return true;
		}
	}

	for (var i = 0, length = W.search.length; i < length; i++) {
		if (VISITOR.referer.indexOf(W.search[i]) !== -1) {
			W.stats.search++;
			F.$events.visitor && W.emitvisitor('search', req);
			return true;
		}
	}

	W.stats.unknown++;
	F.$events.visitor && W.emitvisitor('unknown', req);
	return true;
};

W.emitvisitor = function(type, req) {
	VISITOR.url = req.headers['x-ping'] || req.url;
	VISITOR.ip = req.ip;
	VISITOR.type = type;
	VISITOR.online = W.arr[0] + W.arr[1];
	VISITOR.mobile = req.mobile;
	VISITOR.user = req.user ? (req.user.name || req.user.alias) : null;
	EMIT('visitor', VISITOR);
};

W.save = function() {
	var filename = F.path.databases(FILE_CACHE);
	var stats = U.copy(W.stats);
	stats.pages = stats.hits && stats.count ? (stats.hits / stats.count).floor(2) : 0;
	Fs.writeFile(filename, JSON.stringify(stats), NOOP);
};

W.load = function() {

	if (F.isCluster && F.id)
		FILE_CACHE = FILE_CACHE.replace('.', F.id + '.');

	var filename = F.path.databases(FILE_CACHE);

	Fs.readFile(filename, function(err, data) {
		if (err)
			return;

		U.copy(data.toString('utf8').parseJSON(true), W.stats);

		Object.keys(W.stats).forEach(function(key) {
			if (key !== 'hours' && W.stats[key] == null)
				W.stats[key] = 0;
		});

		if (!W.stats.hours || W.stats.hours.length !== 24) {
			W.stats.hours = [];
			for (var i = 0; i < 24; i++)
				W.stats.hours.push(0);
		}
	});
};

W.append = function() {
	var stats = U.clone(W.stats);
	NOSQL(DBNAME).update(function(doc) {
		var arr = Object.keys(stats);
		for (var i = 0, length = arr.length; i < length; i++) {
			var key = arr[i];
			if (key === 'year' || key === 'month' || key === 'day')
				continue;
			doc[key] = (doc[key] || 0) + (stats[key] || 0);
		}
		return doc;
	}, stats).where('year', stats.year).where('month', stats.month).where('day', stats.day);
};

W.daily = function(callback) {
	W.statistics(function(arr) {

		if (!arr.length)
			return callback(EMPTYARRAY);

		var output = [];
		var value;

		for (var i = 0, length = arr.length; i < length; i++) {
			if (arr[i]) {
				value = arr[i].parseJSON(true);
				value && output.push(value);
			}
		}

		callback(output);
	});
	return W;
};

W.monthly = function(callback) {
	W.statistics(function(arr) {

		if (!arr.length)
			return callback(EMPTYOBJECT);

		var stats = {};

		for (var i = 0, length = arr.length; i < length; i++) {

			if (!arr[i])
				continue;

			var value = arr[i].parseJSON(true);
			if (!value)
				continue;

			var key = value.month + '-' + value.year;

			if (stats[key])
				sum(stats[key], value);
			else
				stats[key] = value;
		}

		callback(stats);
	});
	return W;
};

W.yearly = function(callback) {
	W.statistics(function(arr) {

		if (!arr.length)
			return callback(EMPTYOBJECT);

		var stats = {};

		for (var i = 0, length = arr.length; i < length; i++) {

			if (!arr[i])
				continue;

			var value = arr[i].parseJSON(true);
			if (!value)
				continue;

			var key = value.year.toString();

			if (stats[key])
				sum(stats[key], value);
			else
				stats[key] = value;
		}

		callback(stats);
	});
	return W;
};

W.statistics = function(callback) {
	var filename = F.path.databases(DBNAME + '.nosql');
	var stream = Fs.createReadStream(filename);
	var data = U.createBufferSize();
	stream.on('error', () => callback(EMPTYARRAY));
	stream.on('data', function(chunk) {
		CONCAT[0] = data;
		CONCAT[1] = chunk;
		data = Buffer.concat(CONCAT);
	});
	stream.on('end', () => callback(data.toString('utf8').split('\n')));
	stream.resume();
	return W;
};

function sum(a, b) {
	Object.keys(b).forEach(function(o) {

		if (o === 'day' || o === 'year' || o === 'month')
			return;

		if (o === 'hours') {
			a[o] = undefined;
			return;
		}

		if (o === 'visitors') {
			a[o] = Math.max(a[o] || 0, b[o] || 0);
			return;
		}

		if (a[o] === undefined)
			a[o] = 0;
		if (b[o] !== undefined)
			a[o] += b[o];
	});
}

function getHostname(host) {
	if (!host)
		return null;
	var beg = host.indexOf('/') + 2;
	var end = host.indexOf('/', beg);
	if (end === -1)
		end = host.length;
	return host.substring(beg, end).toLowerCase();
}

exports.version = 'v1.1.0';
exports.instance = W;

exports.install = function() {
	setTimeout(refresh_hostname, 10000);
	F.on('service', delegate_service);
	ROUTE('/$visitors/', function() {
		W.counter(this.req, this.res);
		this.empty();
	});
};

function delegate_service(counter) {
	counter % 120 === 0 && refresh_hostname();
}

function isBlacklist(url) {
	for (var i = 0; i < W.$blacklistlength; i++) {
		if (url.indexOf(W.$blacklist[i]) !== -1)
			return true;
	}
}

function refresh_hostname() {
	var url;
	F.global.config && (url = F.global.config.url);
	!url && (url = F.config.url || F.config.hostname);
	url && (W.hostname = getHostname(url));
}

exports.usage = function() {
	var stats = CLONE(W.stats);
	stats.online = W.arr[0] + W.arr[1];
	return stats;
};

exports.online = function() {
	return W.arr[0] + W.arr[1];
};

exports.today = function() {
	var stats = CLONE(W.stats);
	stats.last = W.lastvisit;
	stats.online = W.arr[0] + W.arr[1];
	stats.pages = stats.hits && stats.count ? (stats.hits / stats.count).floor(2) : 0;
	return stats;
};

exports.blacklist = function(path) {
	return W.blacklist(path);
};

exports.increment = exports.inc = function(type) {
	return W.increment(type);
};

exports.monthly = function(callback) {
	return W.monthly(callback);
};

exports.yearly = function(callback) {
	return W.yearly(callback);
};

exports.daily = function(callback) {
	return W.daily(callback);
};

// every 45 seconds
W.interval = setInterval(W.clean, 45000);
W.load();

ON('settings', function() {
	W.hostname = getHostname(F.global.config.url);
	W.blacklist(F.sitemap('admin', true).url);
});