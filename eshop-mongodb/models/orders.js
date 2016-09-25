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
	schema.define('firstname', 'Camelize(40)', true);
	schema.define('lastname', 'Camelize(40)', true);
	schema.define('email', 'Email', true);
	schema.define('reference', 'String(10)');
	schema.define('phone', 'Phone');
	schema.define('language', 'Lower(3)');
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

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);
		var type = U.parseInt(options.type);

		var nosql = DB(error);

		nosql.listing('orders', 'orders').make(function(builder) {
			builder.where('isremoved', false);

			if (type === 1)
				builder.where('iscompleted', false); // uncompleted
			else if (type === 2)
				builder.where('iscompleted', false).where('ispaid', false); // uncompleted and not paid
			else if (type === 3)
				builder.where('iscompleted', false).where('ispaid', true); // uncompleted and paid
			else if (type === 4)
				builder.where('iscompleted', true); // completed

			options.delivery && builder.where('delivery', delivery);// by delivery
			options.search && builder.in('search', options.search.keywords(true, true));
			options.iduser && builder.where('iduser', options.iduser);

			builder.sort('_id', true);
			builder.take(take);
			builder.skip(skip);
		});

		nosql.exec(function(err, response) {

			var data = {};

			data.count = response.orders.count;
			data.items = response.orders.items;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max);

			if (!data.pages)
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
		model.datecreated = F.datetime;
		model.isremoved = false;
		model.search = (model.id + ' ' + (model.reference || '') + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).keywords(true, true);

		if (model.isnewsletter) {
			var newsletter = GETSCHEMA('Newsletter').create();
			newsletter.email = model.email;
			newsletter.ip = model.ip;
			newsletter.$save();
		}

		// Cleans unnecessary properties
		model.isnewsletter = undefined;
		model.isterms = undefined;
		model.isemail = undefined;

		var nosql = DB(error);

		nosql.insert('orders').make(function(builder) {
			builder.set(model.$clean());
		});

		nosql.exec(F.error());

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

		var nosql = DB(error);

		nosql.select('order', 'orders').make(function(builder) {
			builder.where('id', options.id);
			builder.where('isremoved', false);
			builder.first();
		});

		nosql.validate('order', 'error-404-order')
		nosql.exec(callback, 'order');
	});

	// Saves the order into the database
	schema.setSave(function(error, model, options, callback) {

		var isemail = model.isemail;

		// Cleans unnecessary properties
		model.isnewsletter = undefined;
		model.isterms = undefined;
		model.isemail = undefined;

		model.search = (model.id + ' ' + (model.reference || '') + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).keywords(true, true);
		model.isremoved = false;

		if (model.iscompleted && !model.datecompleted)
			model.datecompleted = F.datetime;

		if (model.ispaid && !model.datepaid)
			model.datepaid = F.datetime;

		var nosql = DB(error);

		nosql.update('order', 'orders').make(function(builder) {
			builder.set(model.$clean());
			builder.rem('id');
			builder.rem('datecreated');
			builder.set('dateupdated', F.datetime);
			builder.where('id', model.id);
			builder.first();
		});

		nosql.exec(function(err) {
			callback(SUCCESS(true));
			!err && F.emit('orders.save', model);
		});

		if (!isemail)
			return;

		// Sends email
		var mail = F.mail(model.email, '@(Order (update) #) ' + model.id, '=?/mails/order-status', model, model.language || '');
		mail.bcc(F.config.custom.emailorderform);
	});

	// Removes order from DB
	schema.setRemove(function(error, id, callback) {
		var nosql = DB(error);

		nosql.update('orders').make(function(builder) {
			builder.where('id', id);
			builder.where('isremoved', false);
			builder.set('isremoved', true);
			builder.first();
		});

		nosql.exec(SUCCESS(callback), -1);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var nosql = DB(error);
		nosql.remove('orders');
		nosql.exec(SUCCESS(callback), -1);
	});

	// Gets some stats from orders for Dashboard
	schema.addOperation('dashboard', function(error, model, options, callback) {

		var stats = {};

		stats.completed = 0;
		stats.completed_price = 0;
		stats.pending = 0;
		stats.pending_price = 0;

		var nosql = DB(error);

		nosql.push('orders', 'orders', function(collection, callback) {

			// groupping
			var $group = {};
			$group._id = {};
			$group._id = '$iscompleted';
			$group.sum = { $sum: '$price' };
			$group.count = { $sum: 1 };

			// filter
			var $match = {};
			$match.isremoved = false;

			var pipeline = [];
			pipeline.push({ $match: $match });
			pipeline.push({ $group: $group });

			collection.aggregate(pipeline, callback);
		});

		nosql.exec(function(err, response) {

			if (err) {
				callback(stats);
				return;
			}

			for (var i = 0, length = response.orders.length; i < length; i++) {
				var agg = response.orders[i];
				if (agg._id) {
					stats.completed = agg.count;
					stats.completed_price = agg.sum;
				} else {
					stats.pending = agg.count;
					stats.pending_price = agg.sum;
				}
			}

			callback(stats);
		});
	});

	// Sets the payment status to paid
	schema.addWorkflow('paid', function(error, model, id, callback) {
		var nosql = DB(error);

		nosql.udpate('orders').make(function(builder) {
			builder.where('id', id);
			builder.where('isremoved', false);
			builder.where('ispaid', false);
			builder.set('ispaid', true);
			builder.set('datepaid', F.datetime);
			builder.first();
		});

		nosql.exec(SUCCESS(callback), -1);
	});

});