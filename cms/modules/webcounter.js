/**
 * @module WebCounter
 * @author Peter Širka
 */

var COOKIE = '__webcounter';
var REG_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows.?Phone/i;
var REG_ROBOT = /bot|crawler/i;
var FILE_CACHE = 'webcounter.cache';
var FILE_STATS = 'webcounter.nosql';

var fs = require('fs');
var events = require('events');

function WebCounter() {
    this.stats = { pages: 0, day: 0, month: 0, year: 0, hits: 0, unique: 0, count: 0, search: 0, direct: 0, social: 0, unknown: 0, advert: 0, mobile: 0, desktop: 0, visitors: 0 };
    this.online = 0;
    this.arr = [0, 0];
    this.interval = 0;
    this.intervalClean = null;
    this.current = 0;
    this.last = 0;
    this.lastvisit = null;
    this.social = ['plus.url.google', 'plus.google', 'twitter', 'facebook', 'linkedin', 'tumblr', 'flickr', 'instagram'];
    this.search = ['google', 'bing', 'yahoo', 'duckduckgo'];
    this.ip = [];
    this.url = [];
    this.allowXHR = true;
    this.allowIP = false;
    this.onValid = null;

    this._onValid = function(req) {
        var self = this;
        var agent = req.headers['user-agent'] || '';
        if (agent.length === 0)
            return false;
        if (req.headers['x-moz'] === 'prefetch')
            return false;
        if (self.onValid !== null && !self.onValid(req))
            return false;
        return agent.match(REG_ROBOT) === null;
    };

    this.isAdvert = function(req) {
        return (req.query['utm_medium'] || '').length > 0 || (req.query['utm_source'] || '').length > 0;
    };

    this.load();

    // every 30 seconds
    this.intervalClean = setInterval(this.clean.bind(this), 1000 * 30);
}

WebCounter.prototype = {

    get online() {
        var arr = this.arr;
        return arr[0] + arr[1];
    },

    get today() {
        var self = this;
        var stats = utils.copy(self.stats);
        stats.last = self.lastvisit;
        stats.pages = stats.hits > 0 && stats.count > 0 ? (stats.hits / stats.count).floor(2) : 0;
        return stats;
    }
};

WebCounter.prototype.__proto__ = new events.EventEmitter();

/**
 * Clean up
 * @return {Module]
 */
WebCounter.prototype.clean = function() {

    var self = this;

    self.interval++;

    if (self.interval % 2 === 0)
        self.save();

    var now = new Date();
    var stats = self.stats;

    self.current = now.getTime();

    var day = now.getDate();
    var month = now.getMonth() + 1;
    var year = now.getFullYear();
    var length = 0;

    if (stats.day !== day || stats.month !== month || stats.year !== year) {
        if (stats.day !== 0 || stats.month !== 0 || stats.year !== 0) {
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

            self.emit('change', online, self.ip);
            self.last = online;
        }
    }

    return self;
};

/**
 * Custom counter
 * @return {Module]
 */
WebCounter.prototype.increment = function(type) {

    var self = this;

    if (typeof(self.stats[type]) === 'undefined')
        self.stats[type] = 1;
    else
        self.stats[type]++;

    return self;
};

/**
 * Request counter
 * @return {Module]
 */
WebCounter.prototype.counter = function(req, res) {

    var self = this;

    if (!self._onValid(req))
        return false;

    if (req.xhr && !self.allowXHR)
        return false;

    if (req.method !== 'GET')
        return false;

    if ((req.headers['accept'] || '').length === 0 || (req.headers['accept-language'] || '').length === 0)
        return false;

    var arr = self.arr;
    var user = req.cookie(COOKIE).parseInt();
    var now = new Date();
    var ticks = now.getTime();
    var sum = user === 0 ? 1000 : (ticks - user) / 1000;
    var exists = sum < 31;
    var stats = self.stats;
    var referer = req.headers['x-referer'] || req.headers['referer'] || '';

    stats.hits++;

    self.refreshURL(referer, req);

    if (exists)
        return true;

    var isUnique = false;

    if (user > 0) {

        sum = Math.abs(self.current - user) / 1000;
        if (sum < 41)
            return true;

        var date = new Date(user);
        if (date.getDate() !== now.getDate() || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear())
            isUnique = true;

    } else
        isUnique = true;

    if (isUnique) {
        stats.unique++;
        var agent = req.headers['user-agent'] || '';
        if (agent.match(REG_MOBILE) === null)
            stats.desktop++;
        else
            stats.mobile++;
        stats.visitors++;
    }

    arr[1]++;
    self.lastvisit = new Date();
    res.cookie(COOKIE, ticks, now.add('d', 5));

    if (self.allowIP)
        self.ip.push({ ip: req.ip, url: req.uri.href });

    var online = self.online;

    self.emit('online', req);

    if (self.last !== online) {
        self.last = online;
        self.emit('change', online, self.ip);
    }

    stats.count++;

    if (self.isAdvert(req)) {
        stats.advert++;
        return true;
    }

    referer = getReferer(referer);

    if (referer === null) {
        stats.direct++;
        return true;
    }

    var length = self.social.length;

    for (var i = 0; i < length; i++) {
        if (referer.indexOf(self.social[i]) !== -1) {
            stats.social++;
            return true;
        }
    }

    var length = self.search.length;

    for (var i = 0; i < length; i++) {
        if (referer.indexOf(self.search[i]) !== -1) {
            stats.search++;
            return true;
        }
    }

    stats.unknown++;
    return true;
};

