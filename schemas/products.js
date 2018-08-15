// For importing
const Fs = require('fs');

NEWSCHEMA('ProductPrice').make(function(schema) {
	schema.define('id', 'UID');
	schema.define('name', 'String(50)');
	schema.define('stock', Number);
	schema.define('price', Number);
});

NEWSCHEMA('Product').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('availability', 'String(40)');
	schema.define('body', String);
	schema.define('bodywidgets', '[String(22)]');       // List of all used widgets
	schema.define('category', 'String(300)', true);
	schema.define('description', 'String(1000)', true);
	schema.define('isnew', Boolean);
	schema.define('ispublished', Boolean);
	schema.define('istop', Boolean);
	schema.define('linker', 'String(50)');
	schema.define('manufacturer', 'String(50)');
	schema.define('name', 'String(50)', true);
	schema.define('pictures', '[String]');
	schema.define('pictures2', '[String]');
	schema.define('prices', '[ProductPrice]', true);
	schema.define('pricemin', Number);                  // Minimal price
	schema.define('pricemax', Number);                  // Maximal price
	schema.define('priceold', Number);                  // Old price from
	schema.define('stock', Number);                     // Stock count
	schema.define('reference', 'String(20)');
	schema.define('signals', '[String(30)]');
	schema.define('size', '[String(10)]');
	schema.define('color', '[String(10)]');
	schema.define('template', 'String(30)');
	schema.define('widgets', '[Object]');               // List of all dynamic widgets, contains Array of ID widget

	// Gets listing
	schema.setQuery(function($) {

		var opt = $.options === EMPTYOBJECT ? $.query : $.options;
		var isAdmin = $.controller ? $.controller.name === 'admin' : false;
		var filter = NOSQL('products').find();

		filter.paginate(opt.page, opt.limit, 70);

		if (isAdmin) {
			opt.name && filter.adminFilter('name', opt, String);
			opt.category && filter.adminFilter('category', opt, String);
			opt.manufacturer && filter.adminFilter('manufacturer', opt, String);
			opt.stock && filter.adminFilter('stock', opt, Number);
			opt.pricemin && filter.adminFilter('pricemin', opt, Number);
		} else {
			opt.category && filter.like('linker_category', opt.category, 'beg');
			opt.manufacturer && filter.where('linker_manufacturer', opt.manufacturer);
			opt.size && filter.in('size', opt.size);
			opt.color && filter.in('color', opt.color);
			opt.stock && filter.where('stock', '>', 0);
			opt.published && filter.where('ispublished', true);
			opt.search && filter.like('search', opt.search.keywords(true, true));
			opt.skip && filter.where('id', '<>', opt.skip);
			opt.isnew && filter.where('isnew', true);
			opt.istop && filter.where('istop', true);
		}

		if (opt.sort)
			filter.adminSort(opt.sort);
		else
			filter.sort('datecreated', true);

		filter.fields('id', 'linker', 'linker_category', 'linker_manufacturer', 'category', 'manufacturer', 'name', 'pricemin', 'priceold', 'isnew', 'istop', 'pictures', 'availability', 'datecreated', 'ispublished', 'signals', 'size', 'stock', 'color');
		filter.callback(function(err, docs, count) {
			!isAdmin && prepare_links(docs);
			$.callback(filter.adminOutput(docs, count));
		});
	});

	// Saves the product into the database
	schema.setSave(function($) {

		var model = $.model;
		var user = $.user.name;
		var isUpdate = !!model.id;
		var nosql = NOSQL('products');
		var category = prepare_subcategories(model.category);
		var min = null;
		var max = null;
		var stock = 0;

		if (isUpdate) {
			model.dateupdated = F.datetime;
			model.adminupdated = user;
		} else {
			model.id = UID();
			model.datecreated = F.datetime;
			model.admincreated = user;
		}

		for (var i = 0; i < model.prices.length; i++) {
			var price = model.prices[i];

			if (min == null)
				min = price.price;
			else if (price.price < min)
				min = price.price;

			if (max == null)
				max = price.price;
			else if (price.price > max)
				max = price.price;

			if (price.stock)
				stock += price.stock;

			if (!price.id)
				price.id = UID();
		}

		model.stock = stock;
		model.pricemax = max;
		model.pricemin = min;

		model.linker = ((model.reference ? model.reference + '-' : '') + model.name).slug();
		model.linker_manufacturer = model.manufacturer ? model.manufacturer.slug() : '';
		model.linker_category = category.linker;
		model.category = category.name;
		model.search = (model.name + ' ' + (model.manufacturer || '') + ' ' + (model.reference || '')).keywords(true, true).join(' ').max(500);
		model.body = model.template ? U.minifyHTML(model.body) : '';

		var db = isUpdate ? nosql.modify(model).where('id', model.id).backup(user).log('Update: ' + model.id, user) : nosql.insert(model).log('Create: ' + model.id, user);

		db.callback(function() {
			ADMIN.notify({ type: 'products.save', message: model.name });
			EMIT('products.save', model);
			$.success();
			!$.options.importing && refresh_cache();
		});

	});

	// Gets a specific product
	schema.setGet(function($) {

		var options = $.options;
		var nosql = NOSQL('products');
		var builder = nosql.one();
		var isAdmin = $.controller ? $.controller.name === 'admin' : false;

		options.category && builder.where('linker_category', options.category);
		options.linker && builder.where('linker', options.linker);
		options.id && builder.where('id', options.id);
		options.published && builder.where('ispublished', true);
		$.controller && $.controller.id && builder.where('id', $.controller.id);

		if (isAdmin) {
			builder.callback($.callback, 'error-products-404');
			return;
		}

		builder.callback(function(err, response) {

			if (err)
				return $.invalid(err);

			// Stats
			nosql.counter.hit(response.id);

			response.category = F.global.categories.findItem('linker', response.linker_category);
			response.manufacturer = F.global.manufacturers.findItem('linker', response.linker_manufacturer);

			// CMS editor
			if (response.body) {
				response.body.CMSrender(response.widgets || EMPTYARRAY, function(body) {
					response.body = body;
					$.callback(response);
				}, $.controller);
			} else
				$.callback(response);

		}, 'error-products-404');
	});

	// Removes a specific product
	schema.setRemove(function($) {
		var id = $.body.id;
		var user = $.user.name;
		NOSQL('products').remove().backup(user).log('Remove: ' + id, user).where('id', id).callback(function() {
			$.success();
			refresh_cache();
		});
	});

	schema.addWorkflow('toggle', function($) {
		var user = $.user.name;
		var arr = $.options.id ? $.options.id : $.query.id.split(',');
		NOSQL('products').update(function(doc) {
			doc.ispublished = !doc.ispublished;
			return doc;
		}).log('Toggle: ' + arr.join(', '), user).in('id', arr).callback(function() {
			refresh_cache();
			$.success();
		});
	});

	schema.addWorkflow('prices', function($) {
		var id = $.options.id || (($.query.id || '').split(','));
		if (id.length)
			NOSQL('products').find().fields('id', 'prices', 'reference', 'stock', 'name').where('ispublished', true).in('id', id).callback($.callback);
		else
			$.invalid('error-data');
	});

	schema.addWorkflow('search', function($) {
		var q = ($.options.search || $.query.q || '').keywords(true, true).join(' ');
		NOSQL('products').find().fields('linker', 'linker_category', 'category', 'name', 'price').take(15).where('ispublished', true).search('search', q).callback(function(err, response) {
			prepare_links(response);
			$.callback(response);
		});
	});

	schema.addWorkflow('dependencies', function($) {
		var obj = {};

		obj.categories = [];
		obj.manufacturers = F.global.manufacturers;

		for (var i = 0, length = F.global.categories.length; i < length; i++) {
			var item = F.global.categories[i];
			obj.categories.push({ name: item.name, level: item.level, count: item.count, linker: item.linker });
		}

		obj.categories.quicksort('name');
		$.callback(obj);
	});

	// Clears database
	schema.addWorkflow('clear', function($) {
		var user = $.user.name;
		NOSQL('products').remove().backup(user).log('Clear all products', user).callback(function() {
			$.success();
			refresh_cache();
		});
	});

	// Refreshes categories
	schema.addWorkflow('refresh', function($) {
		refresh_cache();
		$.success(true);
	});

	// Replaces category
	schema.addWorkflow('replace-category', function($) {

		var name_old = prepare_subcategories($.query.name_old);
		var name_new = prepare_subcategories($.query.name_new);

		var update = function(doc) {
			doc.category = doc.category.replace(name_old.name, name_new.name);
			doc.linker_category = doc.linker_category.replace(name_old.linker, name_new.linker);
			return doc;
		};

		NOSQL('products').update(update).like('category', name_old.name, 'beg').callback(function(err, count) {
			if (count) {
				refresh_cache();
				ADMIN.notify({ type: 'products.replace-category', message: name_old.name + ' --> ' + name_new.name });
			}
			$.success();
		});
	});

	// Replaces manufacturer
	schema.addWorkflow('replace-manufacturer', function($) {

		var name_old = prepare_subcategories($.query.name_old);
		var name_new = prepare_subcategories($.query.name_new);

		var update = function(doc) {
			doc.manufacturer = doc.manufacturer.replace(name_old.name, name_new.name);
			doc.linker_manufacturer = doc.linker_manufacturer.replace(name_old.linker, name_new.linker);
			return doc;
		};

		NOSQL('products').update(update).like('manufacturer', name_old.name, 'beg').callback(function(err, count) {
			if (count) {
				refresh_cache();
				ADMIN.notify({ type: 'products.replace-manufacturer', message: name_old.name + ' --> ' + name_new.name });
			}
			$.success();
		});
	});

	// Stats
	schema.addWorkflow('stats', function($) {
		NOSQL('products').counter.monthly($.id || $.options.id || 'all', function(err, views) {
			NOSQL('orders').counter.monthly($.id || $.options.id || 'all', function(err, orders) {
				var output = {};
				output.views = views;
				output.orders = orders;
				$.callback(output);
			});
		});
	});

	schema.addWorkflow('popular', function($) {

		var MAX = $.options.limit || 20;

		NOSQL('orders').counter.stats(MAX, function(err, response) {

			var id = new Array(response.length);
			var compare = {};

			for (var i = 0, length = response.length; i < length; i++) {
				id[i] = response[i].id;
				compare[id[i]] = i;
			}

			var filter = NOSQL('products').find();

			filter.make(function(builder) {
				builder.fields('id', 'linker', 'linker_category', 'linker_manufacturer', 'category', 'manufacturer', 'name', 'pricemin', 'priceold', 'isnew', 'istop', 'pictures', 'availability', 'datecreated', 'ispublished', 'signals', 'size', 'stock', 'color');
				builder.in('id', id);
				builder.callback(function(err, docs,count) {
					docs.sort((a, b) => compare[a.id] < compare[b.id] ? -1 : 1);
					prepare_links(docs);
					$.callback(filter.adminOutput(docs, count));
				});
			});
		});
	});

	// Imports data
	schema.addWorkflow('import', function($) {

		// It expects options as array of products
		// Reads all id + references (for updating/inserting)
		NOSQL('products').find().fields('id', 'reference', 'pictures').callback(function(err, database) {

			var count = 0;
			var options = { importing: true };

			$.options.wait(function(item, next) {

				var tmp;

				if (item.reference) {
					tmp = database.findItem('reference', item.reference);
					if (tmp)
						item.id = tmp.id;
					else
						item.id = undefined;
				} else if (item.id) {
					tmp = database.findItem('id', item.id);
					if (!tmp)
						item.id = undefined;
				}

				var fn = function(item) {
					schema.make(item, function(err, model) {
						if (err)
							return next();
						count++;
						model.$controller($.controller);
						model.$save(options, next);
					});
				};

				if (!item.pictures)
					return fn(item);

				var id = [];

				// Download pictures
				item.pictures.wait(function(picture, next) {
					U.download(picture.trim(), ['get', 'dnscache'], function(err, response) {

						if (err || response.status === 302)
							return next();

						var filename = F.path.temp(U.GUID(10) + '.jpg');
						var writer = Fs.createWriteStream(filename);

						response.pipe(writer);

						CLEANUP(writer, function() {
							Fs.readFile(filename, function(err, data) {

								if (data && data.length > 3000) {
									Fs.unlink(filename, NOOP);
									id.push(NOSQL('files').binary.insert('picture.jpg', data));
								}

								setTimeout(next, 200);
							});
						});
					});
				}, function() {
					item.pictures = id;
					fn(item);
				}, 3); // 3 threads

			}, function() {
				if (count) {
					refresh_cache();
					ADMIN.notify({ type: 'products.import', message: count + '' });
				}
			});
		});

		$.success();
	});

	// Exports JSON
	schema.addWorkflow('export', function($) {
		NOSQL('products').find().callback(function(err, docs) {

			var skip = {};

			skip.body = true;
			skip.template = true;
			skip.linker_category = true;
			skip.linker_manufacturer = true;
			skip.linker = true;
			skip.pictures2 = true;
			skip.dateupdated = true;
			skip.admincreated = true;
			skip.adminupdated = true;
			skip.signals = true;
			skip.search = true;
			skip.widgets = true;

			$.callback(JSON.stringify(docs, function(key, value) {

				if (skip[key])
					return undefined;

				if (key !== 'pictures')
					return value;

				for (var i = 0, length = value.length; i < length; i++)
					value[i] = F.global.config.url + '/download/{0}.jpg'.format(value[i]);

				return value;
			}, '  '));
		});
	});
});

