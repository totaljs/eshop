exports.install = function() {

	// JSS + CSS merging
	MERGE('/admin/admin.js', '=admin/public/ui.js', '=admin/public/admin.js');
	MERGE('/admin/admin.css', '=admin/public/ui.css', '=admin/public/admin.css');

	// Localization + minification
	LOCALIZE('/admin/components/*.html');
	LOCALIZE('/admin/forms/*.html');
	LOCALIZE('/admin/templates/*.html');

};