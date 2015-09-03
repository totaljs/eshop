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