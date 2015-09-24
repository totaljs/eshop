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

var User = NEWSCHEMA('User');
User.define('id', 'String(10)');
User.define('idfacebook', 'String(30)');
User.define('idgoogle', 'String(30)');
User.define('idlinkedin', 'String(30)');
User.define('idinstagram', 'String(30)');
User.define('idyandex', 'String(30)');
User.define('iddropbox', 'String(30)');
User.define('idvk', 'String(30)');
User.define('idyahoo', 'String(30)');
User.define('idlive', 'String(30)');
User.define('ip', 'String(80)');
User.define('search', 'String(80)');
User.define('name', 'String(50)', true);
User.define('email', 'String(200)');
User.define('gender', 'String(20)');
User.define('datecreated', Date);

// Gets a specific user
User.setGet(function(error, model, options, callback) {

	// options.id {String}

	var sql = DB(error);

	sql.select('item', 'tbl_user').make(function(builder) {
		builder.where('isremoved', false);
		builder.where('id', options.id);
		builder.first();
	});

	sql.validate('item', 'error-404-user');
	sql.exec(callback, 'item');
});

User.setSave(function(error, model, options, callback) {

	var sql = DB(error);
	var isNew = model.id ? false : true;

	if (!model.id)
		model.id = U.GUID(10);

	model.search = (model.name + ' ' + (model.email || '')).toSearch().max(80);

	sql.save('item', 'tbl_user', isNew, function(builder, isNew) {
		builder.set(model);
		if (isNew)
			return;
		builder.rem('id');
		builder.rem('datecreated');
		builder.where('id', model.id);
	});

	sql.exec(function() {
		// Returns response
		callback(SUCCESS(true));
	});
});

// Removes user from DB
User.setRemove(function(error, id, callback) {

	var sql = DB(error);

	sql.update('item', 'tbl_user').make(function(builder) {
		builder.where('id', id);
		builder.set('isremoved', true);
	});

	sql.exec(function() {
		callback(SUCCESS(true));
	});
});

// Clears DB
User.addWorkflow('clear', function(error, model, options, callback) {
	var sql = DB(error);
	sql.remove('tbl_page');
	sql.exec(function() {
		callback(SUCCESS(true));
	});
});

// Sets default values
User.setDefault(function(name) {
	switch (name) {
		case 'id':
			return U.GUID(10);
		case 'datecreated':
			return new Date();
	}
});

// Gets listing
User.setQuery(function(error, options, callback) {

	// options.search {String}
	// options.page {String or Number}
	// options.max {String or Number}

	options.page = U.parseInt(options.page) - 1;
	options.max = U.parseInt(options.max, 20);

	if (options.page < 0)
		options.page = 0;

	var take = U.parseInt(options.max);
	var skip = U.parseInt(options.page * options.max);

	var sql = DB(error);
	var filter = sql.$; // Creates new SQLBuilder

	filter.where('isremoved', false);

	if (options.search)
		filter.like('search', options.search.toSearch(), '*');

	sql.select('items', 'tbl_user').make(function(builder) {
		builder.replace(filter);
		builder.sort('datecreated', true);
		builder.skip(skip);
		builder.take(take);
	});

	sql.count('count', 'tbl_user', 'id').make(function(builder) {
		builder.replace(filter);
	});

	sql.exec(function(err, response) {

		if (err)
			return callback();

		var data = {};
		data.count = response.count;
		data.items = response.items;
		data.pages = Math.ceil(response.count / options.max);

		if (data.pages === 0)
			data.pages = 1;

		data.page = options.page + 1;
		callback(data);
	});
});

User.addWorkflow('login', function(error, model, options, callback) {

	// options.controller
	// options.profile
	// options.type

	var id = 'id' + options.type;
	var sql = DB(error);

	sql.select('user', 'tbl_user').make(function(builder) {
		builder.where('isremoved', false);
		builder.scope(function() {
			builder.where(id, options.profile[id]);
			if (!options.profile.email)
				return;
			builder.or();
			builder.where('email', options.profile.email);
		});
		builder.first();
	});

	sql.prepare(function(error, response, resume) {

		if (response.user) {
			if (response.user[id] !== options.profile[id]) {
				sql.update('tbl_user').make(function(builder) {
					builder.set(id, options.profile[id]);
					builder.where('id', response.user.id);
				});
			}
		} else {
			response.user = User.create();
			response.user.name = options.profile.name;
			response.user.email = options.profile.email;
			response.user.gender = options.profile.gender;
			response.user.ip = options.profile.ip;
			response.user.search = (options.profile.name + ' ' + (options.profile.email || '')).toSearch().max(80);
			response.user[id] = options.profile[id];

			// Inserts new user
			sql.insert('tbl_user').set(response.user);

			// Writes stats
			MODULE('webcounter').increment('users');
		}

		resume();
	});

	sql.exec(function(err, response) {

		if (response.user) {
			exports.login(options.controller.req, options.controller.res, response.user.id);
			options.controller.req.user = exports.createSession(response.user);
		}

		callback(response.user);
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

	User.get(user, function(err, response) {

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
