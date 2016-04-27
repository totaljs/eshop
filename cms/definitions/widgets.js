// ====================================================
// Widget transformations
// ====================================================

// Blogs
// d5467a1697 is Widget ID
GETSCHEMA('Widget').addTransform('d5467a1697', function(error, model, data, callback) {
	// data.settings
	// data.page
	// data.controller
	var options = {};
	options.max = data.settings || '5';
	GETSCHEMA('Post').query(options, (err, response) => callback(F.view('partial-blogs', response)));
});

// Contact form
// 23cee236ba is Widget ID
GETSCHEMA('Widget').addTransform('23cee236ba', function(error, model, data, callback) {

	// data.settings
	// data.page
	// data.controller

	callback(F.view('widgets/contactform'));
});