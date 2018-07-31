exports.install = function() {
	// Enable CORS for API
	CORS('/api/*', ['get', 'post', 'put', 'delete'], true);

	// Operations
	ROUTE('/api/subscribers/',              ['*Subscriber --> save', 'post']);
	ROUTE('/api/unsubscribe/', unsubscribe, ['*Subscriber']);
	ROUTE('/api/contact/',                  ['*Contact --> save', 'post']);

	// Eshop
	ROUTE('/api/products/',                 ['*Product --> query']);
	ROUTE('/api/products/prices/',          ['*Product --> prices']);
	ROUTE('/api/products/search/',          ['*Product --> search']);
	ROUTE('/api/orders/create/',            ['*Order --> create', 'post']);
	ROUTE('/api/orders/dependencies/',      ['*Order --> dependencies']);

	// Account
	ROUTE('/api/account/create/',           ['*UserCreate --> save', 'post']);
	ROUTE('/api/account/login/',            ['*UserLogin --> exec', 'post']);
	ROUTE('/api/account/orders/',           ['*UserOrder --> query', 'authorize']);
	ROUTE('/api/account/autofill/',         ['*UserOrder --> read', 'authorize']);
	ROUTE('/api/account/settings/',         ['*UserSettings --> read', 'authorize']);
	ROUTE('/api/account/settings/',         ['*UserSettings --> save', 'post', 'authorize']);
	ROUTE('/api/account/password/',         ['*UserPassword --> exec', 'post', 'unauthorize']);

	// Newsletter view
	FILE('/newsletter.gif', file_newsletterviewstats);
};

function file_newsletterviewstats(req, res) {
	NOSQL('newsletters').counter.hit('all');
	req.query.id && NOSQL('newsletters').counter.hit(req.query.id);
	res.binary('R0lGODdhAQABAIAAAAAAAAAAACH5BAEAAAEALAAAAAABAAEAAAICTAEAOw==', 'image/gif', 'base64');
}

function unsubscribe() {
	var self = this;
	self.$workflow('unsubscribe', () => self.plain(TRANSLATOR(self.language, '@(You have been successfully unsubscribed.\nThank you)')));
}