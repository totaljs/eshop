// ====================================================
// Widget transformations
// ====================================================

// Widget: Top products
// e319342961 is Widget ID
GETSCHEMA('Widget').addTransform('e319342961', function(error, model, data, callback) {

	// data.settings
	// data.page
	// data.controller

	var options = {};
	options.max = 12;

	GETSCHEMA('Product').query(options, function(err, response) {

		if (err) {
			error.push(err);
			return callback();
		}

		// Renders products
		callback(F.view('eshop/partial-products', response, true));
	});
});