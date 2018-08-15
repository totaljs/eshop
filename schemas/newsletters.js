const REG_URL = /href="\/|src="\//g;

G.newsletter = { id: null, sending: false, percentage: 0 };

NEWSCHEMA('Newsletter').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('template', 'String(50)', true);
	schema.define('name', 'String(80)', true);
	schema.define('search', 'String(1000)', true);
	schema.define('body', String);
	schema.define('send', Boolean);
	schema.define('limit', Number);
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
		var id = $.options.id || $.id;
		var filter = NOSQL('newsletters').one();
		filter.where('id', id);
		filter.callback(function(err, response) {

			if (err) {
				$.callback();
				return;
			}

			F.functions.read('newsletters', response.id, function(err, body) {
				response.body = body;
				$.callback(response);
			});

		}, 'error-newsletter-404');
	});

	// Removes a specific post
	schema.setRemove(function($) {
		var id = $.body.id;
		var user = $.user.name;
		F.functions.remove('newsletters', id);
		NOSQL('newsletters').remove().backup(user).log('Remove: ' + id, user).where('id', id).callback(() => $.success());
		NOSQL('parts').remove().where('idowner', id).where('type', 'newsletter');
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

		var body = U.minifyHTML(model.body);
		!model.datecreated && (model.datecreated = F.datetime);
		model.stamp = model.stamp = new Date().format('yyyyMMddHHmm');
		model.linker = model.datecreated.format('yyyyMMdd') + '-' + model.name.slug();
		model.search = ((model.name || '') + ' ' + (model.search || '')).keywords(true, true).join(' ').max(1000);

		F.functions.write('newsletters', model.id + '_' + model.stamp, body); // backup
		F.functions.write('newsletters', model.id, body, isUpdate);

		model.body = undefined;

		var db = isUpdate ? nosql.modify(model).where('id', model.id).backup(user).log('Update: ' + model.id, user) : nosql.insert(model).log('Create: ' + model.id, user);

		db.callback(function() {
			ADMIN.notify({ type: 'newsletters.save', message: model.name });
			EMIT('newsletter.save', model);
			if ($.model.send) {
				$.model.body = body;
				$.model.$workflow('send', $.callback);
			} else
				$.success(model.id);
		});
	});

	// Clears database
	schema.addWorkflow('clear', function($) {
		F.functions.remove('newsletters');
		NOSQL('newsletters').remove().callback(NOOP);
		$.success();
	});

	schema.addWorkflow('stats', function($) {
		NOSQL('newsletters').counter.monthly($.id || $.options.id || 'all', $.callback);
	});

	schema.addWorkflow('test', function($) {

		var newsletter = $.model.$clean();

		newsletter.body.CMSrender(newsletter.widgets, function(body) {

			var repository = {};
			repository.page = {};
			repository.page.id = newsletter.id;
			repository.page.name = newsletter.name;
			repository.page.body = body;
			repository.preview = false;
			newsletter.body = F.view('~/cms/' + newsletter.template, null, repository);
			newsletter.unsubscribe = G.config.url + '/api/unsubscribe/?email=';

			var message = new Mail.Message(newsletter.name, prepare_urladdress(newsletter.body.replace('@@@', $.query.email)));
			message.to($.query.email);
			message.from(G.config.emailsender, F.config.name);
			message.reply(G.config.emailreply);
			message.unsubscribe(newsletter.unsubscribe + $.query.email);
			message.callback = internal_notvalidaddress;
			Mail.send2(message);
			$.success();
		}, $.controller);

	});

	schema.addWorkflow('send', function($) {

		if (G.newsletter.sending) {
			$.invalid().push('error-newsletter-sending');
			return;
		}

		var newsletter = $.model.$clean();

		G.newsletter.sending = true;
		G.newsletter.percentage = 0;
		G.newsletter.id = $.model.id;

		$.success();

		newsletter.body.CMSrender(newsletter.widgets, function(body) {

			var repository = {};
			var cache = F.cache.get2('newsletters');

			repository.page = {};
			repository.page.id = newsletter.id;
			repository.page.name = newsletter.name;
			repository.preview = false;
			repository.page.body = body;

			newsletter.body = F.view('~/cms/' + newsletter.template, null, repository);
			newsletter.unsubscribe = G.config.url + '/api/unsubscribe/?email=';

			NOSQL('subscribers').find().where('unsubscribed', false).skip(cache ? cache.count : 0).callback(function(err, response) {

				var count = response.length;
				var sum = cache ? cache.count : 0;
				var old = 0;

				response.limit(10, function(items, next) {

					var messages = [];

					for (var i = 0, length = items.length; i < length; i++) {
						var message = new Mail.Message(newsletter.name, prepare_urladdress(newsletter.body.replace('@@@', items[i].email)));
						message.to(items[i].email);
						message.from(G.config.emailsender, F.config.name);
						message.reply(G.config.emailreply);
						message.unsubscribe(newsletter.unsubscribe + items[i].email);
						message.callback = internal_notvalidaddress;
						messages.push(message);
					}

					sum += items.length;
					G.newsletter.percentage = ((sum / count) * 100) >> 0;

					// Updates cache
					F.cache.set2('newsletters', { id: G.newsletter.id, count: sum }, '5 days');

					if (G.newsletter.percentage !== old)
						ADMIN.notify({ type: 'newsletters.percentage', message: G.newsletter.percentage + '' });

					old = G.newsletter.percentage;

					// Sends email
					if (sum % newsletter.limit === 0) {
						// Each "limit" it waits 24 hours
						setTimeout(() => Mail.send2(messages, next), 60000 * 1440);
					} else if (sum % 100 === 0) {

						// Each 100 email waits 1 minute ....
						setTimeout(() => Mail.send2(messages, next), 60000);

						// Updates DB
						NOSQL('newsletters').modify({ count: sum, datesent: F.datetime }).first().where('id', G.newsletter.id);

					} else
						Mail.send2(messages, () => setTimeout(next, 2000));

				}, function() {
					F.cache.remove('newsletters');
					ADMIN.notify({ type: 'newsletters.sent', message: repository.page.name });
					NOSQL('newsletters').modify({ count: sum, datesent: F.datetime }).first().where('id', G.newsletter.id);
					G.newsletter.sending = false;
					G.newsletter.percentage = 0;
					G.newsletter.id = null;

				});
			});

		}, $.controller);
	});

	// Loads unset newlsetter
	var cache = F.cache.get2('newsletters');
	if (cache) {
		setTimeout(function() {
			schema.get({ id: cache.id }, function(err, response) {
				if (response)
					schema.workflow('send', response);
				else
					F.cache.remove('newsletters');
			});
		}, 5000);
	}
});

function prepare_urladdress(body) {
	return body.replace(REG_URL, (text) => text[0] === 'h' ? ('href="' + G.config.url + '/') : ('src="' + G.config.url + '/'));
}

function internal_notvalidaddress(err, message) {
	err && console.log('Newsletter error:', message.addressTo, err);
}
