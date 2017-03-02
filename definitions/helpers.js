F.helpers.pagination = function(model) {
	return new Pagination(model.count, model.page, model.limit, this.href('page', 'XyX').replace('XyX', '{0}')).html(8);
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
		builder += '<li><span class="fa fa-caret-right"></span><a href="{0}/">{1}</a></li>'.format(url + linker, a[i].trim());
	}

	return builder;
};

// Helper for formatting number with currency
// Eshop uses this helper
F.helpers.currency = function(value, decimals) {
	return typeof(value) === 'string' ? F.config.custom.currency_entity.format(value) : F.config.custom.currency_entity.format(value.format(decimals || 2));
};