// Helper for pagination rendering
// Eshop use this helper
F.helpers.pagination = function(model) {
	var builder = '';

	for (var i = 0; i < model.pages; i++) {
		var page = i + 1;
		builder += '<li><a href="?page=' + page + '"' + (model.page === page ? ' class="selected"' : '') + '>' + page + '</a></li>';
	}

	return builder;
};

// Parses all parent categories from selected category
// This helper is used in layout.html
F.helpers.sitemap_category = function(url, category) {

	var a = category.name.split('/');
	var b = category.linker.split('/');
	var builder = '';
	var linker = '';

	for (var i = 0, length = a.length; i < length; i++) {
		linker += (linker ? '/' : '') + b[i];
		builder += (i ? '<span class="fa fa-caret-right"></span>' : '') + '<a href="{0}">{1}</a>'.format(url.format(linker), a[i].trim());
	}

	return builder;
};