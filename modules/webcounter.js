// MIT License
// Copyright Peter Širka <petersirka@gmail.com>

const COOKIE = '__webcounter';
const REG_ROBOT = /search|agent|bot|crawler/i;
const REG_HOSTNAME = /(http|https)\:\/\/(www\.)/gi;
const FILE_CACHE = 'webcounter.cache';
const FILE_STATS = 'webcounter.nosql';
const TIMEOUT_VISITORS = 1200; // 20 MINUTES
const Fs = require('fs');

function WebCounter() {
	this.stats = { pages: 0, day: 0, month: 0, year: 0, hits: 0, unique: 0, uniquemonth: 0, count: 0, search: 0, direct: 0, social: 0, unknown: 0, advert: 0, mobile: 0, desktop: 0, visitors: 0, robots: 0 };
	this.online = 0;
	this.arr = [0, 0];
	this.interval = 0;
	this.current = 0;
	this.last = 0;
	this.lastvisit = null;
	this.social = ['plus.url.google', 'plus.google', 'twitter', 'facebook', 'linkedin', 'tumblr', 'flickr', 'instagram', 'vkontakte', 'snapchat', 'skype', 'whatsapp', 'wechat'];
	this.search = ['google', 'bing', 'yahoo', 'duckduckgo', 'yandex'];
	this.ip = [];
	this.url = [];
	this.allowXHR = true;
	this.allowIP = false;
	this.onValid = null;
	this.$blacklist = null;
	this.$blacklistlength = 0;

	this.isAdvert = function(req) {
		return (req.query.utm_medium || req.query.utm_source) ? true : false;
	};

	setTimeout(this.load.bind(this), 2000);

	// every 45 seconds
	this.interval = setInterval(this.clean.bind(this), 45000);
}

WebCounter.prototype = {

	get online() {
		var arr = this.arr;
		return arr[0] + arr[1];
	},

	get today() {
		var self = this;
		var stats = U.copy(self.stats);
		stats.last = self.lastvisit;
		stats.pages = stats.hits && stats.count ? (stats.hits / stats.count).floor(2) : 0;
		return stats;
	}
};

WebCounter.prototype.blacklist = function(path) {
	if (!this.$blacklist)
		this.$blacklist = [];
	this.$blacklist.push(path);
	this.$blacklistlength = this.$blacklist.length;
	return this;
};

WebCounter.prototype.kill = function() {
	this.save();
	clearInterval(this.interval);
	return this;
};

WebCounter.prototype.clean = function() {

	var self = this;

	self.interval++;
	self.interval % 2 === 0 && self.save();

	var now = new Date();
	var stats = self.stats;

	self.current = now.getTime();

	var day = now.getDate();
	var month = now.getMonth() + 1;
	var year = now.getFullYear();
	var length = 0;

	if (stats.day !== day || stats.month !== month || stats.year !== year) {
		if (stats.day || stats.month || stats.year) {
			self.append();
			var visitors = stats.visitors;
			var keys = Object.keys(stats);
			length = keys.length;
			for (var i = 0; i < length; i++)
				stats[keys[i]] = 0;
			stats.visitors = visitors;
		}
		stats.day = day;
		stats.month = month;
		stats.year = year;
		self.save();
	}

	var arr = self.arr;

	var tmp1 = arr[1];
	var tmp0 = arr[0];

	arr[1] = 0;
	arr[0] = tmp1;

	if (tmp0 !== arr[0] || tmp1 !== arr[1]) {
		var online = arr[0] + arr[1];
		if (online != self.last) {
			if (self.allowIP)
				self.ip = self.ip.slice(tmp0);
			self.last = online;
		}
	}

	return self;
};

WebCounter.prototype.increment = WebCounter.prototype.inc = function(type) {

	var self = this;

	if (self.stats[type])
		self.stats[type]++;
	else
		self.stats[type] = 1;

	return self;
};

