// ====================================================
// Widget transformations
// ====================================================

// Blogs
// d5467a1697 is Widget ID
GETSCHEMA('Widget').addTransform('d5467a1697', function(error, model, data, callback) {

	// data.settings
	// data.page
	// data.controller

	var prepare = function(doc) {
		if (!doc.navigations)
			return;
		if (doc.navigations.indexOf('blogs') === -1)
			return;
		return { title: doc.title, url: doc.url, perex: doc.perex, datecreated: Date.parse(doc.datecreated), pictures: doc.pictures };
	};

	var sort = function(a, b) {
		if (a.datecreated > b.datecreated)
			return -1;
		return 1;
	};

	DB('pages').sort(prepare, sort, function(err, docs) {
		if (err)
			return callback('');

		var model = {};
		model.max = U.parseInt(data.settings, 5);
		model.items = docs;
		callback(F.view('widgets/blogs', model));
	});
});

// Contact form
// 23cee236ba is Widget ID
GETSCHEMA('Widget').addTransform('23cee236ba', function(error, model, data, callback) {

	// data.settings
	// data.page
	// data.controller

	callback(F.view('widgets/contactform'));
});