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

		var builder = new MongoBuilder();

		builder.where('isremoved', false);

		if (type === 1)
			builder.where('iscompleted', false); // uncompleted
		else if (type === 2)
			builder.or().where('iscompleted', false).where('ispaid', false).end(); // uncompleted and not paid
		else if (type === 3)
			builder.or().where('iscompleted', false).where('ispaid', true).end(); // uncompleted and paid
		else if (type === 4)
			builder.where('iscompleted', true); // completed

		if (options.delivery)
			builder.where('delivery', delivery); // by delivery

		if (options.search)
			builder.like('search', options.search);

		if (options.iduser)
			builder.where('iduser', options.iduser);

		builder.sort('_id', true);
		builder.take(take);
		builder.skip(skip);

		builder.findCount(DB('orders'), function(err, docs, count) {

			var data = {};

			data.count = count;
			data.items = docs;
			data.pages = Math.floor(count / options.max) + (count % options.max ? 1 : 0);

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

		model.id = U.GUID(8);
		model.price = price;
		model.count = count;
		model.isremoved = false;
		model.search = (model.id + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).toSearch();

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

		var builder = new MongoBuilder();

		builder.set(model.$clean());

		// Inserts order into the database
		builder.insert(DB('orders'), F.error());

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
		var builder = new MongoBuilder();
		builder.where('id', options.id);
		builder.where('isremoved', false);
		builder.findOne(DB('order'), function(err, doc) {
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

		model.search = (model.id + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).toSearch();
		model.isremoved = false;

		if (model.iscompleted && !model.datecompleted)
			model.datecompleted = new Date();

		if (model.ispaid && !model.datepaid)
			model.datepaid = new Date();

		var builder = new MongoBuilder();
		builder.set(model.$clean());
		builder.where('id', model.id);

		// Update order in database
		builder.updateOne(DB('orders'), function() {
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
		var builder = new MongoBuilder();
		builder.where('id', id);
		builder.where('isremoved', false);
		builder.set('isremoved', true);
		builder.updateOne(DB('orders'), callback);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var builder = MongoBuilder();
		builder.remove(DB('orders'), F.error());
		callback(SUCCESS(true));
	});

	// Gets some stats from orders for Dashboard
	schema.addOperation('dashboard', function(error, model, options, callback) {

		var stats = {};

		stats.completed = 0;
		stats.completed_price = 0;
		stats.pending = 0;
		stats.pending_price = 0;

		callback(stats);
		return;

		var pending = [];

		pending.push(function(next) {
			var builder = new MongoBuilder();
			builder.where('iscompleted', true);
			builder.group('_id.price.price', 'count.$sum.$price');
		});

		// @TODO: complete dashboard with orders

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
		var builder = new MongoBuilder();
		builder.where('id', id);
		builder.where('isremoved', false);
		builder.where('ispaid', false);
		builder.set('ispaid', true);
		builder.set('datepaid', new Date());
		builder.updateOne(DB('orders'), callback);
	});

});