WebCounter.prototype.$onValid = function(req) {
	var self = this;

	var agent = req.headers['user-agent'];
	if (!agent || req.headers['x-moz'] === 'prefetch' || (self.onValid && !self.onValid(req)) || (self.$blacklist && isBlacklist(req.uri)))
		return false;

	if (REG_ROBOT.test(agent)) {
		self.stats.robots++;
		return false;
	}

	return true;
};

WebCounter.prototype.counter = function(req, res) {

	var self = this;
	if (!self.$onValid(req) || req.method !== 'GET' || (req.xhr && !self.allowXHR) || (!req.headers['accept'] || !req.headers['accept-language']))
		return false;

	var arr = self.arr;
	var user = req.cookie(COOKIE).parseInt();
	var now = new Date();
	var ticks = now.getTime();
	var sum = user ? (ticks - user) / 1000 : 1000;
	var exists = sum < 91;
	var stats = self.stats;
	var referer = req.headers['x-referer'] || req.headers['referer'];
	var ping = req.headers['x-ping'];

	if (user)
		sum = Math.abs(self.current - user) / 1000;

	var isHits = user ? sum >= TIMEOUT_VISITORS : true;

	if (!ping || isHits) {
		stats.hits++;
		self.allowIP && self.refreshURL(referer, req, ping);
	}

	if (exists)
		return true;

	var isUnique = false;

	if (user) {

		// 20 minutes
		if (sum < TIMEOUT_VISITORS) {
			arr[1]++;
			self.lastvisit = now;
			res.cookie(COOKIE, ticks, now.add('5 days'));
			return true;
		}

		var date = new Date(user);
		if (date.getDate() !== now.getDate() || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear())
			isUnique = true;

		if (date.diff('months') < 0)
			stats.uniquemonth++;

	} else {
		isUnique = true;
		stats.uniquemonth++;
	}

	if (isUnique) {
		stats.unique++;
		if (req.mobile)
			stats.mobile++;
		else
			stats.desktop++;
	}

	arr[1]++;
	self.lastvisit = now;
	res.cookie(COOKIE, ticks, now.add('5 days'));
	self.allowIP && self.ip.push({ ip: req.ip, url: ping || req.uri.href, empty: referer ? false : true });

	var online = self.online;

	if (self.last !== online)
		self.last = online;

	stats.count++;
	stats.visitors++;

	if (self.isAdvert(req)) {
		stats.advert++;
		return true;
	}

	referer = getReferrer(referer);

	if (!referer || (webcounter.hostname && referer.indexOf(webcounter.hostname) !== -1)) {
		stats.direct++;
		return true;
	}

	for (var i = 0, length = self.social.length; i < length; i++) {
		if (referer.indexOf(self.social[i]) !== -1) {
			stats.social++;
			return true;
		}
	}

	for (var i = 0, length = self.search.length; i < length; i++) {
		if (referer.indexOf(self.search[i]) !== -1) {
			stats.search++;
			return true;
		}
	}

	stats.unknown++;
	return true;
};

WebCounter.prototype.save = function() {
	var self = this;
	var filename = F.path.databases(FILE_CACHE);
	var stats = U.copy(self.stats);
	stats.pages = stats.hits && stats.count ? (stats.hits / stats.count).floor(2) : 0;
	Fs.writeFile(filename, JSON.stringify(stats), NOOP);
	return self;
};

WebCounter.prototype.load = function() {

	var self = this;
	var filename = F.path.databases(FILE_CACHE);

	Fs.readFile(filename, function(err, data) {

		if (err)
			return;

		try
		{
			self.stats = U.copy(JSON.parse(data.toString('utf8')));
		} catch (ex) {}

	});

	return self;
};

WebCounter.prototype.append = function() {
	var self = this;
	var filename = F.path.databases(FILE_STATS);
	Fs.appendFile(filename, JSON.stringify(self.stats) + '\n', NOOP);
	return self;
};

WebCounter.prototype.daily = function(callback) {
	var self = this;
	self.statistics(function(arr) {

		if (!arr.length)
			return callback(EMPTYARRAY);

		var output = [];
		var value;

		for (var i = 0, length = arr.length; i < length; i++) {
			if (arr[i]) {
				value = arr[i].parseJSON();
				value && output.push(value);
			}
		}

		callback(output);
	});
	return self;
};

