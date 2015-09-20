var OrderItem = NEWSCHEMA('OrderItem');
OrderItem.define('id', String, true);
OrderItem.define('price', Number, true);
OrderItem.define('name', String, true);
OrderItem.define('reference', String);
OrderItem.define('pictures', '[String]');
OrderItem.define('count', Number, true);

var Order = NEWSCHEMA('Order');
Order.define('id', String);
Order.define('iduser', String);
Order.define('status', 'String(100)');
Order.define('delivery', 'String(30)', true);
Order.define('firstname', 'String(40)', true);
Order.define('lastname', 'String(40)', true);
Order.define('email', 'String(200)', true);
Order.define('phone', 'String(20)');
Order.define('address', 'String(1000)', true);
Order.define('message', 'String(500)');
Order.define('note', String);
Order.define('ip', String);
Order.define('iscompleted', Boolean);
Order.define('datecreated', Date);
Order.define('datecompleted', Date);
Order.define('datepaid', Date);
Order.define('price', Number);
Order.define('count', Number);
Order.define('products', '[OrderItem]', true);
Order.define('isnewsletter', Boolean);
Order.define('ispaid', Boolean);
Order.define('isterms', Boolean);
Order.define('isemail', Boolean);

// Sets default values
Order.setDefault(function(name) {
	switch (name) {
		case 'status':
			return F.config.custom.defaultorderstatus;
		case 'datecreated':
			return new Date();
	}
});

// Gets listing
Order.setQuery(function(error, options, callback) {

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

		// Gets page count
		data.pages = Math.floor(count / options.max) + (count % options.max ? 1 : 0);

		if (data.pages === 0)
			data.pages = 1;

		data.page = options.page + 1;

		// Returns data
		callback(data);

	}, skip, take);
});

// Creates order
Order.addWorkflow('create', function(error, model, options, callback) {

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
Order.setGet(function(error, model, options, callback) {

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
Order.setSave(function(error, model, options, callback) {

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
		return model.$clean();
	};

	// Update order in database
	DB('orders').update(updater, function() {
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
Order.setRemove(function(error, id, callback) {

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
Order.addWorkflow('clear', function(error, model, options, callback) {
	DB('orders').clear(NOOP);
	callback(SUCCESS(true));
});

// Gets some stats from orders for Dashboard
Order.addOperation('dashboard', function(error, model, options, callback) {

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
Order.addWorkflow('paid', function(error, model, id, callback) {

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