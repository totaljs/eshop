NEWSCHEMA('Common', function(schema) {

	// Reads backuped items
	schema.addWorkflow('backup', function($) {
		var req = $.controller.req;
		var name = req.split[req.split.length - 3];
		NOSQL(name).backups(n => n.data.id === $.id, function(err, response) {
			response.wait(function(item, next) {
				F.functions.read(name, item.data.id + '_' + item.data.stamp, function(err, body) {
					item.data.body = body;
					next();
				});
			}, () => $.callback(response));
		});
	});

});