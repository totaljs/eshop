// ====================================================
// Widget transformations
// ====================================================

GETSCHEMA('Widget').addTransform('Blogs', function(error, model, data, callback) {

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
		callback(F.view('~widgets/blogs', docs));
	});
});

GETSCHEMA('Widget').addTransform('Contact form', function(error, model, data, callback) {
	callback(F.view('~widgets/contactform'));
});