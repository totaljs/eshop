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
	schema.define('datecreated', Date);

	// Gets a specific user
	schema.setGet(function(error, model, options, callback) {

		// options.id {String}

		var filter = function(doc) {
			if (options.id && doc.id !== options.id)
				return;
			return doc;
		};

		DB('users').one(filter, function(err, doc) {
			if (doc)
				return callback(doc);
			error.push('error-404-user');
			callback(doc);
		});
	});

	schema.setSave(function(error, model, options, callback) {

		if (model.datecreated)
			model.datecreated = model.datecreated.format();

		var updater = function(doc) {
			if (doc.id !== model.id)
				return doc;
			return model.$clean();
		};

		// Update user in database
		DB('users').update(updater, function() {

			F.emit('users.save', model);

			// Returns response
			callback(SUCCESS(true));
		});
	});

	// Removes user from DB
	schema.setRemove(function(error, id, callback) {

		// Filter for removing
		var updater = function(doc) {
			if (doc.id !== id)
				return doc;
			return null;
		};

		// Updates database file
		DB('users').update(updater, callback);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		DB('users').clear(NOOP);
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

		// Filter for reading
		var filter = function(doc) {
			// Searchs in "title"
			if (options.search) {
				if (doc.name.toSearch().indexOf(options.search) === -1)
					return;
			}

			return doc;
		};

		// Sorting documents
		var sorting = function(a, b) {
			if (new Date(a.datecreated) > new Date(b.datecreated))
				return -1;
			return 1;
		};

		DB('users').sort(filter, sorting, function(err, docs, count) {
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

		var filter = function(doc) {
			if (doc[id] === options.profile[id] || (doc.email && options.profile.email && doc.email === options.profile.email))
				return doc;
			return;
		};

		DB('users').one(filter, function(err, doc) {

			if (!doc) {

				// new user
				doc = schema.create();
				doc.name = options.profile.name;
				doc.email = options.profile.email;
				doc.gender = options.profile.gender;
				doc.ip = options.profile.ip;
				doc[id] = options.profile[id];
				DB('users').insert(doc.$clean(), F.error());

				// Writes stats
				MODULE('webcounter').increment('users');

			} else {
				if (doc[id] !== options.profile[id]) {
					DB('users').update(function(user) {
						if (user.id === doc.id)
							user[id] = options.profile[id];
						return user;
					});
				}
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
