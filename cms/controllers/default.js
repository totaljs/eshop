exports.install = function() {
	// CMS rendering
	F.route('/*', view_page);

	// POSTS
	F.route('#blogs',            view_blogs, ['*Post']);
	F.route('#blogsdetail',      view_blogs_detail, ['*Post']);

	// FILES
	F.file('/download/', file_read);
};

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

	var id = req.path[1].replace('.' + req.extension, '');
	var resize = req.query.s && (req.extension === 'jpg' || req.extension === 'gif' || req.extension === 'png') ? true : false;

	if (!resize) {
		// Reads specific file by ID
		F.exists(req, res, function(next, filename) {
			DB('files').binary.read(id, function(err, stream, header) {

				if (err) {
					next();
					return res.throw404();
				}

				var writer = require('fs').createWriteStream(filename);
				CLEANUP(writer, function() {
					res.file(filename);
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
				res.image(filename, function(image) {
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

// ============================================
// POSTS
// ============================================

function view_blogs() {
	var self = this;
	var options = {};

	options.category = 'Blogs';

	if (self.query.q)
		options.search = self.query.q;

	if (self.query.page)
		options.page = self.query.page;

	self.$query(options, self.callback('blogs-all'));
}

function view_blogs_detail(linker) {
	var self = this;
	var options = {};
	options.category = 'Blogs';
	options.linker = linker;
	self.$get(options, self.callback('blogs-detail'));
}
