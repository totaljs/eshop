NEWSCHEMA('Subscriber').make(function(schema) {

	schema.define('email', String, true);

	// Saves the model into the database
	schema.setSave(function($) {

		var model = $.model;
		var db = NOSQL('subscribers');
		var email = model.email.split(',');

		for (var i = 0; i < email.length; i++) {

			if (!email[i] || !email[i].isEmail())
				continue;

			var obj = {};
			obj.datecreated = F.datetime;
			obj.ip = $.ip;
			obj.language = $.language;
			obj.unsubscribed = false;
			obj.email = email[i];

			db.modify(obj, obj).where('email', obj.email).callback(function(err, count) {
				if (count) {
					if (email.length === 1)
						ADMIN.notify({ type: 'subscribers.save', message: obj.email });
					EMIT('subscribers.save', obj);
					db.counter.hit('all', 1);
				}
			});
		}

		$.success();
	});

	// Gets listing
	schema.setQuery(function($) {

		var opt = $.options === EMPTYOBJECT ? $.query : $.options;
		var filter = NOSQL('subscribers').find();

		filter.paginate(opt.page, opt.limit, 100);
		opt.email && filter.adminFilter('email', opt, String);
		opt.language && filter.adminFilter('language', opt, String);
		opt.datecreated && filter.adminFilter('datecreated', opt, Date);

		if (opt.sort)
			filter.adminSort(opt.sort);
		else
			filter.sort('datecreated', true);

		filter.callback((err, docs, count) => $.callback(filter.adminOutput(docs, count)));
	});
	// Removes user from DB
	schema.setRemove(function($) {
		var id = $.body.id;
		var user = $.user.name;
		NOSQL('subscribers').remove().backup(user).log('Remove: ' + id, user).where('email', id).callback(() => $.success());
	});

	// Performs download
	schema.addWorkflow('download', function($) {
		NOSQL('subscribers').find().fields('email').callback(function(err, response) {

			var builder = [];
			for (var i = 0, length = response.length; i < length; i++)
				builder.push('"' + response[i].email + '"');

			$.controller.content(builder.join('\n'), U.getContentType('csv'), { 'Content-Disposition': 'attachment; filename="subscribers.csv"' });
			$.callback();
		});
	});

	schema.addWorkflow('toggle', function($) {
		var user = $.user.name;
		var arr = $.options.id ? $.options.id : $.query.id.split(',');
		NOSQL('subscribers').update(function(doc) {
			doc.unsubscribed = !doc.unsubscribed;
			return doc;
		}).log('Toggle: ' + arr.join(', '), user).in('email', arr).callback(function() {
			$.success();
		});
	});

	schema.addWorkflow('unsubscribe', function($) {
		ADMIN.notify({ type: 'subscribers.unsubscribe', message: $.query.email });
		NOSQL('subscribers').modify({ unsubscribed: true, dateupdated: F.datetime }).where('email', $.query.email);
		$.success();
	});

	// Clears DB
	schema.addWorkflow('clear', function($) {
		var user = $.user.name;
		NOSQL('subscribers').remove().backup(user).log('Clear all subscribers', user);
		$.success();
	});

	schema.addWorkflow('stats', function($) {
		NOSQL('subscribers').counter.monthly('all', $.callback);
	});
});