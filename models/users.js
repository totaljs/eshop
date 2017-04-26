const COOKIE = '__user';
const SECRET = 'total2016eshop';
const online = {};

exports.login = function(req, res, id) {
	res.cookie(COOKIE, F.encrypt({ id: id, ip: req.ip }, SECRET, true), '6 days');
};

exports.logoff = function(req, res, user) {
	delete online[user.id];
	res.cookie(COOKIE, '', F.datetime.add('-1 day'));
};

exports.createSession = function(profile) {
	online[profile.id] = { id: profile.id, name: profile.name, firstname: profile.firstname, lastname: profile.lastname, email: profile.email, ticks: F.datetime.add('30 minutes').getTime(), phone: profile.phone };
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
	schema.define('name', 'Capitalize(50)', true);
	schema.define('firstname', 'Capitalize(50)');
	schema.define('lastname', 'Capitalize(50)');
	schema.define('name', 'Capitalize(50)', true);
	schema.define('phone', 'Phone');
	schema.define('email', 'Email');
	schema.define('gender', 'Lower(20)');
	schema.define('isblocked', Boolean);

	// Gets a specific user
	schema.setGet(function(error, model, options, callback) {

		var filter = NOSQL('users').one();

		options.id && filter.where('id', options.id);
		options.email && filter.where('email', options.email);
		options.password && filter.where('password', options.password);

		filter.callback(callback, 'error-404-user');
	});

	schema.setSave(function(error, model, controller, callback) {
		model.search = (model.name + ' ' + (model.email || '')).keywords(true, true).join(' ').max(500);
		NOSQL('users').modify(model).where('id', model.id).callback(function(count) {
			callback(SUCCESS(true));
			count && F.emit('users.save', model);
		});
	});

	// Removes user from DB
	schema.setRemove(function(error, id, callback) {
		NOSQL('users').remove().where('id', id).callback(callback);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		NOSQL('users').remove();
		callback(SUCCESS(true));
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);
		var filter = NOSQL('users').find();

		options.search && filter.like('search', options.search.keywords(true, true));

		filter.take(take);
		filter.skip(skip);
		filter.sort('datecreated');

		filter.callback(function(err, docs, count) {
			var data = {};
			data.count = count;
			data.items = docs;
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

		NOSQL('users').one().make(function(builder) {
			builder.or();
			builder.where(id, options.profile[id]);
			builder.where('email', options.profile.email);
			builder.end();
		}).callback(function(err, doc) {

			if (doc) {
				if (doc[id] !== options.profile[id]) {
					NOSQL('users').update(function(user) {
						if (user.id === doc.id)
							user[id] = options.profile[id];
						return user;
					});
				}
			} else {
				doc = schema.create();
				doc.id = UID();
				doc.name = options.profile.name;
				doc.firstname = options.profile.firstname;
				doc.lastname = options.profile.lastname;
				doc.email = options.profile.email;
				doc.phone = options.profile.phone;
				doc.gender = options.profile.gender;
				doc.ip = options.profile.ip;
				doc.search = (options.profile.name + ' ' + (options.profile.email || '')).keywords(true, true).join(' ').max(500);
				doc.datecreated = F.datetime;
				doc[id] = options.profile[id];

				var db = NOSQL('users');
				db.insert(doc.$clean(), F.error());
				db.counter.hit('all');
				db.counter.hit('oauth2');
				db.counter.hit(options.type);
				options.profile.gender && db.counter.hit(options.profile.gender);

				// Writes stats
				MODULE('webcounter').increment('users');
			}

			exports.login(options.controller.req, options.controller.res, doc.id);
			options.controller.req.user = exports.createSession(doc);
			callback(doc);
		});
	});

	// Stats
	schema.addWorkflow('stats', function(error, model, options, callback) {
		NOSQL('users').counter.monthly('all', callback);
	});
});

NEWSCHEMA('UserSettings').make(function(schema) {
	schema.define('id', 'String(20)');
	schema.define('firstname', 'Capitalize(50)', true);
	schema.define('lastname', 'Capitalize(50)', true);
	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone');
	schema.define('password', 'String(20)', true);

	schema.setSave(function(error, model, options, callback) {

		if (model.password.startsWith('*****'))
			model.password = undefined;
		else
			model.password = model.password.hash('sha1');

		model.name = model.firstname + ' ' + model.lastname;
		model.search = (model.name + ' ' + (model.email || '')).keywords(true, true).join(' ').max(500);

		var user = options.controller.user;
		user.name = model.name;
		user.email = model.email;
		user.firstname = model.firstname;
		user.lastname = model.lastname;

		// Update an user in database
		NOSQL('users').modify(model).where('id', model.id).callback(SUCCESS(callback));
	});
});

NEWSCHEMA('UserLogin').make(function(schema) {

	schema.define('email', 'Email', true);
	schema.define('password', 'String(20)', true);

	schema.setPrepare(function(name, value) {
		if (name === 'password')
			return value.hash('sha1');
	});

	schema.addWorkflow('exec', function(error, model, options, callback, controller) {
		GETSCHEMA('User').get(model, function(err, response) {

			if (err) {
				error.push(err);
				return callback();
			}

			if (response.isblocked) {
				error.push('error-user-blocked');
				return callback();
			}

			exports.login(controller.req, controller.res, response.id);
			callback(SUCCESS(true));
		});
	});
});

NEWSCHEMA('UserPassword').make(function(schema) {
	schema.define('email', 'Email', true);
	schema.addWorkflow('exec', function(error, model, options, callback, controller) {
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
			F.mail(model.email, '@(Password recovery)', '=?/mails/password', response, controller.language || '');
			callback(SUCCESS(true));
		});
	});
});

NEWSCHEMA('UserRegistration').make(function(schema) {
	schema.define('firstname', 'Capitalize(50)', true);
	schema.define('lastname', 'Capitalize(50)', true);
	schema.define('gender', 'Lower(20)');
	schema.define('phone', 'Phone');
	schema.define('email', 'Email', true);
	schema.define('password', 'String(20)', true);

	schema.addWorkflow('exec', function(error, model, options, callback, controller) {

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
			user.phone = model.phone;
			user.name = model.firstname + ' ' + model.lastname;
			user.gender = model.gender;
			user.password = model.password.hash('sha1');
			user.ip = controller.ip;
			user.datecreated = F.datetime;
			user.search = (user.name + ' ' + (user.email || '')).keywords(true, true).join(' ').max(500);

			var mail = F.mail(model.email, '@(Registration)', '=?/mails/registration', user, controller.language || '');

			F.config.custom.emailuserform && mail.bcc(F.config.custom.emailuserform);
			var db = NOSQL('users');
			db.insert(user);
			db.counter.hit('all');
			model.gender && db.counter.hit(model.gender);

			// Login user
			exports.login(controller.req, controller.res, user.id);
			callback(SUCCESS(true));
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
		if (user.ticks < ticks)
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

		req.user = exports.createSession(response);
		res.cookie(COOKIE, F.encrypt({ id: response.id, ip: req.ip }, SECRET, true), '6 days');
		callback(true);
	});
};