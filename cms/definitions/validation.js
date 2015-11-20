// All models use this validation delegate
F.onValidate = function(name, value) {
	switch (name) {
		// common
		case 'email':

		// settings
		case 'emailcontactform':
		case 'emailreply':
		case 'emailsender':
			return value.isEmail();

		case 'firstname':
		case 'lastname':
		case 'id':
			return value.length > 0;
	}
};