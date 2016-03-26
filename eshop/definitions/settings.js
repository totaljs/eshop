// Reads custom settings
GETSCHEMA('Settings').workflow2('load');

// Disables analytic counter for administraion / manager
MODULE('webcounter').instance.onValid = function(req) {
	return !req.url.startsWith(CONFIG('manager-url'));
};

// Global static variables (default values)
F.global.sitemap = [];
F.global.navigations = [];
F.global.categories = [];
F.global.posts = [];