const COOKIE = '__user';
const SECRET = 'total2016eshop';

var online = {};

exports.login = function(req, res, id) {
	res.cookie(COOKIE, F.encrypt({ id: id, ip: req.ip }, SECRET, true), '6 days');
};

exports.logoff = function(req, res, user) {
	delete online[user.id];
	res.cookie(COOKIE, '', F.datetime.add('-1 day'));
};

exports.createSession = function(profile) {
	online[profile.id] = { id: profile.id, name: profile.name, firstname: profile.firstname, lastname: profile.lastname, email: profile.email, ticks: F.datetime.add('30 minutes').getTime() };
	return online[profile.id];
};

NEWSCHEMA('User').make(function(schema) {

	schema.define('id', 'String(20)');
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
	schema.define('search', 'String(80)');
	schema.define('firstname', 'Capitalize(50)');
	schema.define('lastname', 'Capitalize(50)');
	schema.define('name', 'Capitalize(50)', true);
	schema.define('email', 'Email');
	schema.define('gender', 'Lower(20)');
	schema.define('isblocked', Boolean);

	// Gets a specific user
	schema.setGet(function(error, model, options, callback) {

		if(!(options.email || options.password || options.id)) {
		    error.push('error-404-user');
		    return callback();
		}

		var nosql = DB(error);

		nosql.select('item', 'users').make(function(builder) {
			builder.where('isremoved', false);
			options.email && builder.where('email', options.email);
			options.password && builder.where('password', options.password);
			options.id && builder.where('id', options.id);
			builder.first();
		});

		nosql.validate('item', 'error-404-user');
		nosql.exec(callback, 'item');
	});

	schema.setSave(function(error, model, options, callback) {

		var nosql = DB(error);
		var newbie = model.id ? false : true;

		if (newbie) {
			model.id = UID();
			model.datecreated = F.datetime;
		} else
			model.dateupdated = F.datetime;

		model.search = (model.name + ' ' + (model.email || '')).keywords(true, true);
		model.isremoved = false;

		nosql.save('item', 'users', newbie, function(builder, newbie) {
			builder.set(model);
			if (newbie)
				return;
			builder.rem('id');
			builder.rem('datecreated');
			builder.where('id', model.id);
		});

		nosql.exec(function(err) {

			callback(SUCCESS(true, model.id));

			if (err)
				return;

			F.emit('users.save', model);
		});
	});

	// Removes user from DB
	schema.setRemove(function(error, id, callback) {

		var nosql = DB(error);

		nosql.update('item', 'users').make(function(builder) {
			builder.where('id', id);
			builder.set('isremoved', true);
		});

		sql.exec(SUCCESS(callback), -1);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var nosql = DB(error);
		nosql.remove('users');
		nosql.exec(SUCCESS(callback), -1);
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

		var nosql = DB(error);

		nosql.listing('users', 'users').make(function(builder) {
			builder.where('isremoved', false);
			options.search && builder.in('search', options.search.keywords(true, true));
			builder.sort('datecreated', true);
			builder.skip(skip);
			builder.take(take);
		});

		nosql.exec(function(err, response) {

			if (err)
				return callback();

			var data = {};
			data.count = response.users.count;
			data.items = response.users.items;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max) || 1;
			data.page = options.page + 1;

			callback(data);
		});
	});

	schema.addWorkflow('login', function(error, model, options, callback) {

		// options.controller
		// options.profile
		// options.type

		var id = 'id' + options.type;
		var nosql = DB(error);

		nosql.select('user', 'users').make(function(builder) {
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

		nosql.prepare(function(error, response, resume) {

			if (response.user) {
				response.user[id] !== options.profile[id] && nosql.update('users').make(function(builder) {
					builder.set(id, options.profile[id]);
					builder.where('id', response.user.id);
				});
			} else {
				response.user = schema.create();
				response.user.id = UID();
				response.user.name = options.profile.name;
				response.user.email = options.profile.email;
				response.user.gender = options.profile.gender;
				response.user.firstname = options.profile.firstname;
				response.user.lastname = options.profile.lastname;
				response.user.ip = options.profile.ip;
				response.user.search = (options.profile.name + ' ' + (options.profile.email || '')).keywords(true, true);
				response.user.datecreated = F.datetime;
				response.user[id] = options.profile[id];

				// Inserts new user
				nosql.insert('users').set(response.user);

				// Writes stats
				MODULE('webcounter').increment('users');
			}

			resume();
		});

		nosql.exec(function(err, response) {

			if (response.user) {
				exports.login(options.controller.req, options.controller.res, response.user.id);
				options.controller.req.user = exports.createSession(response.user);
			}

			callback(response.user);
		});
	});
});

NEWSCHEMA('UserSettings').make(function(schema) {
	schema.define('id', 'String(20)');
	schema.define('firstname', 'Capitalize(50)', true);
	schema.define('lastname', 'Capitalize(50)', true);
	schema.define('email', 'Email', true);
	schema.define('password', 'String(20)', true);

	schema.setSave(function(error, model, options, callback) {

		if (model.password.startsWith('*****'))
			delete model.password;
		else
			model.password = model.password.hash('sha1');

		model.name = model.firstname + ' ' + model.lastname;
		model.search = (model.name + ' ' + (model.email || '')).keywords(true, true);

		var user = options.controller.user;
		user.name = model.name;
		user.email = model.email;
		user.firstname = model.firstname;
		user.lastname = model.lastname;

		var nosql = DB(error);

		nosql.update('users').make(function(builder) {
			builder.set(model);
			builder.rem('id');
			builder.where('id', model.id);
			builder.first();
		});

		nosql.exec(SUCCESS(callback), -1);
	});
});

NEWSCHEMA('UserLogin').make(function(schema) {

	schema.define('email', 'Email', true);
	schema.define('password', 'String(20)', true);

	schema.setPrepare(function(name, value) {
		if (name === 'email')
			return value.toLowerCase();
		if (name === 'password')
			return value.hash('sha1');
		return value;
	});

	schema.addWorkflow('exec', function(error, model, options, callback) {

		// options.controller

		GETSCHEMA('User').get(model, function(err, response) {

			if (err) {
				error.push(err);
				return callback();
			}

			if (response.isblocked) {
				error.push('error-user-blocked');
				return callback();
			}

			exports.login(options.controller.req, options.controller.res, response.id);
			callback(SUCCESS(true));
		});
	});
});

NEWSCHEMA('UserPassword').make(function(schema) {
	schema.define('email', 'Email', true);
	schema.addWorkflow('exec', function(error, model, options, callback) {

		// options.controller

		GETSCHEMA('User').get(model, function(err, response) {

			if (err) {
				error.push(err);
				return callback();
			}

			if (response.isblocked) {
				error.push('error-user-blocked');
				return callback();
			}

			response.hash = F.encrypt({ id: response.id, expire: F.datetime.add('2 days').getTime() });
			F.mail(model.email, '@(Password recovery)', '=?/mails/password', response, options.controller.language || '');
			callback(SUCCESS(true));
		});
	});
});

NEWSCHEMA('UserRegistration').make(function(schema) {
	schema.define('firstname', 'Capitalize(50)', true);
	schema.define('lastname', 'Capitalize(50)', true);
	schema.define('gender', 'Lower(20)');
	schema.define('email', 'Email', true);
	schema.define('password', 'String(20)', true);

	schema.addWorkflow('exec', function(error, model, options, callback) {

		// options.controller
		// options.ip

		var filter = {};
		filter.email = model.email;

		GETSCHEMA('User').get(filter, function(err, response) {

			if (!err) {
				error.push('error-user-exists');
				return callback();
			}

			var user = GETSCHEMA('User').create();

			user.email = model.email;
			user.firstname = model.firstname;
			user.lastname = model.lastname;
			user.name = model.firstname + ' ' + model.lastname;
			user.gender = model.gender;
			user.password = model.password.hash('sha1');
			user.ip = options.ip;
			user.datecreated = F.datetime;

			var mail = F.mail(model.email, '@(Registration)', '=?/mails/registration', user, options.controller.language || '');
			F.config.custom.emailuserform && mail.bcc(F.config.custom.emailuserform);

			user.$save(function(err, response) {
				if (err)
					return callback();

				// Login user
				exports.login(options.controller.req, options.controller.res, response.value);

				// Response
				callback(SUCCESS(true));
			});

		});
	});
});

// Cleans online users
F.on('service', function(counter) {

	if (counter % 10 !== 0)
		return;

	var users = Object.keys(online);
	var ticks = F.datetime.getTime();

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

function removeCookie(res, callback) {
	res.cookie(COOKIE, '', F.datetime.add('-1 day'));
	callback(false);
}

// Rewrites framework authorization
F.onAuthorize = function(req, res, flags, callback) {

	var hash = req.cookie(COOKIE);
	if (!hash || hash.length < 20) {
		callback(false);
		return;
	}

	var user = F.decrypt(hash, SECRET, true);
	if (!user || user.ip !== req.ip)
		return removeCookie(res, callback);

	var session = online[user.id];
	if (session) {
		req.user = session;
		session.ticks = F.datetime.add('30 minutes').getTime();
		callback(true);
		return;
	}

	GETSCHEMA('User').get(user, function(err, response) {

		if (err || !response) {
			removeCookie(res, callback);
			callback(false);
			return;
		}

		var nosql = DB();

		nosql.update('users').make(function(builder) {
			builder.inc('countlogin');
			builder.set('datelogged', F.datetime);
			builder.where('id', response.id);
		});

		nosql.exec(F.error());
		req.user = exports.createSession(response);
		res.cookie(COOKIE, F.encrypt({ id: response.id, ip: req.ip }, SECRET, true), '6 days');
		callback(true);
	});
};
