NEWSCHEMA('Tracking').make(function(schema) {

	schema.define('id', 'String(10)', true);
	schema.define('name', 'String(50)', true);

	schema.addWorkflow('exec', function($) {
		var db = NOSQL('tracking');
		var tracking = db.meta('keys');
		tracking && tracking[$.id] && db.counter.hit($.id);
		$.success();
	});

	schema.setSave(function($) {
		var db = NOSQL('tracking');
		var obj = db.meta('keys') || {};
		obj[$.model.id] = $.model.name;
		db.meta('keys', obj);
		$.success();
	});

	schema.setQuery(function($) {
		var obj = NOSQL('tracking').meta('keys') || EMPTYOBJECT;
		var arr = Object.keys(obj);
		var output = [];

		for (var i = 0, length = arr.length; i < length; i++)
			output.push({ id: arr[i], name: obj[arr[i]] });

		$.callback(output);
	});

	schema.setRemove(function($) {
		var db = NOSQL('tracking');
		var obj = db.meta('keys') || EMPTYOBJECT;
		delete obj[$.id];
		db.meta('keys', obj);
		db.counter.remove($.id);
		$.success();
	});

	schema.addWorkflow('stats', function($) {
		var nosql = NOSQL('tracking');
		var meta = nosql.meta('keys');

		if ($.id) {
			nosql.counter.monthly_sum($.id, $.callback);
			return;
		}

		nosql.counter.stats_sum(20, function(err, response) {
			for (var i = 0, length = response.length; i < length; i++) {
				var item = response[i];
				item.id = meta[item.id] || 'Unknown tracking';
			}
			$.callback(response);
		});
	});

});
