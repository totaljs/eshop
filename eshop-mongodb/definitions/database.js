var db = null;

F.wait('database');

require('mongobuilder').init(CONFIG('database'), function(err, instance) {
	if (err)
		F.error(err);
	db = instance;
	F.emit('database');
	F.wait('database');
});

F.database = function(collection) {
	if (collection)
		return db.collection(collection);
	return db;
};
