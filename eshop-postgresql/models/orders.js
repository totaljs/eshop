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
	schema.define('phone', 'Phone');
	schema.define('address', 'String(1000)', true);
	schema.define('language', 'Lower(3)');
	schema.define('reference', 'String(10)');
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
		var sql = DB(error);

		sql.listing('items', 'tbl_order', 'id').make(function(builder) {

			builder.where('isremoved', false);

			switch (type) {
				case 1:
					// Uncompleted
					builder.where('iscompleted', false);
					break;
				case 2:
					// Uncompleted and not paid
					builder.where('iscompleted', false);
					builder.where('ispaid', false);
					break;
				case 3:
					// Uncompleted and paid
					builder.where('iscompleted', false);
					builder.where('ispaid', true);
					break;
				case 4:
					// Completed
					builder.where('iscompleted', true);
					break;
			}

			options.delivery && builder.where('delivery', options.delivery);
			options.search && builder.like('search', options.search.keywords(true, true).join(' '), '*');
			options.iduser && builder.where('iduser', options.iduser);

			builder.skip(skip);
			builder.take(take);
			builder.fields('id', 'iscompleted', 'delivery', 'firstname', 'lastname', 'status', 'count', 'ispaid', 'price', 'datecreated');
			builder.sort('datecreated', true);
		});

		sql.exec(function(err, response) {

			if (err)
				return callback();

			var data = {};
			data.count = response.items.count;
			data.items = response.items.items;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max);

			if (!data.pages)
				data.pages = 1;

			data.page = options.page + 1;
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
		model.search = (model.firstname + ' ' + (model.reference || '') + ' ' + model.lastname + ' ' + model.email).keywords(true, true).join(' ').max(80);

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

		var sql = DB(error);

		sql.insert('order', 'tbl_order').make(function(builder) {
			builder.set(model);
			builder.rem('products');
		});

		sql.primary('idorder');

		for (var i = 0, length = model.products.length; i < length; i++) {
			var item = model.products[i];
			sql.insert('tbl_order_product').make(function(builder) {
				builder.set('idorder', model.id);
				builder.set('idproduct', item.id);
				builder.set('price', item.price);
				builder.set('name', item.name);
				builder.set('count', item.count);
				builder.set('reference', item.reference);
				builder.set('pictures', item.pictures.join(';'));
			});
		}

		sql.exec(function(err) {

			// Returns response with order id
			callback(SUCCESS(true, model.id));

			if (err)
				return;

			// Writes stats
			MODULE('webcounter').increment('orders');

			// Sends email
			var mail = F.mail(model.email, '@(Order #) ' + model.id, '=?/mails/order', model, model.language || '');
			mail.bcc(F.config.custom.emailorderform);
		});
	});

	// Gets a specific order
	schema.setGet(function(error, model, options, callback) {

		// options.id {String}
		var sql = DB(error);

		sql.select('item', 'tbl_order').make(function(builder) {
			builder.where('isremoved', false);
			builder.where('id', options.id);
			builder.first();
		});

		sql.validate('item', 'error-404-order');

		sql.select('products', 'tbl_order_product').make(function(builder) {
			builder.where('idorder', options.id);
			builder.fields('idproduct as id', 'name', 'price', 'reference', 'count', 'pictures');
		});

		sql.exec(function(err, response) {
			if (err)
				return callback();
			response.item.products = response.products;
			callback(response.item);
		});
	});

	// Saves the order into the database
	schema.setSave(function(error, model, options, callback) {

		var isemail = model.isemail;

		// Cleans unnecessary properties
		delete model.isnewsletter;
		delete model.isterms;
		delete model.isemail;

		model.search = ((model.reference || '') + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).keywords(true, true).join(' ').max(80);

		if (model.datecompleted)
			model.datecompleted = model.datecompleted;
		else if (model.iscompleted && !model.datecompleted)
			model.datecompleted = new Date();

		var sql = DB(error);

		sql.update('item', 'tbl_order').make(function(builder) {
			builder.set(model);
			builder.rem('id');
			builder.rem('datecreated');
			builder.rem('products');
			builder.set('dateupdated', new Date());
			builder.where('id', model.id);
		});

		sql.remove('tbl_order_product').where('idorder', model.id);
		sql.primary('idorder');

		for (var i = 0, length = model.products.length; i < length; i++) {
			var item = model.products[i];
			sql.insert('tbl_order_product').make(function(builder) {
				builder.set('idorder', model.id);
				builder.set('idproduct', item.id);
				builder.set('price', item.price);
				builder.set('name', item.name);
				builder.set('count', item.count);
				builder.set('reference', item.reference);
				builder.set('pictures', item.pictures.join(';'));
			});
		}

		sql.exec(function(err) {
			// Returns response
			callback(SUCCESS(true));

			if (err)
				return;

			F.emit('orders.save', model);
		});

		if (!isemail)
			return;

		// Sends email
		var mail = F.mail(model.email, '@(Order (update) #) ' + model.id, '=?/mails/order-status', model, model.language || '');
		mail.bcc(F.config.custom.emailorderform);
	});

	// Removes order from DB
	schema.setRemove(function(error, id, callback) {
		var sql = DB(error);

		sql.update('item', 'tbl_order').make(function(builder) {
			builder.where('id', id);
			builder.set('isremoved', true);
		});

		sql.exec(function() {
			callback(SUCCESS(true));
		});
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		var sql = DB();
		sql.remove('tbl_order');
		sql.exec(F.error());
		callback(SUCCESS(true));
	});

	// Gets some stats from orders for Dashboard
	schema.addOperation('dashboard', function(error, model, options, callback) {
		var sql = DB(error);
		sql.query('completed', 'SELECT COUNT(id) as count, SUM(price) as price FROM tbl_order').where('isremoved', false).where('iscompleted', true).first();
		sql.query('pending', 'SELECT COUNT(id) as count, SUM(price) as price FROM tbl_order').where('isremoved', false).where('iscompleted', false).first();
		sql.exec(function(err, response) {

			var stats = {};

			stats.completed = response.completed.count;
			stats.completed_price = response.completed.price || 0;
			stats.pending = response.pending.count;
			stats.pending_price = response.pending.price || 0;

			// Returns stats for dashboard
			callback(stats);
		});
	});

	// Sets the payment status to paid
	schema.addWorkflow('paid', function(error, model, id, callback) {

		var sql = DB(error);

		sql.update('tbl_order').make(function(builder) {
			builder.set('ispaid', true);
			builder.set('datepaid', new Date());
			builder.where('id', id);
		});

		sql.exec(callback);
	});

});