// ====== Supported operations:
// "dashboard"  - gets stats

// ====== Supported workflows:
// "create"     - creates an order
// "paid"       - sets ispaid to true
// "clear"      - removes all orders

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
	schema.define('delivery', 'String(50)', true);
	schema.define('payment', 'String(50)', true);
	schema.define('firstname', 'Capitalize(40)', true);
	schema.define('lastname', 'Capitalize(40)', true);
	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone', true);
	schema.define('message', 'String(500)');
	schema.define('note', 'String(500)');
	schema.define('language', 'Lower(2)');
	schema.define('reference', 'String(10)');
	schema.define('trackingcode', 'String(50)');
	schema.define('price', Number);
	schema.define('count', Number);
	schema.define('products', '[OrderItem]', true);

	schema.define('company', 'String(40)');
	schema.define('companyid', 'String(15)');
	schema.define('companyvat', 'String(30)');

	schema.define('billingstreet', 'String(30)', true);
	schema.define('billingnumber', 'String(15)', true);
	schema.define('billingzip', 'Zip', true);
	schema.define('billingcity', 'String(30)', true);
	schema.define('billingcountry', 'String(30)', true);

	schema.define('deliveryfirstname', 'String(30)');
	schema.define('deliverylastname', 'String(30)');
	schema.define('deliverystreet', 'String(30)');
	schema.define('deliverynumber', 'String(15)');
	schema.define('deliveryzip', 'Zip');
	schema.define('deliverycity', 'String(30)');
	schema.define('deliverycountry', 'String(30)');
	schema.define('deliveryphone', 'Phone');

	schema.define('ispaid', Boolean);
	schema.define('iscompany', Boolean);
	schema.define('isemail', Boolean);
	schema.define('iscompleted', Boolean);
	schema.define('isnewsletter', Boolean);

	schema.define('datecreated', Date);

	// Sets default values
	schema.setDefault(function(name) {
		switch (name) {
			case 'status':
				return F.config.custom.defaultorderstatus;
		}
	});

	// Gets listing
	schema.setQuery(function(error, options, callback) {

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

		var filter = NOSQL('orders').find();

		if (type === 1)
			filter.where('iscompleted', false); // Uncompleted
		else if (type === 2)
			filter.where('iscompleted', false).where('ispaid', false); // Uncompleted and not paid
		else if (type === 3)
			filter.where('iscompleted', false).where('ispaid', true); // Uncompleted and paid
		else if (type === 4)
			filter.where('iscompleted', true); // Uncompleted and paid

		options.iduser && filter.where('iduser', options.iduser);
		options.search && filter.like('search', options.search.keywords(true, true));

		filter.skip(skip);
		filter.take(take);
		filter.sort('datecreated', true);
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

	// Creates order
	schema.addWorkflow('create', function(error, model, options, callback, controller) {

		var db = NOSQL('orders');
		var counter = db.counter;
		var price = 0;
		var count = 0;

		for (var i = 0, length = model.products.length; i < length; i++) {
			var product = model.products[i];
			price += product.price * product.count;
			count += product.count;

			// Stats for ordered products
			counter.hit(product.id, product.count);
		}

		model.id = UID();
		model.price = price;
		model.count = count;
		model.datecreated = F.datetime;
		model.numbering = db.meta('numbering');

		if (controller) {
			model.ip = controller.ip;
			model.language = controller.language;
			model.iduser = controller.user ? controller.user.id : '';
		}

		counter.hit('all');

		if (model.numbering) {
			var year = model.numbering.toString().substring(0, 4);

			// Validates current year with latest "numbering"
			if (year.parseInt() === F.datetime.getFullYear())
				model.numbering++;
			else
				model.numbering = createNumbering();

		} else
			model.numbering = createNumbering();

		db.meta('numbering', model.numbering);

		if (model.isnewsletter) {
			var newsletter = CREATE('Newsletter');
			newsletter.email = model.email;
			newsletter.ip = model.ip;
			newsletter.$save();
		}

		// Cleans unnecessary properties
		model.isnewsletter = undefined;
		model.isemail = undefined;

		// Inserts order into the database
		db.insert(model);

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
		NOSQL('orders').one().where('id', options.id).callback(callback, 'error-404-order');
	});

	// Saves the order into the database
	schema.setSave(function(error, model, controller, callback) {

		var isemail = model.isemail;

		// Cleans unnecessary properties
		model.isnewsletter = undefined;
		model.isemail = undefined;

		if (model.iscompleted && !model.datecompleted)
			model.datecompleted = F.datetime;

		if (model.ispaid && !model.datepaid)
			model.datepaid = F.datetime;

		model.search = (model.id + ' ' + (model.reference || '') + ' ' + model.firstname + ' ' + model.lastname + ' ' + model.email).keywords(true, true).join(' ').max(500);
		model.adminupdated = controller.user.name;
		model.dateupdated = F.datetime;

		// Update order in database
		NOSQL('orders').modify(model).where('id', model.id).callback(function(err, count) {

			// Returns response
			callback(SUCCESS(true));

			if (!count)
				return;

			F.emit('orders.save', model);
			model.datebackup = F.datetime;
			NOSQL('orders_backup').insert(model);
		});

		if (!isemail)
			return;

		// Sends email
		var mail = F.mail(model.email, '@(Order (update) #) ' + model.id, '=?/mails/order-status', model, model.language || '');
		mail.bcc(F.config.custom.emailorderform);
	});

	// Removes order from DB
	schema.setRemove(function(error, id, callback) {
		NOSQL('orders').remove(F.path.databases('orders_removed.nosql')).where('id', id).callback(callback);
	});

	// Clears DB
	schema.addWorkflow('clear', function(error, model, options, callback) {
		NOSQL('orders').remove(F.path.databases('orders_removed.nosql'));
		callback(SUCCESS(true));
	});

	// Stats
	schema.addWorkflow('stats', function(error, model, options, callback) {
		NOSQL('orders').counter.monthly('all', callback);
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
		NOSQL('orders').find().prepare(prepare).callback(() => callback(stats));
	});

	// Sets the payment status to paid
	schema.addWorkflow('paid', function(error, model, id, callback) {
		NOSQL('orders').modify({ ispaid: true, datepaid: F.datetime }).where('id', id).callback(callback);
	});
});

function createNumbering() {
	return (F.datetime.getFullYear() + '000001').parseInt();
}
