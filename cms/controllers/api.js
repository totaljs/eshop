// API for e.g. Mobile application
// This API uses the website

exports.install = function() {
	// NEWSLETTER
	F.route('/api/newsletter/',  json_newsletter, ['post', '*Newsletter']);

	// CONTACTFORM
	F.route('/api/contact/',     json_contact, ['post', '*Contact']);
};

// ==========================================================================
// NEWSLETTER
// ==========================================================================

// Appends a new email into the newsletter list
function json_newsletter() {
	var self = this;
	self.body.language = self.language || '';
	self.body.ip = self.ip;
	self.body.$save(self.callback());
}

// ==========================================================================
// CONTACTFORM
// ==========================================================================

// Processes the contact form
function json_contact() {
	var self = this;
	self.body.language = self.language || '';
	self.body.ip = self.ip;
	self.body.$save(self.callback());
}