// All models use this validation delegate
F.onValidation = function(name, value) {
	switch (name) {
		// common
		case 'email':

		// settings
		case 'emailcontactform':
		case 'emailorderform':
		case 'emailreply':
		case 'emailsender':
			return value.isEmail();

		case 'firstname':
		case 'lastname':
		case 'address':
		case 'delivery':
		case 'id':

		// settings
		case 'deliverytypes':
		case 'currency':
			return value.length > 0;
	}
};