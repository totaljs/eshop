NEWSCHEMA('OrderItem').make(function(schema) {

	schema.define('id', 'String(10)', true);
	schema.define('price', Number, true);
	schema.define('name', 'String(50)', true);
	schema.define('reference', 'String(20)');
	schema.define('pictures', '[String]');
	schema.define('count', Number, true);

});

NEWSCHEMA('Order').make(function(schema) {

	schema.define('id', 'String(10)');
	schema.define('iduser', 'String(10)');
	schema.define('status', 'String(100)');
	schema.define('delivery', 'String(30)', true);
	schema.define('firstname', 'String(40)', true);
	schema.define('lastname', 'String(40)', true);
	schema.define('email', 'String(200)', true);
	schema.define('phone', 'String(20)');
	schema.define('address', 'String(1000)', true);
	schema.define('message', 'String(500)');
	schema.define('note', 'String(500)');
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
	schema.define('isterms', Boolean);
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

		// Filtering documents
		var filter = function(doc) {

			// Uncompleted
			if (type === 1 && doc.iscompleted)
				return;

			// Uncompleted and not paid
			if (type === 2 && (doc.iscompleted || doc.ispaid))
				return;

			// Uncompleted and paid
			if (type === 3 && (doc.iscompleted || !doc.ispaid))
				return;

			// Completed
			if (type === 4 && !doc.iscompleted)
				return;

			// Delivery
			if (options.delivery && doc.delivery !== delivery)
				return;

			// Search
			if (options.search && (doc.id + ' ' + doc.firstname + ' ' + doc.lastname).toSearch().indexOf(options.search) === -1)
				return;

			if (options.iduser && options.iduser !== doc.iduser)
				return;

			return doc;
		};

		// Sorting documents
		var sorting = function(a, b) {
			if (new Date(a.datecreated) > new Date(b.datecreated))
				return -1;
			return 1;
		};

		DB('orders').sort(filter, sorting, function(err, docs, count) {
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

	// Creates order
	schema.addWorkflow('create', function(error, model, options, callback) {

		var price = 0;
		var count = 0;

		for (var i = 0, length = model.products.length; i < length; i++) {
			var product = model.products[i];
			price += product.price * product.count;
			count += product.count;
		}

		model.id = U.GUID(8);
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
		delete model.isterms;
		delete model.isemail;

		// Inserts order into the database
		DB('orders').insert(model);

		// Returns response with order id
		callback(SUCCESS(true, model.id));

		// Writes stats
		MODULE('webcounter').increment('orders');

		// Sends email
		var mail = F.mail(model.email, 'Order # ' + model.id, '~mails/order', model);
		mail.bcc(F.config.custom.emailorderform);
	});

	// Gets a specific order
	schema.setGet(function(error, model, options, callback) {

		// options.id {String}

		var filter = function(doc) {
			if (options.id && doc.id !== options.id)
				return;
			return doc;
		};

		DB('orders').one(filter, function(err, doc) {
			if (doc)
				return callback(doc);
			error.push('error-404-order');
			callback();
		});
	});

	// Saves the order into the database
	schema.setSave(function(error, model, options, callback) {

		var isemail = model.isemail;

		// Cleans unnecessary properties
		delete model.isnewsletter;
		delete model.isterms;
		delete model.isemail;

		if (model.datecompleted)
			model.datecompleted = model.datecompleted.format();
		else if (model.iscompleted && !model.datecompleted)
			model.datecompleted = (new Date()).format();

		if (model.datecreated)
			model.datecreated = model.datecreated.format();

		if (model.ispaid && !model.datepaid)
			model.datepaid = (new Date()).format();

		var updater = function(doc) {
			if (doc.id !== model.id)
				return doc;
			doc.datebackuped = new Date().format();
			DB('orders_backup').insert(doc);
			return model.$clean();
		};

		// Update order in database
		DB('orders').update(updater, function() {

			F.emit('orders.save', model);

			// Returns response
			callback(SUCCESS(true));
		});

		if (!isemail)
			return;

		// Sends email
		var mail = F.mail(model.email, 'Order (update) # ' + model.id, '~mails/order-status', model);
		mail.bcc(F.config.custom.emailorderform);
	});

	// Removes order from DB
	schema.setRemove(function(error, id, callback) {

		// Filter for removing
		var updater = function(doc) {
			if (doc.id !== id)
				return doc;
			return null;
		};

		// Updates database file
		DB('orders').update(updater, callback);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		DB('orders').clear(NOOP);
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

			// Saves memory
			return 0;
		};

		DB('orders').all(prepare, function(err) {
			// Returns stats for dashboard
			callback(stats);
		});
	});

	// Sets the payment status to paid
	schema.addWorkflow('paid', function(error, model, id, callback) {

		// Filter for update
		var updater = function(doc) {
			if (doc.id !== id)
				return doc;
			doc.ispaid = true;
			doc.datepaid = (new Date()).format();
			return doc;
		};

		// Updates database file
		DB('orders').update(updater, callback);
	});

});