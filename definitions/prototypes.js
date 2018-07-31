F.prototypes(function(proto) {

	// Converting values
	var convert = function(value, type) {

		if (type === undefined || type === String)
			return value;

		if (type === Number)
			return value.trim().parseFloat();

		if (type === Date)
			return value.trim().parseDate();

		if (type === Boolean)
			return value.trim().parseBoolean();

		return value;
	};

	// Admin: Grid filtering
	proto.DatabaseBuilder.adminFilter = function(name, obj, type, key) {

		var builder = this;
		var value = obj[name];

		if (!key)
			key = name;

		// Between
		var index = value.indexOf(' - ');
		if (index !== -1) {
			var arr = value.split(' - ');
			for (var i = 0, length = arr.length; i < length; i++) {
				var item = arr[i].trim();
				arr[i] = convert(item, type);
			}
			return builder.between(key, arr[0], arr[1]);
		}

		// Multiple values
		index = value.indexOf(',');
		if (index !== -1) {

			var arr = value.split(',');

			if (type === undefined || type === String) {
				builder.or();
				for (var i = 0, length = arr.length; i < length; i++) {
					var item = arr[i].trim();
					builder.search(key, item);
				}
				return builder.end();
			}

			for (var i = 0, length = arr.length; i < length; i++)
				arr[i] = convert(arr[i], type);

			return builder.in(key, arr);
		}

		if (type === undefined || type === String)
			return builder.search(key, value);

		if (type === Date) {
			var val = convert(value, type);
			return builder.between(key, val.extend('00:00:00'), val.extend('23:59:59'));
		}

		return builder.where(key, convert(value, type));
	};

	proto.DatabaseBuilder.adminOutput = function(docs, count) {
		var builder = this;
		var data = {};
		data.count = count;
		data.items = docs;
		data.limit = builder.$take;
		data.pages = Math.ceil(count / builder.$take) || 1;
		data.page = Math.ceil(builder.$skip / builder.$take) + 1;
		return data;
	};

	// Admin: Grid sorting
	proto.DatabaseBuilder.adminSort = function(sort) {
		var builder = this;
		var index = sort.lastIndexOf('_');
		builder.sort(sort.substring(0, index), sort.substring(index + 1) === 'desc');
		return builder;
	};
});