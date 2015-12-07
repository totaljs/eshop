var online = {};
var COOKIE = '__user';

exports.login = function(req, res, id) {
	res.cookie(COOKIE, F.encrypt({ id: id, ip: req.ip }, CONFIG('secret'), true), '6 days');
};

exports.logoff = function(req, res, user) {
	delete online[user.id];
	res.cookie('__user', '', new Date().add('-1 day'));
};

exports.createSession = function(profile) {
	online[profile.id] = { id: profile.id, name: profile.name, ticks: new Date().add('30 minutes').getTime() };
	return online[profile.id];
};

NEWSCHEMA('User').make(function(schema) {

	schema.define('id', 'String(10)');
	schema.define('idfacebook', 'String(30)');
	schema.define('idgoogle', 'String(30)');
	schema.define('idlinkedin', 'String(30)');
	schema.define('idinstagram', 'String(30)');
	schema.define('idyandex', 'String(30)');
	schema.define('iddropbox', 'String(30)');
	schema.define('idvk', 'String(30)');
	schema.define('idyahoo', 'String(30)');
	schema.define('idlive', 'String(30)');
	schema.define('ip', 'String(80)');
	schema.define('name', 'String(50)', true);
	schema.define('email', 'String(200)');
	schema.define('gender', 'String(20)');
	schema.define('isblocked', Boolean);
	schema.define('datecreated', Date);

	// Gets a specific user
	schema.setGet(function(error, model, options, callback) {
		// options.id {String}
		var builder = new MongoBuilder();
		builder.where('id', options.id);
		builder.where('isremoved', false);
		builder.findOne(DB('users'), function(err, doc) {
			if (doc)
				return callback(doc);
			error.push('error-404-user');
			callback(doc);
		});
	});

	schema.setSave(function(error, model, options, callback) {

		model.dateupdated = new Date();

		var builder = new MongoBuilder();
		builder.where('id', model.id);
		builder.set('isremoved', false);
		builder.set(model);

		builder.updateOne(DB('users'), function() {
			// Returns response
			callback(SUCCESS(true));
		});
	});

	// Removes user from DB
	schema.setRemove(function(error, id, callback) {
		var builder = new MongoBuilder();
		builder.where('id', id);
		builder.where('isremoved', false);
		builder.set('isremoved', true);
		builder.removeOne(DB('users'), callback);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var builder = new MongoBuilder();
		builder.remove(DB('users'), F.error());
		callback(SUCCESS(true));
	});

	// Sets default values
	schema.setDefault(function(name) {
		switch (name) {
			case 'id':
				return U.GUID(10);
			case 'datecreated':
				return new Date();
		}
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {

		// options.search {String}
		// options.page {String or Number}
		// options.max {String or Number}

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);

		// Prepares searching
		if (options.search)
			options.search = options.search.toSearch();

		var builder = new MongoBuilder();

		builder.where('isremoved', false);

		if (options.search)
			builder.like('search', options.search);

		builder.sort('_id', true);
		builder.findCount(DB('users'), function(err, docs, count) {
			var data = {};

			data.count = count;
			data.items = docs;
			data.pages = Math.floor(count / options.max) + (count % options.max ? 1 : 0);

			if (data.pages === 0)
				data.pages = 1;

			data.page = options.page + 1;

			// Returns data
			callback(data);
		}, skip, take);
	});

	schema.addWorkflow('login', function(error, model, options, callback) {

		// options.controller
		// options.profile
		// options.type

		var id = 'id' + options.type;
		var builder = new MongoBuilder();

		builder.where('isremoved', false);

		var or = builder.or();
		or.where(id, options.profile[id]);
		or.where('email', options.profile.email);
		or.end();

		builder.findOne(DB('users'), function(err, doc) {

			if (!doc) {

				// new user
				doc = schema.create();
				doc.name = options.profile.name;
				doc.email = options.profile.email;
				doc.gender = options.profile.gender;
				doc.ip = options.profile.ip;
				doc.isremoved = false;
				doc[id] = options.profile[id];

				builder = new MongoBuilder();
				builder.set(doc);
				builder.insert(DB('users'), F.error());

				// Writes stats
				MODULE('webcounter').increment('users');

			} else {
				if (doc[id] !== options.profile[id]) {
					var builder = new MongoBuilder();
					builder.where('id', doc.id);
					builder.set(id, options.profile[id]);
					builder.updateOne(DB('users'), F.error());
				}
			}

			if (doc.isblocked) {
				error.push('error-user-blocked');
				return callback();
			}

			exports.login(options.controller.req, options.controller.res, doc.id);
			options.controller.req.user = exports.createSession(doc);

			callback(doc);
		});
	});
});

// Rewrites framework authorization
F.onAuthorization = function(req, res, flags, callback) {

	var hash = req.cookie(COOKIE);

	if (!hash || hash.length < 20) {
		callback(false);
		return;
	}

	var fn_clean_cookie = function() {
		res.cookie(COOKIE, '', new Date().add('-1 day'));
		callback(false);
	};

	var user = F.decrypt(hash, CONFIG('secret'), true);

	if (!user)
		return fn_clean_cookie();

	if (user.ip !== req.ip) {
		fn_clean_cookie();
		return;
	}

	var session = online[user.id];
	if (session) {
		req.user = session;
		session.ticks = new Date().add('30 minutes').getTime();
		callback(true);
		return;
	}

	GETSCHEMA('User').get(user, function(err, response) {

		if (err || !response) {
			callback(false);
			return;
		}

		if (response.isblocked) {
			callback(false);
			return;
		}

		req.user = exports.createSession(response);
		res.cookie(COOKIE, F.encrypt({ id: response.id, ip: req.ip }, CONFIG('secret'), true), '6 days');
		callback(true);
	});

};

// Cleans online users
F.on('service', function(counter) {

	if (counter % 10 !== 0)
		return;

	var users = Object.keys(online);
	var ticks = new Date().getTime();

	for (var i = 0, length = users.length; i < length; i++) {
		var user = online[users[i]];
		if (user.ticks >= ticks)
			continue;
		delete online[users[i]];
	}
});

exports.usage = function() {
	return { online: online };
};
