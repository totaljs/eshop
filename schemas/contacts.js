NEWSCHEMA('Contact').make(function(schema) {

	schema.define('firstname', 'Camelize(40)', true);
	schema.define('lastname', 'Camelize(40)', true);
	schema.define('email', 'Email', true);
	schema.define('body', String, true);
	schema.define('phone', 'Phone');

	schema.setSave(function($) {

		var model = $.model;
		model.id = UID();
		model.ip = $.ip;
		model.datecreated = F.datetime;

		var nosql = NOSQL('contactforms');
		nosql.insert(model.$clean());
		nosql.counter.hit('all');

		$.success();

		EMIT('contacts.save', model);
		ADMIN.notify({ type: 'contacts.create', message: model.firstname + ' ' + model.lastname });

		// Sends email
		MAIL(F.global.config.emailcontactform, '@(Contact form #{0})'.format(model.id), '=?/mails/contact', model, $.language).reply(model.email, true);
	});

	// Stats
	schema.addWorkflow('stats', function($) {
		NOSQL('contactforms').counter.monthly('all', $.callback);
	});
});