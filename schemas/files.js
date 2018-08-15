const Fs = require('fs');

NEWSCHEMA('File').make(function(schema) {

	schema.setQuery(function($) {
		FILESTORAGE('files').all($.callback);
	});

	schema.addWorkflow('clear', function($) {

		var databases = [F.path.databases('posts.nosql'), F.path.databases('notices.nosql'), F.path.databases('pages.nosql'), F.path.databases('widgets.nosql'), F.path.databases('navigations.nosql'), F.path.databases('newsletters.nosql')];
		var remove = [];
		var storage = FILESTORAGE('files');
		var db = {};
		var count = 0;

		// This can be a longer operation, therefore respond
		$.success();

		var reg = /(\/|\\)+[a-z0-9]+(_draft)?\.html$/;
		var async = [];
		var filter = (path) => reg.test(path);

		async.push(function(next) {
			U.ls(F.path.databases('pages'), function(files) {
				files.length && databases.push.apply(databases, files);
				next();
			}, filter);
		});

		async.push(function(next) {
			U.ls(F.path.databases('posts'), function(files) {
				files.length && databases.push.apply(databases, files);
				next();
			}, filter);
		});

		async.push(function(next) {
			U.ls(F.path.databases('newsletters'), function(files) {
				files.length && databases.push.apply(databases, files);
				next();
			}, filter);
		});

		async.async(function() {

			storage.all(function(err, files) {

				for (var i = 0, length = files.length; i < length; i++) {
					files[i].is = false;
					files[i].buffer = Buffer.from(files[i].id);
				}

				files.limit(50, function(files, next) {
					databases.wait(function(filename, resume) {

						var is = true;

						for (var i = 0; i < files.length; i++) {
							if (!files[i].is) {
								is = false;
								break;
							}
						}

						if (is)
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

							var is = true;

							for (var i = 0; i < files.length; i++) {
								if (!files[i].is) {
									is = false;
									break;
								}
							}

							if (is) {
								this.destroy();
								resume();
								return;
							}

							tmp.push(chunk);
							tmp.length > 2 && tmp.shift();

							if (tmp.length) {
								var buf = Buffer.concat(tmp, tmp[0].length + (tmp[1] ? tmp[1].length : 0));
								for (var i = 0; i < files.length; i++) {
									var file = files[i];
									if (buf.indexOf(file.buffer) !== -1)
										file.is = true;
								}
							}

						}), resume);

					}, function() {

						for (var i = 0; i < files.length; i++) {
							var file = files[i];
							if (!file.is) {
								remove.push(file);
								count++;
							}
						}

						next();
					});

				}, function() {
					remove.wait((item, next) => storage.remove(item.id, next), () => ADMIN.notify({ type: 'files.clear', message: count + '' }));
				});
			});
		});
	});

});