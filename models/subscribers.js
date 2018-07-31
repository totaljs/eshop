NEWSCHEMA('Subscriber').make(function(schema) {

	schema.define('email', 'Email', true);
	schema.define('language' ,'String(2)');

	// Saves the model into the database
	schema.setSave(function($) {

		var model = $.model;

		model.datecreated = F.datetime;
		model.ip = $.ip;
		model.language = $.language;
		model.unsubscribed = false;

		var db = NOSQL('subscribers');

		db.modify(model, model).where('email', model.email).callback(function(err, count) {
			if (count) {
				ADMIN.notify({ type: 'subscribers.save', message: model.email });
				EMIT('subscribers.save', model);
				db.counter.hit('all', 1);
			}
		});

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