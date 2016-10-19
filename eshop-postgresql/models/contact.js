NEWSCHEMA('Contact').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('firstname', 'Camelize(40)', true);
	schema.define('lastname', 'Camelize(40)', true);
	schema.define('email', 'Email', true);
	schema.define('message', String, true);
	schema.define('phone', 'Phone');
	schema.define('language', 'Lower(2)');
	schema.define('ip', 'String(80)');

	// Saves the model into the database
	schema.setSave(function(error, model, options, callback) {

		// Default values
		model.id = UID();
		model.datecreated = F.datetime;

		// Saves to database
		var sql = DB();
		sql.insert('tbl_contactform').set(model);
		sql.exec(F.error());

		F.emit('contact.save', model);
		callback(SUCCESS(true));

		// Writes stats
		MODULE('webcounter').increment('contactforms');

		// Sends email
		var mail = F.mail(F.config.custom.emailcontactform, '@(Contact form #) ' + model.id, '=?/mails/contact', model, model.language || '');
		mail.reply(model.email, true);
	});

});