// Helper for pagination rendering
// Eshop uses this helper
F.helpers.pagination = function(model) {
	var builder = '';
	var pagination = new Pagination(model.count, model.page, model.limit);
	pagination.render().forEach(n => builder += '<a href="?page=' + n.page + '"' + (n.selected ? ' class="selected"' : '') + '>' + n.page + '</a>');
	return builder;
};