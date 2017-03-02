const Fs = require('fs');
const CSS = 'widgets.css';

NEWSCHEMA('Widget').make(function(schema) {

	schema.define('id', 'String(20)');
	schema.define('name', 'String(50)', true);
	schema.define('category', 'String(50)');
	schema.define('body', String);
	schema.define('css', String);
	schema.define('icon', 'String(20)');
	schema.define('istemplate', Boolean);

	// Gets listing
	schema.setQuery(function(error, options, callback) {
		var filter = NOSQL('widgets').find();
		filter.sort('name');
		filter.fields('id', 'icon', 'name', 'category', 'istemplate');
		filter.callback((err, docs) => callback(docs));
	});

	// Gets a specific widget
	schema.setGet(function(error, model, options, callback) {
		var filter = NOSQL('widgets').one();
		options.url && filter.where('url', options.url);
		options.id && filter.where('id', options.id);
		filter.callback(callback, 'error-404-widget');
	});

	// Removes a specific widget
	schema.setRemove(function(error, id, callback) {
		NOSQL('widgets').remove().where('id', id).callback(callback);
		setTimeout2('widgets', refresh, 1000);
	});

	// Saves the widget into the database
	schema.setSave(function(error, model, controller, callback) {

		var newbie = model.id ? false : true;
		var nosql = NOSQL('widgets');

		if (newbie) {
			model.id = UID();
			model.datecreated = F.datetime;
			model.admincreated = controller.user.name;
		} else {
			model.dateupdated = F.datetime;
			model.adminupdated = controller.user.name;
		}

		model.body = U.minifyHTML(model.body);

		(newbie ? nosql.insert(model) : nosql.modify(model).where('id', model.id)).callback(function() {
			F.emit('widgets.save', model);
			callback(SUCCESS(true));
			model.datebackup = F.datetime;
			NOSQL('widgets_backup').insert(model);
			setTimeout2('cache', () => F.cache.removeAll('cache.'), 1000);
			setTimeout2('widgets', refresh, 1000);
		});
	});

	// Clears widget database
	schema.addWorkflow('clear', function(error, model, options, callback) {
		NOSQL('widgets').remove();
		setTimeout2('widgets', refresh, 1000);
		callback(SUCCESS(true));
	});

	// Loads widgets for rendering
	schema.addWorkflow('load', function(error, model, widgets, callback) {

		var output = {};
		var filter = NOSQL('widgets').find();

		filter.filter(function(doc) {
			if (!doc.istemplate && widgets.indexOf(doc.id) !== -1)
				output[doc.id] = doc;
		});

		filter.callback(() => callback(output));
	});
});

function refresh() {
	NOSQL('widgets').find().fields('css').callback(function(err, docs) {
		var builder = [];
		docs.forEach(item => item.css && builder.push(item.css));
		Fs.writeFile(F.path.temp(CSS), U.minifyStyle(builder.join('\n')), NOOP);
		F.touch('/' + CSS);
		F.global.css = '/' + CSS + '?ts=' + U.GUID(5);
	});
}

F.file('/' + CSS, (req, res) => res.file(F.path.temp(CSS)));
F.on('settings', refresh);