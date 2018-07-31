// ====== Supported operations:
// "dashboard"  - gets stats

// ====== Supported workflows:
// "create"     - creates an order
// "paid"       - sets ispaid to true
// "clear"      - removes all orders

NEWSCHEMA('OrderItem').make(function(schema) {
	schema.define('id', 'String(24)');
	schema.define('idvariant', 'UID');
	schema.define('price', Number);
	schema.define('name', 'String(50)', true);
	schema.define('reference', 'String(20)');
	schema.define('count', Number, true);
});

NEWSCHEMA('OrderStatus').make(function(schema) {
	schema.define('date', Date);
	schema.define('status', 'String(100)');
});

NEWSCHEMA('Order').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('iduser', 'UID');
	schema.define('number', 'String(10)');
	schema.define('status', 'String(100)');
	schema.define('statushistory', '[OrderStatus]');
	schema.define('delivery', 'String(50)', true);
	schema.define('payment', 'String(50)', true);
	schema.define('firstname', 'Capitalize(40)', true);
	schema.define('lastname', 'Capitalize(40)', true);
	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone');
	schema.define('message', 'String(500)');
	schema.define('note', 'String(100)');
	schema.define('language', 'Lower(2)');
	schema.define('reference', 'String(50)');
	schema.define('trackingcode', 'String(50)');
	schema.define('discount', Number);
	schema.define('price', Number);
	schema.define('count', Number);
	schema.define('items', '[OrderItem]', true);

	schema.define('company', 'String(40)', true);
	schema.define('companyid', 'String(15)', true);
	schema.define('companyvat', 'String(30)', true);

	schema.define('billingstreet', 'String(50)', true);
	schema.define('billingzip', 'String(20)', true);
	schema.define('billingcity', 'String(50)', true);
	schema.define('billingcountry', 'String(50)', true);

	schema.define('deliveryfirstname', 'String(50)');
	schema.define('deliverylastname', 'String(50)');
	schema.define('deliverystreet', 'String(50)');
	schema.define('deliveryzip', 'String(20)');
	schema.define('deliverycity', 'String(50)');
	schema.define('deliverycountry', 'String(50)');
	schema.define('deliveryphone', 'Phone');

	schema.define('iscompany', Boolean);
	schema.define('isfinished', Boolean);
	schema.define('isemail', Boolean);              // internal
	schema.define('isnewsletter', Boolean);         // internal
	schema.define('ispaid', Boolean);
	schema.define('isterms', Boolean);              // internal

	// Custom validaiton
	schema.required('company, companyvat, companyid', n => n.iscompany);

	// Sets default values
	schema.setDefault(function(name) {
		switch (name) {
			case 'status':
				return F.global.config.defaultorderstatus;
		}
	});

	// Gets listing
	schema.setQuery(function($) {

		var opt = $.options === EMPTYOBJECT ? $.query : $.options;
		var isAdmin = $.controller ? $.controller.name === 'admin' : false;
		var filter = NOSQL('orders').find();

		filter.paginate(opt.page, opt.limit, 70);

		if (isAdmin) {
			opt.number && filter.adminFilter('number', opt, String);

			if (opt.name) {
				opt.name = opt.name.keywords(true, true).join(' ');
				filter.adminFilter('name', opt, String, 'search');
			}

			opt.delivery && filter.adminFilter('delivery', opt, String);
			opt.payment && filter.adminFilter('payment', opt, String);
			opt.discount && filter.adminFilter('discount', opt, Number);
			opt.price && filter.adminFilter('price', opt, Number);
			opt.status && filter.adminFilter('status', opt, String);
			opt.datecreated && filter.adminFilter('datecreated', opt, Date);
			filter.fields('note');
		}

		if (opt.sort)
			filter.adminSort(opt.sort);
		else
			filter.sort('datecreated', true);

		filter.fields('id', 'number', 'name', 'status', 'price', 'discount', 'count', 'delivery', 'payment', 'email', 'phone', 'datecreated', 'ispaid', 'isfinished');
		filter.callback((err, docs, count) => $.callback(filter.adminOutput(docs, count)));
	});

	// Saves the order into the database
	schema.setSave(function($) {

		var model = $.model;
		var user = $.user.name;
		var isemail = model.isemail;
		var isUpdate = !!model.id;
		var nosql = NOSQL('orders');

		// Cleans unnecessary properties
		model.isnewsletter = undefined;
		model.isemail = undefined;

		if (model.iscompany && !model.company)
			model.iscompany = false;

		if (isUpdate) {
			model.adminupdated = user;
			model.dateupdated = F.datetime;
			model.ip = $.ip;
		} else {
			model.id = UID();
			model.admincreated = user;
			model.datecreated = F.datetime;
			model.number = createNumber(nosql);
			nosql.counter.hit('all');
		}

		if (model.isfinished && !model.datefinished)
			model.datefinished = F.datetime;

		if (model.ispaid && !model.datepaid)
			model.datepaid = F.datetime;

		model.name = model.iscompany ? model.company : model.lastname + ' ' + model.firstname;
		model.search = (model.id + ' ' + (model.reference || '') + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email + ' ' + model.company).keywords(true, true).join(' ').max(500);

		model.price = 0;
		model.count = 0;

		for (var i = 0, length = model.items.length; i < length; i++) {
			var item = model.items[i];
			model.price += (item.price * item.count);
			model.count += item.count;
		}

		var db = isUpdate ? nosql.modify(model).where('id', model.id).backup(user).log('Update: ' + model.id, user) : nosql.insert(model).log('Create: ' + model.id, user);

		db.callback(function() {
			EMIT('orders.save', model);
			ADMIN.notify({ type: 'orders.save', message: model.name + ', ' + model.price.format(2) });
			$.success();
		});

		// Sends email
		isemail && MAIL(model.email, '@(Order status #) ' + model.id, '=?/mails/order-status', model, model.language);
	});

	// Creates order
	schema.addWorkflow('create', function($) {

		var model = $.model;

		// Check terms and conditions
		if (!model.isterms) {
			$.invalid('error-terms');
			return;
		}

		var options = { id: [] };
		for (var i = 0, length = model.items.length; i < length; i++)
			options.id.push(model.items[i].id);

		// Get prices of ordered products
		// This is the check for price hijacking
		$WORKFLOW('Product', 'prices', options, function(err, response) {

			// Some unexpected error
			if (err) {
				$.invalid(err);
				return;
			}

			var db = NOSQL('orders');
			var counter = db.counter;
			var discount = $.user ? $.user.discount : 0;

			model.price = 0;
			model.count = 0;

			var items = [];
			var stock = {};
			var stocksum = {};

			for (var i = 0, length = model.items.length; i < length; i++) {

				var item = model.items[i];
				var product = response.findItem('id', item.id);

				// Missing product in DB
				if (product == null) {
					$.error.push('error-products-404', item.name);
					continue;
				}

				var price = product.prices.findItem('id', item.idvariant);
				if (price === null) {
					$.error.push('error-products-404', item.name);
					continue;
				}

				if (item.count > product.stock) {
					$.error.push('error-products-stock', RESOURCE($.language, 'error-orders-stock').format(price.name ? ('[' + price.name + '] ' + item.name) : item.name, product.stock));
					continue;
				}

				// Because same product can be ordered multiple times with additional size or color
				product.stock -= item.count;
				price.stock -= item.count;

				// Because of sizes and colors
				if (price.name)
					item.name = '[' + price.name + '] ' + product.name;

				item.reference = product.reference;
				item.price = price.price;

				if (discount)
					item.price = item.price.discount(discount);

				model.price += item.price * item.count;
				model.count += item.count;

				// Deducts from variants stock
				if (stock[price.id])
					stock[price.id] += item.count;
				else
					stock[price.id] = item.count;

				// Deducts from the global stock
				if (stocksum[item.id])
					stocksum[item.id] += item.count;
				else
					stocksum[item.id] = item.count;

				// Stats for each ordered item
				counter.hit(item.id, item.count);
				counter.hit(price.id, item.count);

				// Add to list of ordered products
				items.push(item);
			}

			if ($.error.hasError()) {
				$.callback();
				return;
			}

			model.items = items;
			model.id = UID();
			model.discount = discount;
			model.datecreated = F.datetime;
			model.number = createNumber(db);
			model.ip = $.ip;
			model.language = $.language;
			model.iduser = $.user ? $.user.id : '';
			model.name = model.iscompany ? model.company : (model.lastname + ' ' + model.firstname);
			model.statushistory = [{ date: F.datetime, status: model.status }];

			// Updates stock
			NOSQL('products').modify({ prices: function(val) {
				for (var i = 0; i < val.length; i++) {
					var price = val[i];
					if (stock[price.id])
						price.stock -= stock[price.id];
				}
				return val;
			}, stock: function(val, doc) {
				return val - stocksum[doc.id];
			}}).in('id', options.id).log('Update stock, order #: ' + model.id, model.name + ' (customer)');

			// Writes stats
			counter.hit('all');

			// Stats of user orders
			model.iduser && NOSQL('users').counter.hit('order' + model.iduser);

			if (model.isnewsletter) {
				var subscriber = CREATE('Subscriber');
				subscriber.email = model.email;
				subscriber.$controller($.controller);
				subscriber.$save();
			}

			// Cleans unnecessary properties
			model.isnewsletter = undefined;
			model.isemail = undefined;
			model.isterms = undefined;

			// Inserts order into the database
			db.insert(model);
			$.success(true, model.id);

			EMIT('orders.save', model);

			// Sends email
			var mail = MAIL(model.email, '@(Order #) ' + model.id, '=?/mails/order', model, model.language);
			F.global.config.emailorderform && mail.bcc(F.global.config.emailorderform);

			ADMIN.notify({ type: 'orders.create', message: model.name + ', ' + model.price.format(2) });
		});
	});

	// Gets a specific order
	schema.setGet(function($) {
		NOSQL('orders').one().where('id', $.options.id || $.id).callback($.callback, 'error-orders-404');
	});

	// Removes order from DB
	schema.setRemove(function($) {
		var id = $.body.id;
		var user = $.user.name;
		NOSQL('orders').remove().backup(user).log('Remove: ' + id, user).where('id', id).callback(() => $.success());
	});

	schema.addWorkflow('toggle', function($) {

		var user = $.user.name;
		var arr = $.options.id ? $.options.id : $.query.id.split(',');
		var upd = {};
		var log;

		switch ($.options.type || $.query.type) {
			case 'completed':
				log = 'Completed';
				upd.isfinished = true;
				upd.datefinished = F.datetime;
				break;
			case 'paid':
				log = 'Paid';
				upd.ispaid = true;
				upd.datepaid = F.datetime;
				break;
		}

		if (log)
			NOSQL('orders').modify(upd).log(log + ': ' + arr.join(', '), user).in('id', arr).callback(() => $.success());
		else
			$.success();
	});

	// Clears DB
	schema.addWorkflow('clear', function($) {
		var user = $.user.name;
		NOSQL('orders').remove().backup(user).log('Clear all orders', user).callback(() => $.success());
	});

	// Stats
	schema.addWorkflow('stats', function(error, model, options, callback) {
		NOSQL('orders').counter.monthly('all', callback);
	});

	schema.addWorkflow('dependencies', function($) {
		var obj = {};
		obj.paymenttypes = F.global.config.paymenttypes;
		obj.deliverytypes = F.global.config.deliverytypes;
		$.callback(obj);
	});

	// Gets some stats from orders for Dashboard
	schema.addOperation('dashboard', function(error, model, options, callback) {

		var stats = {};

		stats.completed = 0;
		stats.completed_price = 0;
		stats.pending = 0;
		stats.pending_price = 0;

		var prepare = function(doc) {
			if (doc.isfinished) {
				stats.completed++;
				stats.completed_price += doc.price;
			} else {
				stats.pending++;
				stats.pending_price += doc.price;
			}
		};

		// Returns data for dashboard
		NOSQL('orders').find().prepare(prepare).callback(() => callback(stats));
	});

	// Sets the payment status to paid
	schema.addWorkflow('paid', function($) {
		NOSQL('orders').modify({ ispaid: true, datepaid: F.datetime }).where('ispaid', false).where('id', $.id || $.options.id).callback((err, count) => $.success(count > 0));
	});
});

function createNumber(nosql) {
	var year = F.datetime.getFullYear();
	var key = 'numbering' + year;
	var number = (nosql.get(key) || 0) + 1;
	nosql.set(key, number);
	return (year + '000001').parseInt() + number;
}