// Refreshes internal information (categories and manufacturers)
function refresh() {

	var dbCategories = {};
	var dbManufacturers = {};
	var dbSizes = [];
	var dbColors = [];

	(F.global.config.defaultcategories || '').split('\n').quicksort().forEach(function(item) {
		if (item) {
			var category = prepare_subcategories(item);
			if (!dbCategories[category.name])
				dbCategories[category.name] = { count: 0, hidden: 0, linker: category.linker, path: category.linker.split('/'), names: category.name.split('/').trim(), size: [] };
		}
	});

	var prepare = function(doc) {

		var category = doc.category;
		var manufacturer = doc.manufacturer;

		if (dbCategories[category]) {
			if (doc.ispublished) {

				if (doc.size) {
					prepare_size(dbCategories[category], doc.size);
					prepare_size(dbSizes, doc.size);
				}

				if (doc.color) {
					prepare_color(dbCategories[category], doc.color);
					prepare_color(dbColors, doc.color);
				}

				manufacturer && dbCategories[category].manufacturers.indexOf(manufacturer) === -1 && dbCategories[category].manufacturers.push(manufacturer);
				dbCategories[category].count++;
			} else
				dbCategories[category].hidden++;
		} else
			dbCategories[category] = { count: doc.ispublished ? 1 : 0, hidden: doc.ispublished ? 0 : 1, linker: doc.linker_category, path: doc.linker_category.split('/'), names: doc.category.split('/').trim(), size: doc.size || [], color: doc.color || [], manufacturers: [doc.manufacturer] };

		if (!manufacturer)
			return;

		if (dbManufacturers[manufacturer]) {
			if (doc.ispublished) {
				dbManufacturers[manufacturer].count++;
				doc.size && prepare_size(dbManufacturers[manufacturer], doc.size);
				doc.color && prepare_color(dbManufacturers[manufacturer], doc.color);
			} else
				dbManufacturers[manufacturer].hidden++;
		} else
			dbManufacturers[manufacturer] = { count: doc.ispublished ? 1 : 0, hidden: doc.ispublished ? 0 : 1, linker: doc.linker_manufacturer, size: doc.size || [], color: doc.color || [] };
	};

	NOSQL('products').find().prepare(prepare).callback(function() {

		// Prepares categories with their subcategories
		var keys = Object.keys(dbCategories);
		var categories = [];
		var categories_filter = {};
		var tmp;

		for (var i = 0, length = keys.length; i < length; i++) {
			var name = keys[i];
			var item = dbCategories[name];

			if (!item.manufacturers)
				item.manufacturers = [];

			for (var j = 0, jl = item.manufacturers.length; j < jl; j++) {
				var key = item.manufacturers[j];
				if (key) {
					item.manufacturers[j] = dbManufacturers[key];
					item.manufacturers[j].name = key;
				}
			}

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
				obj.hidden = item.hidden;
				obj.text = item.names[index];
				obj.parent = item.path.slice(0, index).join('/');
				obj.level = index;
				obj.sizes = item.size;
				obj.color = item.color;
				obj.path = item.path;
				obj.manufacturers = item.manufacturers;

				obj.contains = function(path) {
					return (path + '/').indexOf(this.linker) !== -1;
				};

				obj.is = function(category) {
					if (!category)
						return false;
					var path = category.path;
					for (var i = 0; i < this.level + 1; i++) {
						if (path[i] !== this.path[i])
							return false;
					}
					return true;
				};
				categories_filter[key] = obj;
			});
		}

		Object.keys(categories_filter).forEach(key => categories.push(categories_filter[key]));
		categories.sort((a, b) => a.level > b.level ? 1 : a.level < b.level ? -1 : a.name.localeCompare2(b.name));

		for (var i = 0, length = categories.length; i < length; i++) {
			var item = categories[i];
			item.children = categories.where('parent', item.linker);
			item.parent = categories.find('linker', item.parent);
			item.top = tmp = item.parent;
			while (tmp) {
				tmp = categories.find('linker', item.parent);
				if (tmp)
					item.top = tmp;
			}
		}

		// Prepares manufacturers
		keys = Object.keys(dbManufacturers);
		var manufacturers = new Array(keys.length);
		for (var i = 0, length = keys.length; i < length; i++) {
			var name = keys[i];
			var item = dbManufacturers[name];
			manufacturers[i] = { name: name, linker: item.linker, count: item.count, hidden: item.hidden, sizes: item.size, color: item.color };
		}

		manufacturers.quicksort('name');
		F.global.categories = categories;
		F.global.manufacturers = manufacturers;
		F.global.sizes = dbSizes;
		F.global.colors = dbColors;
	});
}

function prepare_size(item, items) {
	for (var i = 0, length = items.length; i < length; i++) {
		if (item instanceof Array) {
			if (item.indexOf(items[i]) === -1)
				item.push(items[i]);
		} else if (item.size.indexOf(items[i]) === -1)
			item.size.push(items[i]);
	}
}

function prepare_color(item, items) {
	for (var i = 0, length = items.length; i < length; i++) {
		if (item instanceof Array) {
			if (item.indexOf(items[i]) === -1)
				item.push(items[i]);
		} else if (item.color.indexOf(items[i]) === -1)
			item.color.push(items[i]);
	}
}

function prepare_links(items) {
	var linker_detail = F.sitemap('detail', true);
	var linker_category = F.sitemap('category', true);
	for (var i = 0, length = items.length; i < length; i++) {
		var item = items[i];
		if (linker_detail)
			item.linker = linker_detail.url.format(item.linker);
		if (linker_category)
			item.linker_category = linker_category.url + item.linker_category;
		item.body = undefined;
	}
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
	setTimeout2('cache', () => F.cache.removeAll('cachecms'), 2000);
	setTimeout2('products', refresh, 1000);
}

ON('settings', refresh);