WebCounter.prototype.monthly = function(callback) {
	var self = this;
	self.statistics(function(arr) {

		if (!arr.length)
			return callback(EMPTYOBJECT);

		var stats = {};

		for (var i = 0, length = arr.length; i < length; i++) {

			if (!arr[i])
				continue;

			var value = arr[i].parseJSON();
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
	return self;
};

WebCounter.prototype.yearly = function(callback) {
	var self = this;
	self.statistics(function(arr) {

		if (!arr.length)
			return callback(EMPTYOBJECT);

		var stats = {};

		for (var i = 0, length = arr.length; i < length; i++) {

			if (!arr[i])
				continue;

			var value = JSON.parse(arr[i]);
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
	return self;
};

WebCounter.prototype.statistics = function(callback) {
	var self = this;
	var filename = F.path.databases(FILE_STATS);
	var stream = Fs.createReadStream(filename);
	var data = new Buffer(0);
	stream.on('error', () => callback(EMPTYARRAY));
	stream.on('data', (chunk) => data = Buffer.concat([data, chunk]));
	stream.on('end', () => callback(data.toString('utf8').split('\n')));
	stream.resume();
	return self;
};

WebCounter.prototype.refreshURL = function(referer, req, ping) {
	var self = this;
	var empty = false;

	if (!referer)
		empty = true;

	for (var i = 0, length = self.ip.length; i < length; i++) {
		var item = self.ip[i];
		if (item.ip === req.ip && (item.empty === empty || item.url === referer)) {
			item.url = ping || req.uri.href;
			return self;
		}
	}

	self.ip.push({ ip: req.ip, url: ping || req.uri.href, empty: true });
	return self;
};

function sum(a, b) {
	Object.keys(b).forEach(function(o) {
		if (o === 'day' || o === 'year' || o === 'month')
			return;

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

function getReferrer(host) {
	if (!host)
		return null;
	var index = host.indexOf('/') + 2;
	return host.substring(index, host.indexOf('/', index)).toLowerCase();
}

var webcounter = new WebCounter();

exports.name = 'webcounter';
exports.version = 'v4.0.0';
exports.instance = webcounter;

exports.install = function(options) {
	setTimeout(refresh_hostname, 10000);

	if (options) {
		webcounter.allowIP = options.ip === true;
		webcounter.allowXHR = options.xhr === false ? false : true;
	}

	F.on('service', delegate_service);
	F.on('controller', delegate_request);
};

exports.uninstall = function(options) {
	webcounter.kill();
	webcounter = null;
	F.removeListener('service', delegate_service);
	F.removeListener('controller', delegate_request);
};

function delegate_service(counter) {
	counter % 120 === 0 && refresh_hostname();
}

function delegate_request(controller, name) {
	webcounter.counter(controller.req, controller.res);
}

function isBlacklist(req) {
	for (var i = 0; i < webcounter.$blacklistlength; i++) {
		if (req.pathname.indexOf(webcounter.$blacklist[i]) !== -1)
			return true;
	}
}

function refresh_hostname() {
	var url;
	if (F.config.custom)
		url = F.config.custom.url;
	if (!url)
		url = F.config.url || F.config.hostname;
	if (!url)
		return;
	url = url.toString().replace(REG_HOSTNAME, '');
	var index = url.indexOf('/');
	if (index !== -1)
		url = url.substring(0, index);
	webcounter.hostname = url.toLowerCase();
}

exports.usage = function() {
	var stats = U.extend({}, webcounter.stats);
	stats.online = webcounter.online;
	return stats;
};

exports.online = function() {
	return webcounter.online;
};

exports.today = function() {
	return webcounter.today;
};

exports.blacklist = function(path) {
	return webcounter.blacklist(path);
};

exports.increment = exports.inc = function(type) {
	return webcounter.increment(type);
};

exports.monthly = function(callback) {
	return webcounter.monthly(callback);
};

exports.yearly = function(callback) {
	return webcounter.yearly(callback);
};

exports.daily = function(callback) {
	return webcounter.daily(callback);
};