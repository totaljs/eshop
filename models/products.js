"use strict";

var async = require('async');

var dict = {};

NEWSCHEMA('Prices').make(function(schema) {
    schema.define('pu_ht', Number, true); // For base price
    schema.define('priceQty', 'JSON'); // For quantity price reduction

    schema.setDefault(function(propertyName, isntPreparing, schemaName) {
        if (propertyName === 'pu_ht')
            return 0;
    });
});
NEWSCHEMA('Attributes').make(function(schema) {
    schema.define('key', 'String(50)', true);
    schema.define('value', String);
    schema.define('css', 'String(20)');
});
NEWSCHEMA('Product').make(function(schema) {

	schema.define('id', 'String(20)');
    //schema.define('files', '[String]');
	schema.define('reference', 'String(20)');
	schema.define('category', 'String(300)', true);
	schema.define('manufacturer', 'String(50)');
	schema.define('name', 'String(50)', true);
    schema.define('ref', 'String(50)', true);
	schema.define('price', Number, true);
	schema.define('priceold', Number);
	schema.define('description', String, true);
	schema.define('availability', 'String(40)');
	schema.define('template', 'String(30)');
	schema.define('body', String);
	schema.define('pictures2', '[String]');
	schema.define('istop', Boolean);
	schema.define('isnew', Boolean);
	schema.define('linker', 'String(50)');
    schema.define('prices', 'Prices');
    schema.define('units', 'String(20)');
    schema.define('attributes', '[Attributes]');
    schema.define('search', 'String(1000)');            // Search pharses

	// Gets listing
	schema.setQuery(function(error, options, callback) {

        // options.search {String}
        // options.category {String}
        // options.page {String or Number}
        // options.max {String or Number}
        // options.id {String}
        console.log(options);

		options.page = U.parseInt(options.page) - 1;
		options.max = U.parseInt(options.max, 20);

		if (options.id && typeof(options.id) === 'string')
			options.id = options.id.split(',');

		if (options.page < 0)
			options.page = 0;

		var take = U.parseInt(options.max);
		var skip = U.parseInt(options.page * options.max);
		var linker_detail = F.sitemap('detail', true);
		var linker_category = F.sitemap('category', true);
        var nosql = DB(error);
        nosql.listing('products', 'Product').make(function(builder) {

            builder.where('isremoved', false);
            options.category && builder.like('linker_category', '^' + options.category);
            options.manufacturer && builder.where('manufacturer', options.manufacturer);
            //console.log(options.q.keywords(true, true));
            options.q && builder.like('search', options.q);
            options.id && builder.in('id', options.id);
            options.skip && builder.where('id', '<>', options.skip);

		if (options.type) {
			 if ((options.type instanceof Array))
			 	options.type = [options.type];
			 for (var i = 0, length = options.type.length; i < length; i++) {
			 	switch (options.type[i]) {
			 		case '1':
                            builder.where('isnew', true);
			 			break;
			 		case '2':
                            builder.where('istop', true);
			 			break;
			 	}
			 }
		}

            builder.limit(take);
            builder.skip(skip);
            if (options.homepage)
                builder.sort('istop', false);
            else
                builder.sort('_id', false);
		switch (options.sort) {
			case '1':
			case '2':
                    builder.sort('price', options.sort === '2');
				break;
			case '3':
                    builder.sort('istop', true);
				break;
			default:
                    builder.sort('datecreated', true);
				break;
		}

        });
        nosql.exec(function(err, response) {

			var data = {};
            data.count = response.products.count;
            data.items = response.products.items;
			data.limit = options.max;
			data.pages = Math.ceil(data.count / options.max) || 1;
			data.page = options.page + 1;

            var linker_detail = F.sitemap('detail', true);
            var linker_category = F.sitemap('category', true);
            data.items.forEach(function(item) {
                if (linker_detail)
                    item.linker = linker_detail.url.format(item.linker);
                if (linker_category)
                    item.linker_category = linker_category.url + item.linker_category;
            });
			callback(data);
		});
	});

	// Saves the product into the database
	schema.setSave(function(error, model, options, callback, controller) {

        var count = 0;
		var newbie = model.id ? false : true;

		if (newbie) {
			newbie = true;
			model.id = UID();
			model.datecreated = F.datetime;
			model.admincreated = controller.user.name;
		} else {
			model.dateupdated = F.datetime;
			model.adminupdated = controller.user.name;
		}

		var category = prepare_subcategories(model.category);

		model.linker = ((model.reference ? model.reference + '-' : '') + model.name).slug();
		model.linker_manufacturer = model.manufacturer ? model.manufacturer.slug() : '';
        model.search = (model.name + ' ' + model.manufacturer + ' ' + model.category).keywords(true, true);
        var category = prepare_subcategories(model.category);
        model.category = category.name;
		model.linker_category = category.linker;
        model.isremoved = false;
        var nosql = DB(error);
        nosql.save('product', 'Product', newbie, function(builder) {
            builder.set(model);
            if (newbie)
                return;
            builder.rem('id');
            builder.rem('datecreated');
            builder.where('id', model.id);
            builder.first();
        });
        nosql.exec(function(err, response) {

            callback(SUCCESS(true));
            if (err)
                return;

			F.emit('products.save', model);

			if (!options || !options.importing)
				refresh_cache();
		});

	});

	// Gets a specific product
	schema.setGet(function(error, model, options, callback) {

        // options.category {String}
        // options.linker {String}
        // options.id {String}

        var nosql = DB(error);
        nosql.select('product', 'Product').make(function(builder) {

            options.category && builder.regex('linker_category', new RegExp('^' + options.category));
            options.linker && builder.where('linker', options.linker);
            options.id && builder.where('id', options.id);
            builder.first();
		});
        nosql.validate('product', 'error-404-product');
        nosql.exec(function(err, response) {
            if(err)
                return callback(err);
            
            async.parallel([
                //model.color
                function(cb) {
            
                    var color = {};
    
                    if(!response.attributes)
                        return null;
                
                    for(var i=0, len=response.attributes.length;i<len;i++) {
                        if(response.attributes[i].css) {
                            color = response.attributes[i];
                            break;
                        }
                    }

                    response.color=color;
                    cb();
                },
                // pricesDetails
                function(cb){
                    var Pricebreak = INCLUDE('pricebreak');

                    Pricebreak.set(response.prices.pu_ht, response.prices.pricesQty);

                    response.pricesDetails = Pricebreak.humanize(true, 3);
                    cb();
                },
                // _units
                function(cb){
                    var res = {};

                    var units = response.units;

                    if (units && dict.fk_units.values[units].label) {
                        //console.log(this);
                        res.id = units;
                        res.name = i18n.t("products:" + dict.fk_units.values[units].label);
                    } else { // By default
                        res.id = units;
                        res.name = units;
                    }
                    response._units = res;
                    cb();
                }
            ], function(err) {
                callback(err, response);
	});

        }, 'product');
    });
	// Removes product
	schema.setRemove(function(error, id, callback) {
        var nosql = DB(error);
        nosql.update('Product').make(function(builder) {
            builder.set('isremoved', true);
            builder.where('id', id);
            builder.first();
        });
        nosql.exec(SUCCESS(callback));
        // Refreshes internal information e.g. categories
		refresh_cache();
	});

	schema.addWorkflow('popular', function(error, model, options, callback) {

		var MAX = 16;

		NOSQL('orders').counter.stats(MAX, function(err, response) {

			var id = new Array(response.length);
			var compare = {};

			for (var i = 0, length = response.length; i < length; i++) {
				id[i] = response[i].id;
				compare[id[i]] = i;
			}

            NOSQL('Product').find().make(function(builder) {
				builder.in('id', id);
				builder.callback(function(err, items) {

					items.sort((a, b) => compare[a.id] < compare[b.id] ? -1 : 1);

					var data = SINGLETON('products.popular');
					data.count = items.length;
					data.items = items;
					data.limit = MAX;
					data.pages = 1;
					data.page = 1;
					callback(data);
				});
			});
		});
	});

	// Clears product database
	schema.addWorkflow('clear', function(error, model, options, callback) {
        var nosql = DB(error);
        nosql.remove('Product');
        nosql.exec(SUCCESS(callback));
	});

	// Refreshes categories
	schema.addWorkflow('refresh', function(error, model, options, callback) {
		refresh_cache();
		callback(SUCCESS(true));
	});

	// Replaces category
	schema.addWorkflow('category', function(error, model, options, callback) {

		// options.category_old
		// options.category_new

		var category_old = prepare_subcategories(options.category_old);
		var category_new = prepare_subcategories(options.category_new);

		var update = function(doc) {
			doc.category = doc.category.replace(category_old.name, category_new.name);
			doc.linker_category = doc.linker_category.replace(category_old.linker, category_new.linker);
			return doc;
		};
        var nosql = DB(error);
        nosql.select('products', 'Product').where(function(builder) {
            builder.where('linker_category', new RegExp('^' + category_old.linker));
            builder.fields('linker_category', 'category');
        });
        nosql.exec(function(err, response) {
            if (err)
                return callback();
            var items = response.products;
            var updates = [];
            for (var i = 0, length = items.length; i < length; i++) {
                var doc = items[i];
                updates.push({
                    _id: doc._id,
                    category: doc.category.replace(category_old.name, category_new.name),
                    linker_category: doc.linker_category.replace(category_old.linker, category_new.linker)
                });
            }

            updates.wait(function(item, next) {
                nosql = DB(error);
                nosql.update('product').make(function(builder) {
                    builder.set(item);
                    builder.first();
                    builder.where('_id', item._id);
                });
                nosql.exec(next, -1);
            }, function() {
                updates.length && setTimeout2('products', refresh_cache, 1000);
			callback(SUCCESS(true));
		});
	});

    });
	// Stats
	schema.addWorkflow('stats', function(error, model, options, callback) {
        NOSQL('Product').counter.monthly(options.id, function(err, views) {
			NOSQL('orders').counter.monthly(options.id, function(err, orders) {
				var item = SINGLETON('products.stats');
				item.views = views;
				item.orders = orders;
				callback(item);
			});
		});
	});

	// Imports CSV
	schema.addWorkflow('import.csv', function(error, model, filename, callback) {
		// Reads all id + references (for updating/inserting)
        var nosql = DB(error);
        nosql.select('products').make(function(builder) {
            builder.where('isremoved', false);
            builder.where('reference', '!=', '');
            builder.fields('id', 'reference');
        });
        nosql.exec(function(err, database) {

            if (err)
                return callback();
			require('fs').readFile(filename, function(err, buffer) {

				if (err) {
					error.push(err);
					return callback();
				}

				buffer = buffer.toString('utf8').split('\n');

				var properties = [];
				var schema = GETSCHEMA('Product');
				var isFirst = true;
				var count = 0;
				var options = { importing: true };

				buffer.wait(function(line, next) {

					if (!line)
						return next();

					var data = line.replace(/\"/g, '').split(';')
					var product = {};

					for (var i = 0, length = data.length; i < length; i++) {
						var value = data[i];
						if (!value)
							continue;
						if (isFirst)
							properties.push(value);
						else
							product[properties[i]] = value;
					}

					if (isFirst) {
						isFirst = false;
						return next();
					}

					if (!product.id && product.reference) {
						var tmp = database.findItem('reference', product.reference);
						if (tmp)
							product.id = tmp.id;
					}

					schema.make(product, function(err, model) {
						if (err)
							return next();
						count++;
						model.$save(options, next);
					});

				}, function() {
					refresh_cache();
					callback(SUCCESS(count > 0));
				});
			});
        }, 0);
		});

	// Imports XML
	schema.addWorkflow('import.xml', function(error, model, filename, callback) {
		// Reads all id + references (for updating/inserting)

        var nosql = DB(error);
        nosql.select('Product').make(function(builder) {
            builder.where('isremoved', false);
            builder.where('reference', '!=', '');
            builder.fields('id', 'reference', 'pictures');
        });
        nosql.exec(function(err, database) {

            if (err)
                return callback();
			var products = [];
			var count = 0;
			var stream = require('fs').createReadStream(filename);
			var options = { importing: true };

			stream.on('data', U.streamer('<product>', '</product>', function(value) {

				var index = value.indexOf('<product>');
				if (index === -1)
					return;

				value = value.substring(index).trim();
				xml = value.parseXML();

				var obj = {};

				Object.keys(xml).forEach(key => obj[key.replace('product.', '')] = xml[key]);
				products.push(obj);
			}));

			CLEANUP(stream, function() {

				var Fs = require('fs');
                var db = DB();
				var id;

				products.wait(function(product, next) {

					var tmp;

					if (!product.id && product.reference) {
						tmp = database.findItem('reference', product.reference);
						if (tmp)
							product.id = tmp.id;
					}

					var fn = function() {
						schema.make(product, function(err, model) {
							if (err)
								return next();
							count++;
                            model.$save(options, next);
                            // TODO: remove older pictures
							});

					};

					if (!product.pictures)
						return fn();

					id = [];

					// Download pictures
					product.pictures.split(',').wait(function(picture, next) {
						U.download(picture.trim(), ['get', 'dnscache'], function(err, response) {

							if (err || response.status === 302)
								return next();

							var filename = F.path.temp(U.GUID(10) + '.jpg');
							var writer = Fs.createWriteStream(filename);
							response.pipe(writer);
							CLEANUP(writer, function() {
                                var tmp = new ObjectID();
                                db.writeFile(tmp, filename, 'picture.jpg', null, function(err) {
										Fs.unlink(filename, NOOP);
                                    if (err)
                                        return next();
                                    id.push(tmp.toString());

									setTimeout(next, 200);
								});
							});
						});
					}, function() {
						product.pictures = id;
						fn();
					}, 3); // 3 threads

				}, function() {
					count && refresh_cache();
					callback(SUCCESS(count > 0));
				});
			});
        }, 0);
		});
    schema.addWorkflow('export.xml', function(error, model, options, callback) {
        var nosql = DB(error);
        nosql.select('products', 'Product').make(function(builder) {
            builder.where('isremoved', false);
	});
        nosql.exec(function(err, response) {

            if (err)
                return callback();

			var xml = [];

            var docs = response.products;
			for (var i = 0, length = docs.length; i < length; i++) {
				var doc = docs[i];
				var keys = Object.keys(doc);
				var line = '<product>';

				keys.forEach(function(key) {

					if (key === 'linker_category' || key === 'linker_manufacturer' || key === 'search' || key === 'linker')
						return;

					var val = doc[key];
					var tmp;

					if (val === null)
						val = '';

                    if (key === 'files') {

						tmp = '';

						val.forEach(function(id) {
							if (id)
								tmp += (tmp ? ',' : '') + F.config.custom.url + '/download/' + id + '.jpg';
						});

						val = tmp;

					} else if (val instanceof Date) {
						val = val.format();
					} else if (val instanceof Array) {
						val = val.join(',');
					} else if (typeof(val) !== 'string')
						val = val.toString();

					if (!val)
						return;

					line += '<{0}>{1}</{0}>'.format(key, val.encode());
				});

				xml.push(line + '</product>');
			}

			callback('<?xml version="1.0" encoding="UTF-8"?><products>' + xml.join('') + '</products>');
		});
	});
});

// Refreshes internal information (categories and manufacturers)
function refresh() {

    GETSCHEMA('Dict').query({_id: ['fk_product_status', 'fk_units'], object: true}, function (err, doc) {
        if (err) 
            return console.log(err);

        dict = doc;
    });

    var nosql = DB();
    nosql.push('categories', 'Product', function(collection, callback) {

        // groupping
        var $group = {};
        $group._id = {};
        $group._id.linker_category = '$linker_category';
        $group._id.category = '$category';
        $group.count = {
            $sum: 1
	};
        // filter
        var $match = {};
        $match.isremoved = false;
        var pipeline = [];
        pipeline.push({
            $match: $match
        });
        pipeline.push({
            $group: $group
        });
        collection.aggregate(pipeline, callback);
    });
    nosql.push('manufacturers', 'Product', function(collection, callback) {

        // groupping
        var $group = {};
        $group._id = {};
        $group._id.linker_manufacturer = '$linker_manufacturer';
        $group._id.manufacturer = '$manufacturer';
        $group.count = {
            $sum: 1
        };
        // filter
        var $match = {};
        $match.isremoved = false;
        var pipeline = [];
        pipeline.push({
            $match: $match
        });
        pipeline.push({
            $group: $group
        });
        collection.aggregate(pipeline, callback);
    });
    nosql.exec(function(err, response) {

        var db_manufacturers = {};
        var db_categories = {};
        for (var i = 0, length = response.manufacturers.length; i < length; i++) {
            var doc = response.manufacturers[i];
            db_manufacturers[doc._id.manufacturer] = {
                count: doc.count,
                linker: doc._id.linker_manufacturer
            };
        }

        for (var i = 0, length = response.categories.length; i < length; i++) {
            var doc = response.categories[i];
            db_categories[doc._id.category] = {
                count: doc.count,
                linker: doc._id.linker_category,
                path: doc._id.linker_category.split('/'),
                names: doc._id.category.split('/').trim()
            };
        }

		// Prepares categories with their subcategories
		var keys = Object.keys(db_categories);
		var categories = [];
		var categories_filter = {};

		for (var i = 0, length = keys.length; i < length; i++) {
			var name = keys[i];
			var item = db_categories[name];

			item.path.forEach(function(path, index) {
				var key = item.path.slice(0, index + 1).join('/');

				if (categories_filter[key]) {
					categories_filter[key].count += item.count;
					return;
				}

				var obj = {};
				obj.linker = key;
				obj.name = item.names.slice(0, index + 1).join(' / ');
				obj.count = item.count;
				obj.text = item.names[index];
				obj.parent = item.path.slice(0, index).join('/');
				obj.level = index;
				categories_filter[key] = obj;
			});
		}

		Object.keys(categories_filter).forEach(key => categories.push(categories_filter[key]));

		categories.sort((a, b) => a.level > b.level ? 1 : a.level < b.level ? -1 : a.name.localeCompare2(b.name));

		// Prepares manufacturers
		keys = Object.keys(db_manufacturers);
		var manufacturers = new Array(keys.length);
		for (var i = 0, length = keys.length; i < length; i++) {
			var name = keys[i];
			var item = db_manufacturers[name];
			manufacturers[i] = { name: name, linker: item.linker, count: item.count };
		}

		manufacturers.quicksort('name');
		F.global.categories = categories;
		F.global.manufacturers = manufacturers;
	});
}

function prepare_subcategories(name) {

	var builder_link = [];
	var builder_text = [];
	var category = name.split('/');

	for (var i = 0, length = category.length; i < length; i++) {
		var item = category[i].trim();
		builder_link.push(item.slug());
		builder_text.push(item);
	}

	return { linker: builder_link.join('/'), name: builder_text.join(' / ') };
}

function refresh_cache() {
	setTimeout2('cache', () => F.cache.removeAll('cache.'), 2000);
	setTimeout2('products', refresh, 1000);
}

F.on('settings', refresh);
