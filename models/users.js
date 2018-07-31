const COOKIE = '__user';
const SECRET = '06eshopToTal11';
const ONLINE = {};

// Creates a cookie
exports.login = function(controller, id) {
	controller.cookie(COOKIE, F.encrypt({ id: id, ip: controller.ip }, SECRET, true), '6 days');
};

// Removes a cookie
exports.logoff = function(controller, user) {
	if (user)
		delete ONLINE[user.id];
	controller.cookie(COOKIE, '', F.datetime.add('-1 day'));
};

// Creates a session object
exports.session = function(user) {
	return ONLINE[user.id] = { id: user.id, name: user.name, firstname: user.firstname, lastname: user.lastname, email: user.email, ticks: F.datetime.add('30 minutes').getTime(), phone: user.phone, discount: user.discount };
};

NEWSCHEMA('User').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('ip', 'String(80)');
	schema.define('name', 'String(100)', true);
	schema.define('firstname', 'Capitalize(50)');
	schema.define('lastname', 'Capitalize(50)');
	schema.define('phone', 'Phone');
	schema.define('email', 'Email');
	schema.define('gender', ['male', 'female']);
	schema.define('discount', Number);
	schema.define('isblocked', Boolean);
	schema.define('isconfirmed', Boolean);

	// Gets a specific user
	schema.setGet(function($) {

		var options = $.options;
		var filter = NOSQL('users').one();

		options.id && filter.where('id', options.id);
		options.email && filter.where('email', options.email);
		options.password && filter.where('password', options.password);
		$.id && filter.where('id', $.id);

		filter.callback($.callback, 'error-users-404');
	});

	schema.setSave(function($) {

		var model = $.model;
		var user = $.user.name;

		model.search = (model.name + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).keywords(true, true).join(' ').max(500);

		NOSQL('users').modify(model).backup(user).log('Update: ' + model.id, user).where('id', model.id).callback(function(count) {

			if (model.isblocked) // Logout user
				delete ONLINE[model.id];
			else if (ONLINE[model.id]) // Modifies session
				exports.session(model);

			$.success();

			if (count) {
				EMIT('users.save', model);
				ADMIN.notify({ type: 'users.save', message: model.firstname + ' ' + model.lastname });
			}
		});
	});

	// Removes user from DB
	schema.setRemove(function($) {
		var id = $.body.id;
		var user = $.user.name;
		NOSQL('users').remove().backup(user).log('Remove: ' + id, user).where('id', id).callback(() => $.success());
	});

	// Clears DB
	schema.addWorkflow('clear', function($) {
		var user = $.user.name;
		NOSQL('users').remove().backup(user).log('Clear all users', user).callback(() => $.success());
	});

	// Gets listing
	schema.setQuery(function($) {

		var opt = $.options === EMPTYOBJECT ? $.query : $.options;
		var isAdmin = $.controller ? $.controller.name === 'admin' : false;
		var filter = NOSQL('users').find();

		filter.paginate(opt.page, opt.limit, 70);

		if (isAdmin) {
			opt.name && filter.adminFilter('name', opt, String);
			opt.email && filter.adminFilter('email', opt, String);
			opt.phone && filter.adminFilter('phone', opt, String);
			opt.discount && filter.adminFilter('discount', opt, Number);
			opt.datecreated && filter.adminFilter('datecreated', opt, Date);
		}

		if (opt.sort)
			filter.adminSort(opt.sort);
		else
			filter.sort('datecreated', true);

		filter.fields('id', 'name', 'discount', 'gender', 'email', 'phone', 'datecreated', 'isblocked', 'isconfirmed');
		filter.callback(function(err, docs, count) {

			for (var i = 0, length = docs.length; i < length; i++) {
				var item = docs[i];
				item.online = !!ONLINE[item.id];
			}

			$.callback(filter.adminOutput(docs, count));
		});
	});

	// Stats
	schema.addWorkflow('stats', function($) {
		var output = {};
		var nosql = NOSQL('users');

		if (!$.id) {
			nosql.counter.monthly('all', $.callback);
			return;
		}

		nosql.counter.monthly($.id, function(err, response) {
			output.logins = response;
			nosql.counter.monthly('order' + $.id, function(err, response) {
				output.orders = response;
				$.callback(output);
			});
		});
	});
});

NEWSCHEMA('UserSettings').make(function(schema) {

	schema.define('name', 'String(100)', true);
	schema.define('firstname', 'Capitalize(50)', true);
	schema.define('lastname', 'Capitalize(50)', true);
	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone');

	schema.define('ispassword', 'Boolean');
	schema.define('password', 'String(30)');
	schema.define('passwordreply', 'String(30)');

	// Validation
	schema.required('password', model => model.ispassword);

	schema.setSave(function($) {

		var model = $.model;

		if (model.ispassword && model.password !== model.passwordreply) {
			$.invalid('error-password-check');
			return;
		}

		if (model.ispassword)
			model.password = model.password.hash('sha1');
		else
			model.password = undefined;

		model.passwordreply = undefined;
		model.search = (model.name + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).keywords(true, true).join(' ').max(500);

		var user = $.user;
		user.name = model.name;
		user.firstname = model.firstname;
		user.lastname = model.lastname;
		user.email = model.email;
		user.phone = model.phone;

		ADMIN.notify({ type: 'users.update', message: model.firstname + ' ' + model.lastname });
		NOSQL('users').modify(model).where('id', $.user.id).log('Update account, IP: ' + $.controller.ip, $.user.name).callback(() => $.success());
	});

	schema.setGet(function($) {
		NOSQL('users').one().fields('name', 'firstname', 'lastname', 'phone', 'email', 'datecreated', 'discount').where('id', $.user.id).callback($.callback, 'error-users-404');
	});

});

