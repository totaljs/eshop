// Supported operations:
// "dashboard" gets stats

// Supported workflows
// "create" creates an order
// "paid" sets ispaid
// "clear" removes all orders

NEWSCHEMA('OrderItem').make(function(schema) {

	schema.define('id', 'String(20)', true);
	schema.define('price', Number, true);
	schema.define('name', 'String(50)', true);
	schema.define('reference', 'String(20)');
	schema.define('pictures', '[String]');
	schema.define('count', Number, true);

});

NEWSCHEMA('Order').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('iduser', 'String(20)');
	schema.define('status', 'String(100)');
	schema.define('delivery', 'String(30)', true);
	schema.define('firstname', 'String(40)', true);
	schema.define('lastname', 'String(40)', true);
	schema.define('email', 'String(200)', true);
	schema.define('phone', 'String(20)');
	schema.define('address', 'String(1000)', true);
	schema.define('message', 'String(500)');
	schema.define('note', 'String(500)');
	schema.define('language', 'String(3)');
	schema.define('reference', 'String(10)');
	schema.define('ip', 'String(80)');
	schema.define('iscompleted', Boolean);
	schema.define('datecreated', Date);
	schema.define('datecompleted', Date);
	schema.define('datepaid', Date);
	schema.define('price', Number);
	schema.define('count', Number);
	schema.define('products', '[OrderItem]', true);
	schema.define('isnewsletter', Boolean);
	schema.define('ispaid', Boolean);
	schema.define('isemail', Boolean);

	// Sets default values
	schema.setDefault(function(name) {
		switch (name) {
			case 'status':
				return F.config.custom.defaultorderstatus;
			case 'datecreated':
				return new Date();
		}
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {

		// options.search {String}
		// options.delivery {String}
		// options.type {String}
		// options.page {String or Number}
		// options.max {String or Number}
		// options.iduser {String}

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		// Prepares searching
		if (options.search)
			options.search = options.search.toSearch();

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);
		var type = U.parseInt(options.type);

		var filter = DB('orders').find();

		if (type === 1)
			filter.where('iscompleted', false); // Uncompleted
		else if (type === 2)
			filter.where('iscompleted', false).where('ispaid', false); // Uncompleted and not paid
		else if (type === 3)
			filter.where('iscompleted', false).where('ispaid', true); // Uncompleted and paid
		else if (type === 4)
			filter.where('iscompleted', true); // Uncompleted and paid

		if (options.iduser)
			filter.where('iduser', options.iduser);

		if (options.search)
			filter.like('search', options.search.keywords(true, true));

		filter.skip(skip);
		filter.take(take);
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

	// Creates order
	schema.addWorkflow('create', function(error, model, options, callback) {

		var price = 0;
		var count = 0;

		for (var i = 0, length = model.products.length; i < length; i++) {
			var product = model.products[i];
			price += product.price * product.count;
			count += product.count;
		}

		model.id = UID();
		model.price = price;
		model.count = count;

		if (model.isnewsletter) {
			var newsletter = GETSCHEMA('Newsletter').create();
			newsletter.email = model.email;
			newsletter.ip = model.ip;
			newsletter.$save();
		}

		// Cleans unnecessary properties
		delete model.isnewsletter;
		delete model.isemail;

		// Inserts order into the database
		DB('orders').insert(model);

		// Returns response with order id
		callback(SUCCESS(true, model.id));

		// Writes stats
		MODULE('webcounter').increment('orders');

		// Sends email
		var mail = F.mail(model.email, '@(Order #) ' + model.id, '=?/mails/order', model, model.language || '');
		mail.bcc(F.config.custom.emailorderform);
	});

	// Gets a specific order
	schema.setGet(function(error, model, options, callback) {
		// options.id {String}
		DB('orders').one().where('id', options.id).callback(callback, 'error-404-order');
	});

	// Saves the order into the database
	schema.setSave(function(error, model, options, callback) {

		var isemail = model.isemail;

		// Cleans unnecessary properties
		delete model.isnewsletter;
		delete model.isemail;

		if (model.iscompleted && !model.datecompleted)
			model.datecompleted = new Date();

		if (model.ispaid && !model.datepaid)
			model.datepaid = new Date();

		model.search = (model.id + ' ' + (model.reference || '') + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).keywords(true, true).join(' ');

		// Update order in database
		DB('orders').update(model).where('id', model.id).callback(function(err, count) {

			// Returns response
			callback(SUCCESS(true));

			if (!count)
				return;

			F.emit('orders.save', model);
			model.datebackuped = new Date();
			DB('orders_backup').insert(model);
		});

		if (!isemail)
			return;

		// Sends email
		var mail = F.mail(model.email, '@(Order (update) #) ' + model.id, '=?/mails/order-status', model, model.language || '');
		mail.bcc(F.config.custom.emailorderform);
	});

	// Removes order from DB
	schema.setRemove(function(error, id, callback) {
		// Updates database file
		DB('orders').remove().where('id', id).callback(callback);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		DB('orders').remove();
		callback(SUCCESS(true));
	});

	// Gets some stats from orders for Dashboard
	schema.addOperation('dashboard', function(error, model, options, callback) {

		var stats = {};

		stats.completed = 0;
		stats.completed_price = 0;
		stats.pending = 0;
		stats.pending_price = 0;

		var prepare = function(doc) {
			if (doc.iscompleted) {
				stats.completed++;
				stats.completed_price += doc.price;
			} else {
				stats.pending++;
				stats.pending_price += doc.price;
			}
		};

		// Returns data for dashboard
		DB('orders').find().prepare(prepare).callback(() => callback(stats));
	});

	// Sets the payment status to paid
	schema.addWorkflow('paid', function(error, model, id, callback) {
		DB('orders').modify({ ispaid: true, datepaid: new Date() }).where('id', id).callback(callback);
	});

});