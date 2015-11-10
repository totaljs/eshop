exports.install = function() {
	// CMS rendering through the 404
	F.route('#404', view_page);
	F.route('/test/');
	// F.route('/', 'test');

	// FILES
	F.file('Files', file_read);
};

// ==========================================================================
// COMMON
// ==========================================================================

// View homepage
function view_homepage() {
	var self = this;
	self.page(self.url);
}

// ==========================================================================
// CMS (Content Management System)
// ==========================================================================

function view_page() {
	var self = this;
	var key = (self.language ? self.language + ':' : '') + self.url;
	var page = F.global.sitemap[key];

	if (!page) {
		self.status = 404;
		self.plain(U.httpStatus(404, true));
		return;
	}

	self.page(self.url);
}

// ==========================================================================
// FILES
// ==========================================================================

// Reads a specific file from database
// For images (jpg, gif, png) supports percentual resizing according "?s=NUMBER" argument in query string e.g.: .jpg?s=50, .jpg?s=80 (for image galleries)
// URL: /download/*.*
function file_read(req, res, is) {

	if (is)
		return req.path[0] === 'download';

	var id = req.path[1].replace('.' + req.extension, '');
	var resize = req.query.s && (req.extension === 'jpg' || req.extension === 'gif' || req.extension === 'png') ? true : false;

	if (!resize) {
		// Reads specific file by ID
		F.exists(req, res, function(next, filename) {
			DB('files').binary.read(id, function(err, stream, header) {
				if (err)
					return res.throw404();
				var writer = require('fs').createWriteStream(filename);
				CLEANUP(writer, function() {
					F.responseFile(req, res, filename);
					next();
				});
				stream.pipe(writer);
			});
		});
		return;
	}

	// Custom image resizing

	// Small hack for the file cache.
	// F.exists() uses req.uri.pathname for creating temp identificator and skips all query strings by creating (because this hack).
	if (req.query.s)
		req.uri.pathname = req.uri.pathname.replace('.', req.query.s + '.');

	// Below method checks if the file exists (processed) in temporary directory
	// More information in total.js documentation
	F.exists(req, res, 10, function(next, filename) {

		// Reads specific file by ID
		DB('files').binary.read(id, function(err, stream, header) {

			if (err) {
				next();
				return res.throw404();
			}

			var writer = require('fs').createWriteStream(filename);
			stream.pipe(writer);
			stream.on('end', function() {

				// Image processing
				F.responseImage(req, res, filename, function(image) {
					image.output(req.extension);
					if (req.extension === 'jpg')
						image.quality(85);
					image.resize(req.query.s + '%');
					image.minify();
				});

				// Releases F.exists()
				next();
			});
		});
	});
}
