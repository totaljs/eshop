const Fs = require('fs');

NEWSCHEMA('File').make(function(schema) {

	schema.setQuery(function($) {
		NOSQL('files').binary.all($.callback);
	});

	schema.addWorkflow('clear', function($) {

		var databases = [F.path.databases('posts.nosql'), F.path.databases('notices.nosql'), F.path.databases('pages.nosql'), F.path.databases('widgets.nosql'), F.path.databases('navigations.nosql'), F.path.databases('newsletters.nosql'), F.path.databases('products.nosql'), F.path.databases('orders.nosql')];
		var remove = [];
		var storage = NOSQL('files').binary;
		var count = 0;
		var db = {};

		// This can be a longer operation, therefore respond
		$.success();

		storage.all(function(err, files) {

			for (var i = 0, length = files.length; i < length; i++) {
				files[i].is = false;
				files[i].buffer = Buffer.from(files[i].id);
			}

			files.wait(function(file, next) {
				databases.wait(function(filename, resume) {

					if (file.is)
						return resume();

					var tmp = [];

					if (db[filename] == null) {
						try {
							Fs.statSync(filename);
							db[filename] = true;
						} catch (e) {
							// Not found
							db[filename] = false;
							resume();
							return;
						}
					} else if (db[filename] === false) {
						resume();
						return;
					}

					CLEANUP(Fs.createReadStream(filename).on('data', function(chunk) {

						if (file.is) {
							this.destroy();
							resume();
							return;
						}

						tmp.push(chunk);
						tmp.length > 2 && tmp.shift();

						if (tmp.length && Buffer.concat(tmp, tmp[0].length + (tmp[1] ? tmp[1].length : 0)).indexOf(file.buffer) !== -1)
							file.is = true;

					}), resume);

				}, function() {

					if (!file.is) {
						remove.push(file);
						count++;
					}

					next();
				});

			}, function() {
				remove.wait((item, next) => storage.remove(item.id, next), () => ADMIN.notify({ type: 'files.clear', message: count + '' }));
			});
		});
	});

});