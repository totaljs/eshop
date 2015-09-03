// Helper for pagination rendering
// Eshop use this helper
F.helpers.pagination = function(model) {
	var builder = '';

	for (var i = 0; i < model.pages; i++) {
		var page = i + 1;
		builder += '<a href="?page=' + page + '"' + (model.page === page ? ' class="selected"' : '') + '>' + page + '</a>';
	}

	return builder;
};