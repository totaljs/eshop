const REG_URL = /href="\/|src="\//g;

F.global.newsletter = { id: null, sending: false, percentage: 0 };

NEWSCHEMA('Newsletter').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('template', 'String(50)', true);
	schema.define('name', 'String(80)', true);
	schema.define('search', 'String(1000)', true);
	schema.define('body', String);
	schema.define('send', Boolean);
	schema.define('widgets', '[Object]');

	// Gets listing
	schema.setQuery(function($) {

		var opt = $.options === EMPTYOBJECT ? $.query : {};
		var filter = NOSQL('newsletters').find();

		filter.paginate(opt.page, opt.limit, 70);
		opt.name && filter.adminFilter('name', opt, String);
		opt.count && filter.adminFilter('count', opt, Number);
		opt.datecreated && filter.adminFilter('datecreated', opt, Date);

		filter.fields('id', 'name', 'count', 'issent', 'datecreated');

		if (opt.sort)
			filter.adminSort(opt.sort);
		else
			filter.sort('datecreated', true);

		filter.callback((err, docs, count) => $.callback(filter.adminOutput(docs, count)));
	});

	// Gets a specific post
	schema.setGet(function($) {
		var filter = NOSQL('newsletters').one();
		$.options.id && filter.where('id', $.options.id);
		filter.callback($.callback);
	});

	// Removes a specific post
	schema.setRemove(function($) {
		var id = $.body.id;
		var user = $.user.name;
		NOSQL('newsletters').remove().backup(user).log('Remove: ' + id, user).where('id', id).callback(() => $.success());
	});

	// Saves the post into the database
	schema.setSave(function($) {

		var model = $.model.$clean();
		var user = $.user.name;
		var isUpdate = !!model.id;
		var nosql = NOSQL('newsletters');

		if (isUpdate) {
			model.dateupdated = F.datetime;
			model.adminupdated = user;
		} else {
			model.id = UID();
			model.admincreated = user;
			model.datecreated = F.datetime;
			model.count = 0;
		}

		!model.datecreated && (model.datecreated = F.datetime);
		model.linker = model.datecreated.format('yyyyMMdd') + '-' + model.name.slug();

		model.search = ((model.name || '') + ' ' + (model.search || '')).keywords(true, true).join(' ').max(1000);
		model.body = U.minifyHTML(model.body);

		var db = isUpdate ? nosql.modify(model).where('id', model.id).backup(user).log('Update: ' + model.id, user) : nosql.insert(model).log('Create: ' + model.id, user);

		db.callback(function() {
			ADMIN.notify({ type: 'newsletters.save', message: model.name });
			EMIT('newsletter.save', model);
			if ($.model.send)
				$.model.$workflow('send', $.callback);
			else
				$.success();
		});
	});

	// Clears database
	schema.addWorkflow('clear', function($) {
		NOSQL('newsletters').remove().callback(NOOP);
		$.success();
	});

	schema.addWorkflow('stats', function($) {
		NOSQL('newsletters').counter.monthly($.id || $.options.id || 'all', $.callback);
	});

	schema.addWorkflow('test', function($) {

		var newsletter = $.model.$clean();
		var repository = {};

		newsletter.body.CMSrender(newsletter.widgets, function(body) {

			repository.page = {};
			repository.page.body = body;
			repository.page.id = newsletter.id;
			repository.page.name = newsletter.name;
			repository.preview = false;
			newsletter.body = F.view('~/cms/' + newsletter.template, null, repository);
			newsletter.unsubscribe = F.global.config.url + '/api/unsubscribe/?email=';

			var message = new Mail.Message(newsletter.name, prepare_urladdress(newsletter.body.replace('@@@', $.query.email)));
			message.to($.query.email);
			message.from(F.global.config.emailsender, F.config.name);
			message.reply(F.global.config.emailreply);
			message.unsubscribe(newsletter.unsubscribe + $.query.email);
			message.callback = internal_notvalidaddress;
			Mail.send2(message);
			$.success();
		}, $.controller);

	});

	schema.addWorkflow('send', function($) {

		if (F.global.newsletter.sending) {
			$.invalid().push('error-newsletter-sending');
			return;
		}

		var newsletter = $.model.$clean();

		F.global.newsletter.sending = true;
		F.global.newsletter.percentage = 0;
		F.global.newsletter.id = $.model.id;

		$.success();

		newsletter.body.CMSrender(newsletter.widgets, function(body) {

			var repository = {};

			repository.page = {};
			repository.page.body = body;
			repository.page.id = newsletter.id;
			repository.page.name = newsletter.name;
			repository.preview = false;

			newsletter.body = F.view('~/cms/' + newsletter.template, null, repository);
			newsletter.unsubscribe = F.global.config.url + '/api/unsubscribe/?email=';

			NOSQL('subscribers').find().where('unsubscribed', false).callback(function(err, response) {

				var count = response.length;
				var sum = 0;

				response.limit(10, function(items, next) {

					var messages = [];

					for (var i = 0, length = items.length; i < length; i++) {
						var message = new Mail.Message(newsletter.name, prepare_urladdress(newsletter.body.replace('@@@', items[i].email)));
						message.to(items[i].email);
						message.from(F.global.config.emailsender, F.config.name);
						message.reply(F.global.config.emailreply);
						message.unsubscribe(newsletter.unsubscribe + items[i].email);
						message.callback = internal_notvalidaddress;
						messages.push(message);
					}

					sum += items.length;
					F.global.newsletter.percentage = ((sum / count) * 100) >> 0;
					ADMIN.notify({ type: 'newsletters.percentage', message: F.global.newsletter.percentage + '' });

					// Sends email
					// Each 100 email waits 1 minute ....
					if (sum % 100 === 0)
						setTimeout(() => Mail.send2(messages, next), 60000);
					else
						Mail.send2(messages, () => setTimeout(next, 2000));

				}, function() {

					ADMIN.notify({ type: 'newsletters.sent', message: repository.page.name });
					NOSQL('newsletters').modify({ count: count, datesent: F.datetime }).where('id', F.global.newsletter.id);

					F.global.newsletter.sending = false;
					F.global.newsletter.percentage = 0;
					F.global.newsletter.id = null;

				});
			});

		}, $.controller);
	});
});

function prepare_urladdress(body) {
	return body.replace(REG_URL, (text) => text[0] === 'h' ? ('href="' + F.global.config.url + '/') : ('src="' + F.global.config.url + '/'));
}

function internal_notvalidaddress(err, message) {
	if (err)
		console.log('---> problem in email', message.addressTo);
}