NEWSCHEMA('UserLogin').make(function(schema) {

	schema.define('email', 'Email', true);
	schema.define('password', 'String(30)', true);

	schema.setPrepare(function(name, value) {
		if (name === 'password')
			return value.hash('sha1');
	});

	schema.addWorkflow('exec', function($) {

		var model = $.model;

		NOSQL('users').one().fields('id', 'firstname', 'lastname').where('email', model.email).where('password', model.password).callback(function(err, response) {

			if (!response) {
				$.invalid('error-users-credentials');
				return;
			}

			if (response.isblocked) {
				$.invalid('error-users-blocked');
				return;
			}

			exports.login($.controller, response.id);
			$.success();
		});

	});
});

NEWSCHEMA('UserPassword').make(function(schema) {
	schema.define('email', 'Email', true);
	schema.addWorkflow('exec', function(error, model, options, callback, controller) {
		$GET('User', model, function(err, response) {

			if (err) {
				error.push(err);
				return callback();
			}

			if (response.isblocked) {
				error.push('error-user-blocked');
				return callback();
			}

			response.hash = F.encrypt({ id: response.id, expire: F.datetime.add('2 days').getTime() });
			MAIL(model.email, '@(Password recovery)', '=?/mails/password', response, controller.language || '');
			callback(SUCCESS(true));
		});
	});
});

NEWSCHEMA('UserOrder').make(function(schema) {

	// Gets all created orders
	schema.setQuery(function($) {
		NOSQL('orders').find().where('iduser', $.user.id).fields('id', 'price', 'count', 'name', 'datecreated', 'number', 'status', 'delivery', 'payment', 'isfinished', 'ispaid').sort('datecreated', true).callback($.callback);
	});

	// Autofill
	// Gets latest data from last order or gets a user profile
	schema.setGet(function($) {

		NOSQL('orders').one().where('iduser', $.user.id).sort('datecreated', true).fields('iduser', 'firstname', 'lastname', 'billingstreet', 'billingcity', 'billingzip', 'billingcountry', 'email', 'phone', 'iscompany', 'company', 'companyvat', 'companyid').callback(function(err, response) {

			if (response) {
				$.callback(response);
				return;
			}

			var data = CLONE($.user);
			data.id = undefined;
			data.ticks = undefined;
			data.name = undefined;
			$.callback(data);
		});
	});

});

NEWSCHEMA('UserCreate').make(function(schema) {

	schema.define('firstname', 'Capitalize(50)', true);
	schema.define('lastname', 'Capitalize(50)', true);
	schema.define('gender', ['male', 'female']);
	schema.define('phone', 'Phone');
	schema.define('email', 'Email', true);
	schema.define('password', 'String(30)', true);
	schema.define('passwordreply', 'String(30)', true);
	schema.define('isterms', Boolean);

	schema.setSave(function($) {

		var model = $.model;

		if (!model.isterms) {
			$.invalid('error-terms');
			return;
		}

		if (model.password !== model.passwordreply) {
			$.invalid('error-password-check');
			return;
		}

		var nosql = NOSQL('users');

		nosql.one().where('email', model.email).callback(function(err, doc) {

			if (doc) {
				$.invalid('error-users-email');
				return;
			}

			var user = $CREATE('User');
			user.id = UID();
			user.email = model.email;
			user.firstname = model.firstname;
			user.lastname = model.lastname;
			user.phone = model.phone;
			user.name = model.firstname + ' ' + model.lastname;
			user.gender = model.gender;
			user.password = model.password.hash('sha1');
			user.ip = $.ip;
			user.datecreated = F.datetime;
			user.isblocked = false;
			user.isconfirmed = false;

			var mail = MAIL(model.email, '@(Registration)', '=?/mails/registration', user, $.language);
			F.global.config.emailuserform && mail.bcc(F.global.config.emailuserform);

			var nosql = NOSQL('users');
			nosql.insert(user);
			nosql.counter.hit('all');
			model.gender && nosql.counter.hit(model.gender);

			ADMIN.notify({ type: 'users.create', message: user.firstname + ' ' + user.lastname });

			// Login user
			exports.login($.controller, user.id);
			$.success(true);
		});

	});
});

// Cleans expired users
ON('service', function(counter) {

	if (counter % 10 !== 0)
		return;

	var users = Object.keys(ONLINE);
	var ticks = F.datetime.getTime();

	for (var i = 0, length = users.length; i < length; i++) {
		var user = ONLINE[users[i]];
		if (user.ticks < ticks)
			delete ONLINE[users[i]];
	}
});

// Rewrites framework authorization
F.onAuthorize = function(req, res, flags, callback) {

	var hash = req.cookie(COOKIE);
	if (!hash || hash.length < 20) {
		callback(false);
		return;
	}

	var user = F.decrypt(hash, SECRET, true);
	if (!user || user.ip !== req.ip) {
		exports.logoff(res);
		callback(false);
		return;
	}

	var session = ONLINE[user.id];
	if (session) {
		req.user = session;
		session.ticks = F.datetime.add('30 minutes').getTime();
		callback(true);
		return;
	}

	NOSQL('users').one().where('id', user.id).where('isblocked', false).callback(function(err, response) {

		if (response) {

			req.user = exports.session(response);
			callback(true);

			// Notifies admin
			ADMIN.notify({ type: 'users.login', message: response.firstname + ' ' + response.lastname });

			// Writes stats of login
			NOSQL('users').counter.hit(response.id);

		} else {
			exports.logoff(res);
			callback(false);
		}

	});
};
