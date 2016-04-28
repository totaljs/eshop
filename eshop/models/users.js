const COOKIE = '__user';
const SECRET = 'total2016eshop';

var online = {};

exports.login = function(req, res, id) {
	res.cookie(COOKIE, F.encrypt({ id: id, ip: req.ip }, SECRET, true), '6 days');
};

exports.logoff = function(req, res, user) {
	delete online[user.id];
	res.cookie('__user', '', new Date().add('-1 day'));
};

exports.createSession = function(profile) {
	online[profile.id] = { id: profile.id, name: profile.name, firstname: profile.firstname, lastname: profile.lastname, email: profile.email, ticks: new Date().add('30 minutes').getTime() };
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
	schema.define('name', 'Camelize(50)', true);
	schema.define('firstname', 'Camelize(50)');
	schema.define('lastname', 'Camelize(50)');
	schema.define('email', 'Email');
	schema.define('gender', 'String(20)');
	schema.define('datecreated', Date);
	schema.define('isblocked', Boolean);

	// Gets a specific user
	schema.setGet(function(error, model, options, callback) {

		// options.id {String}
		// options.password {String} (SHA1)
		// options.email {String}

		var filter = function(doc) {
			if (options.id && doc.id !== options.id)
				return;
			if (options.email && doc.email !== options.email)
				return;
			if (options.password && doc.password !== options.password)
				return;
			return doc;
		};

		var filter = DB('users').one();

		if (options.id)
			filter.where('id', options.id);
		if (options.email)
			filter.where('email', options.email);
		if (options.password)
			filter.where('password', options.password);

		filter.callback(callback, 'error-404-user');
	});

	schema.setSave(function(error, model, options, callback) {
		// Update the user in database
		DB('users').update(model).where('id', model.id).callback(function(count) {

			// Returns response
			callback(SUCCESS(true));

			if (count)
				F.emit('users.save', model);
		});
	});

	// Removes user from DB
	schema.setRemove(function(error, id, callback) {
		// Updates database file
		DB('users').remove().where('id', id).callback(callback);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		DB('users').remove();
		callback(SUCCESS(true));
	});

	// Sets default values
	schema.setDefault(function(name) {
		switch (name) {
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

		var filter = DB('users').find();

		// Prepares searching
		if (options.search)
			filter.like('search', options.search.keywords(true, true));

		filter.take(take);
		filter.skip(skip);
		filter.sort('datecreated');
		filter.callback(function(err, docs, count) {
			var data = {};

			data.count = count;
			data.items = docs;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max);

			if (data.pages === 0)
				data.pages = 1;

			data.page = options.page + 1;

			// Returns data
			callback(data);
		});
	});

	schema.addWorkflow('login', function(error, model, options, callback) {

		// options.controller
		// options.profile
		// options.type

		var id = 'id' + options.type;

		DB('users').one().make(function(builder) {
			builder.or();
			builder.where(id, options.profile[id]);
			builder.where('email', options.profile.email);
			builder.end();
		}).callback(function(err, doc) {

			if (!doc) {

				// new user
				doc = schema.create();
				doc.id = UID();
				doc.name = options.profile.name;
				doc.firstname = options.profile.firstname;
				doc.lastname = options.profile.lastname;
				doc.email = options.profile.email;
				doc.gender = options.profile.gender;
				doc.ip = options.profile.ip;
				doc.search = (options.profile.name + ' ' + (options.profile.email || '')).keywords(true, true).join(' ');
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

NEWSCHEMA('UserSettings').make(function(schema) {
	schema.define('id', 'String(20)');
	schema.define('firstname', 'String(50)', true);
	schema.define('lastname', 'String(50)', true);
	schema.define('email', 'String(200)', true);
	schema.define('password', 'String(20)', true);

	schema.setSave(function(error, model, options, callback) {

		if (model.password.startsWith('*****'))
			delete model.password;
		else
			model.password = model.password.hash('sha1');

		model.name = model.firstname + ' ' + model.lastname;
		model.search = (model.name + ' ' + (model.email || '')).keywords(true, true).join(' ');

		var user = options.controller.user;
		user.name = model.name;
		user.email = model.email;
		user.firstname = model.firstname;
		user.lastname = model.lastname;

		// Update an user in database
		DB('users').modify(model).where('id', model.id).callback(SUCCESS(callback));
	});
});

NEWSCHEMA('UserLogin').make(function(schema) {

	schema.define('email', 'String(200)', true);
	schema.define('password', 'String(30)', true);

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
	schema.define('email', 'String(200)', true);
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

			response.hash = F.encrypt({ id: response.id, expire: new Date().add('2 days').getTime() });
			F.mail(model.email, '@(Password recovery)', '=?/mails/password', response, options.controller.language || '');
			callback(SUCCESS(true));
		});
	});
});

NEWSCHEMA('UserRegistration').make(function(schema) {
	schema.define('firstname', 'String(50)', true);
	schema.define('lastname', 'String(50)', true);
	schema.define('gender', 'String(20)');
	schema.define('email', 'String(200)', true);
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
			user.id = UID();
			user.email = model.email;
			user.firstname = model.firstname;
			user.lastname = model.lastname;
			user.name = model.firstname + ' ' + model.lastname;
			user.gender = model.gender;
			user.password = model.password.hash('sha1');
			user.ip = options.ip;
			user.search = (user.name + ' ' + (user.email || '')).keywords(true, true).join(' ');

			var mail = F.mail(model.email, '@(Registration)', '=?/mails/registration', user, options.controller.language || '');

			if (F.config.custom.emailuserform)
				mail.bcc(F.config.custom.emailuserform);

			DB('users').insert(user, F.error());

			// Login user
			exports.login(options.controller.req, options.controller.res, user.id);

			// Reponse
			callback(SUCCESS(true));
		});
	});
});

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

function removeCookie(res, callback) {
	res.cookie(COOKIE, '', new Date().add('-1 day'));
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

	if (!user)
		return removeCookie(res, callback);

	if (user.ip !== req.ip) {
		removeCookie(res, callback);
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
			removeCookie(res, callback);
			callback(false);
			return;
		}

		req.user = exports.createSession(response);
		res.cookie(COOKIE, F.encrypt({ id: response.id, ip: req.ip }, SECRET, true), '6 days');
		callback(true);
	});
};