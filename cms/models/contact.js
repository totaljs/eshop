NEWSCHEMA('Contact').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('firstname', 'Capitalize(40)', true);
	schema.define('lastname', 'Capitalize(40)', true);
	schema.define('email', 'Email', true);
	schema.define('message', String, true);
	schema.define('phone', 'Phone');
	schema.define('language', 'Lower(3)');
	schema.define('ip', 'String(80)');
	schema.define('datecreated', Date);

	// Sets default values
	schema.setDefault(function(name) {
		switch (name) {
			case 'id':
				return UID();
			case 'datecreated':
				return new Date();
		}
	});

	// Saves the model into the database
	schema.setSave(function(error, model, options, callback) {

		// Saves to database
		DB('contactforms').insert(model.$clean());

		F.emit('contact.save', model);

		// Returns response
		callback(SUCCESS(true));

		// Writes stats
		MODULE('webcounter').increment('contactforms');

		// Sends email
		var mail = F.mail(F.config.custom.emailcontactform, '@(Contact form #) ' + model.id, '=?/mails/contact', model, model.language || '');
		mail.reply(model.email, true);
	});
});