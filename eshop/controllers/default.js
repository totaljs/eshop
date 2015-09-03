exports.install = function() {
	// COMMON
	F.route('/', view_homepage);
	F.route('/contact/', view_contact);

	// CMS rendering through the 404
	F.route('#404', view_page);

	// FILES
	F.file('Images (small, large)', file_image);
	F.file('Files', file_read);
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
			self.page('#banners', '~index', response, false, true);
		});
	});
}

// Contact with contact form
function view_contact() {
	var self = this;
	self.page(self.url, 'contact');
}

// ==========================================================================
// CMS (Content Management System)
// ==========================================================================

function view_page() {
	var self = this;
	self.page(self.url);
}

// ==========================================================================
// FILES
// ==========================================================================

// Reads a specific file from database
// URL: /download/*.*
function file_read(req, res, is) {

	if (is)
		return req.path[0] === 'download';

	// Reads specific file by ID
	DB('files').binary.read(req.path[1].replace('.' + req.extension, ''), function(err, stream, header) {
		if (err) {
			res.throw404();
			return;
		}
		res.stream(header.type, stream);
	});
}

// Reads a specific picture from database
// URL: /images/small|large/*.jpg
function file_image(req, res, is) {

	if (is)
		return req.path[0] === 'images' && (req.path[1] === 'small' || req.path[1] === 'large') && req.path[2];

	var Fs = require('fs');

	// Below method checks if the file exists (processed) in temporary directory
	// More information in total.js documentation
	F.exists(req, res, 10, function(next, filename) {

		// Reads specific file by ID
		DB('files').binary.read(req.path[2].replace('.jpg', ''), function(err, stream, header) {

			if (err) {
				next();
				return res.throw404();
			}

			var writer = Fs.createWriteStream(filename);
			stream.pipe(writer);

			stream.on('end', function() {

				// Image processing
				F.responseImage(req, res, filename, function(image) {
					image.output('jpg');
					image.quality(90);

					if (req.path[1] === 'large')
						image.miniature(600, 400);
					else
						image.miniature(200, 150);

					image.minify();
				});

				// Release F.exists()
				next();
			});
		});
	});
}