/**
 * Saves the current stats into the cache
 * @return {Module]
 */
WebCounter.prototype.save = function() {
    var self = this;
    var filename = framework.path.databases(FILE_CACHE);
    var stats = Utils.copy(self.stats);
    stats.pages = stats.hits > 0 && stats.count > 0 ? (stats.hits / stats.count).floor(2) : 0;
    fs.writeFile(filename, JSON.stringify(stats), utils.noop);
    return self;

};

/**
 * Loads stats from the cache
 * @return {Module]
 */
WebCounter.prototype.load = function() {

    var self = this;
    var filename = framework.path.databases(FILE_CACHE);

    fs.readFile(filename, function(err, data) {

        if (err)
            return;

        try
        {
            self.stats = utils.copy(JSON.parse(data.toString('utf8')));
        } catch (ex) {}

    });

    return self;
};

/**
 * Creates a report from previous day
 * @return {Module]
 */
WebCounter.prototype.append = function() {
    var self = this;
    var filename = framework.path.databases(FILE_STATS);
    fs.appendFile(filename, JSON.stringify(self.stats) + '\n', utils.noop);
    return self;
};

/**
 * Dail stats
 * @param {Function(stats)} callback
 * @return {Module]
 */
WebCounter.prototype.daily = function(callback) {
    var self = this;
    self.statistics(function(arr) {

        var length = arr.length;
        var output = [];

        for (var i = 0; i < length; i++) {

            var value = arr[i] || '';

            if (value.length === 0)
                continue;

            try
            {
                output.push(JSON.parse(value));
            } catch (ex) {}
        }

        callback(output);
    });

    return self;
};

/**
 * Monthly stats
 * @param {Function(stats)} callback
 * @return {Module]
 */
WebCounter.prototype.monthly = function(callback) {

    var self = this;
    self.statistics(function(arr) {

        var length = arr.length;
        var stats = {};

        for (var i = 0; i < length; i++) {

            var value = arr[i] || '';

            if (value.length === 0)
                continue;

            try
            {
                var current = JSON.parse(value);
                var key = current.month + '-' + current.year;

                if (!stats[key])
                    stats[key] = current;
                else
                    sum(stats[key], current);

            } catch (ex) {}
        }

        callback(stats);
    });

    return self;
};

/**
 * Yearly stats
 * @param {Function(stats)} callback
 * @return {Module]
 */
WebCounter.prototype.yearly = function(callback) {

    var self = this;
    self.statistics(function(arr) {

        var stats = {};
        var length = arr.length;

        for (var i = 0; i < length; i++) {

            var value = arr[i] || '';

            if (value.length === 0)
                continue;

            try
            {
                var current = JSON.parse(value);
                var key = current.year.toString();

                if (!stats[key])
                    stats[key] = current;
                else
                    sum(stats[key], current);

            } catch (ex) {}
        }

        callback(stats);
    });

    return self;
};

/**
 * Read stats from the file
 * @param {Function(stats)} callback
 * @return {Module]
 */
WebCounter.prototype.statistics = function(callback) {

    var self = this;
    var filename = framework.path.databases(FILE_STATS);
    var stream = fs.createReadStream(filename);
    var data = '';
    var stats = {};

    stream.on('error', function() {
        callback([]);
    });

    stream.on('data', function(chunk) {
        data += chunk.toString();
    });

    stream.on('end', function() {
        callback(data.split('\n'));
    });

    stream.resume();

    return self;
};

/**
 * Refresh visitors URL
 * @internal
 * @param {String} referer
 * @param {Request} req
 */
WebCounter.prototype.refreshURL = function(referer, req) {

    if (referer.length === 0)
        return;

    var self = this;

    if (!self.allowIP)
        return;

    var length = self.ip.length;

    for (var i = 0; i < length; i++) {
        var item = self.ip[i];
        if (item.ip === req.ip && item.url === referer) {
            item.url = req.uri.href;
            return;
        }
    }
};

function sum(a, b) {
    Object.keys(b).forEach(function(o) {
        if (o === 'day' || o === 'year' || o === 'month')
            return;
        if (typeof(a[o]) === 'undefined')
            a[o] = 0;
        if (typeof(b[o]) !== 'undefined')
            a[o] += b[o];

    });
}

function getReferer(host) {
    if (host.length === 0)
        return null;
    var index = host.indexOf('/') + 2;
    host = host.substring(index, host.indexOf('/', index));
    return host;
}

// Instance
var webcounter = new WebCounter();

var delegate_request = function(controller, name) {
    webcounter.counter(controller.req, controller.res);
};

module.exports.name = 'webcounter';
module.exports.version = 'v1.01';
module.exports.instance = webcounter;

framework.on('controller', delegate_request);

module.exports.usage = function() {
    var stats = utils.extend({}, webcounter.stats);
    stats.online = webcounter.online;
    return stats;
};

module.exports.online = function() {
    return webcounter.online;
};

module.exports.today = function() {
    return webcounter.today;
};

module.exports.increment = function(type) {
    webcounter.increment(type);
    return this;
};

module.exports.monthly = function(callback) {
    return webcounter.monthly(callback);
};

module.exports.yearly = function(callback) {
    return webcounter.yearly(callback);
};

module.exports.daily = function(callback) {
    return webcounter.daily(callback);
};