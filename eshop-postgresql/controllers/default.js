exports.install = function() {
	// COMMON
	F.route('/', view_homepage);
	F.route('#contact', view_contact);

	// CMS rendering
	F.route('/*', view_page);

	// FILES
	F.file('/images/small/*.jpg', file_image);
	F.file('/images/large/*.jpg', file_image);
	F.file('/download/', file_read);
};

// ==========================================================================
// COMMON
// ==========================================================================

// Homepage
function view_homepage() {
	var self = this;

	// Increases the performance (1 minute cache)
	self.memorize('cache.homepage', '1 minute', DEBUG, function() {
		var options = {};
		options.max = 12;
		options.homepage = true;
		GETSCHEMA('Product').query(options, function(err, response) {
			// Finds "homepage"
			self.page('/', 'index', response, false, true);
		});
	});
}

// Contact with contact form
function view_contact() {
	var self = this;
	self.render(self.url, 'contact');
}

// ==========================================================================
// CMS (Content Management System)
// ==========================================================================

function view_page() {
	var self = this;
	// models/pages.js --> Controller.prototype.render()
	self.render(self.url);
}

// ==========================================================================
// FILES
// ==========================================================================

// Reads a specific file from database
// For images (jpg, gif, png) supports percentual resizing according "?s=NUMBER" argument in query string e.g.: .jpg?s=50, .jpg?s=80 (for image galleries)
// URL: /download/*.*
function file_read(req, res) {

	var arr = req.split[1].replace('.' + req.extension, '').split('x');
	var id = arr[0];
	var count = 0;

	// Simple prevention for DDOS querying
	for (var i = 0, length = id.length; i < length; i++)
		count += id.charCodeAt(i);

	if (count.toString() !== arr[1]) {
		res.throw404();
		return;
	}

	// Custom image resizing
	var size;

	// Small hack for the file cache.
	// F.exists() uses req.uri.pathname for creating temp identificator and skips all query strings by creating (because this hack).
	if (req.query.s) {
		size = req.query.s.parseInt();
		req.uri.pathname = req.uri.pathname.replace('.', size + '.');
	}

	// Below method checks if the file exists (processed) in temporary directory
	// More information in total.js documentation
	F.exists(req, res, 10, function(next, filename) {

		var sql = DB();
		sql.readStream(id, function(err, stream, size) {

			if (err || !size) {
				next();
				return res.throw404();
			}

			var writer = require('fs').createWriteStream(filename);

			CLEANUP(writer, function() {

				var resize = req.query.s && (req.extension === 'jpg' || req.extension === 'gif' || req.extension === 'png') ? true : false;
				if (!resize) {
					res.file(filename, null, null, next);
					return;
				}

				res.image(filename, function(image) {
					image.output(req.extension);
					req.extension === 'jpg' && image.quality(85);
					size && image.resize(size + '%');
					image.minify();
				}, undefined, next);
			});

			stream.pipe(writer);
		});
	});
}

// Reads specific picture from database
// URL: /images/small|large/*.jpg
function file_image(req, res) {
	var arr = req.split[2].replace('.' + req.extension, '').split('x');
	var id = arr[0];
	var count = 0;

	// Simple prevention for DDOS querying
	for (var i = 0, length = id.length; i < length; i++)
		count += id.charCodeAt(i);

	if (count.toString() !== arr[1]) {
		res.throw404();
		return;
	}

	// Below method checks if the file exists (processed) in temporary directory
	// More information in total.js documentation
	F.exists(req, res, 10, function(next, filename) {

		var sql = DB();
		sql.readStream(id, function(err, stream, size) {

			if (err || !size) {
				next();
				return res.throw404();
			}

			var writer = require('fs').createWriteStream(filename);

			CLEANUP(writer, function() {
				res.image(filename, function(image) {
					image.output('jpg');
					image.quality(90);

					if (req.split[1] === 'large')
						image.miniature(600, 400);
					else
						image.miniature(200, 150);

					image.minify();
				}, undefined, next);
			});

			stream.pipe(writer);
		});
	});
}