NEWSCHEMA('Contact').make(function(schema) {

	schema.define('id', 'String(10)');
	schema.define('firstname', 'String(40)', true);
	schema.define('lastname', 'String(40)', true);
	schema.define('email', 'String(200)', true);
	schema.define('message', String, true);
	schema.define('phone', 'String(20)');
	schema.define('language', 'String(3)');
	schema.define('ip', 'String(80)');
	schema.define('datecreated', Date);

	// Saves the model into the database
	schema.setSave(function(error, model, options, callback) {

		// Default values
		model.id = U.GUID(10);
		model.datecreated = new Date();

		// Saves to database
		var sql = DB();
		sql.insert('tbl_contactform').set(model);
		sql.exec(F.error());

		F.emit('contact.save', model);

		// Returns response
		callback(SUCCESS(true));

		// Writes stats
		MODULE('webcounter').increment('contactforms');

		// Sends email
		var mail = F.mail(F.config.custom.emailcontactform, 'Contact form # ' + model.id, '=?/mails/contact', model, model.language);
		mail.reply(model.email, true);
	});

});