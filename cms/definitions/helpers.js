// Helper for pagination rendering
// Eshop uses this helper
F.helpers.pagination = function(model) {
	return new Pagination(model.count, model.page, model.limit).html(8);
};