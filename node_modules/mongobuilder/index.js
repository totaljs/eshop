var Util = require('util');
var NUMBER = 'number';
var STRING = 'string';
var FUNCTION = 'function';
var BOOLEAN = 'boolean';
var OBJECT = 'object';
var NOOP = function(){};

global.ObjectID = require('mongodb').ObjectID;
global.GridStore = require('mongodb').GridStore;

ObjectID.parse = function(value, isArray) {
	if (value instanceof ObjectID)
		return value;
	if (isArray || value instanceof Array)
		return ObjectID.parseArray(value);
	try {
		return new ObjectID(value);
	} catch (e) {
		return null;
	}
};

ObjectID.parseArray = function(value) {

	if (typeof(value) === STRING)
		value = value.split(',');

	var arr = [];

	if (!(value instanceof Array))
		return arr;

	for (var i = 0, length = value.length; i < length; i++) {
		var id = ObjectID.parse(value[i]);
		if (id)
			arr.push(id);
	}

	return arr;
};

function MongoBuilder(skip, take) {
	skip = this.parseInt(skip);
	take = this.parseInt(take);
	this._filter = null;
	this._sort = null;
	this._skip = skip >= 0 ? skip : 0;
	this._take = take >= 0 ? take : 0;
	this._scope = 0;
	this._agg = null;
	this._upd = null;
	this._fields = null;
	this.onFilter = null;
	this.onUpdate = null;
	this.onAggregate = null;
	this.onInsert = null;
}

MongoBuilder.prototype.make = function(fn) {
	fn.call(this, this);
	return this;
};

MongoBuilder.prototype.skip = function(value) {
	var self = this;
	if (value === undefined)
		return self._skip;
	value = self.parseInt(value);
	self._skip = value;
	return self;
};

MongoBuilder.prototype.take = function(value) {
	var self = this;
	if (value === undefined)
		return self._take;
	value = self.parseInt(value);
	self._take = value;
	return self;
};

MongoBuilder.prototype.page = function(value, max) {
	var self = this;
	value = self.parseInt(value) - 1;
	max = self.parseInt(max);
	if (value < 0)
		value = 0;
	self._skip = value * max;
	self._take = max;
	return self;
};

MongoBuilder.prototype.limit = function(value) {
	var self = this;
	if (value === undefined)
		return self._take;
	value = self.parseInt(value);
	self._take = value;
	return self;
};

MongoBuilder.prototype.first = function() {
	var self = this;
	self._skip = 0;
	self._take = 1;
	return self;
};

MongoBuilder.prototype.sort = function(name, asc) {
	var self = this;
	if (asc === undefined)
		asc = true;
	if (self._sort === null)
		self._sort = {};
	self._sort[name] = asc === true || asc === 'asc' || asc === 1 ? 1 : -1;
	return self;
};

MongoBuilder.prototype.scope = function(name, obj) {
	var self = this;

	if (!self._filter)
		self._filter = {};

	if (self._scope === 0) {
		self._filter[name] = obj;
		return self;
	}

	if (self._scope === 1) {
		if (!self._filter['$or'])
			self._filter['$or'] = [];
		var filter = {};
		filter[name] = obj;
		self._filter['$or'].push(filter);
	}

	if (self._scope === 2) {
		if (!self._filter['$and'])
			self._filter['$and'] = [];
		var filter = {};
		filter[name] = obj;
		self._filter['$and'].push(filter);
	}

	return self;
};

MongoBuilder.prototype.in = function(name, value) {
	return this.scope(name, { '$in': value });
};

MongoBuilder.prototype.nin = function(name, value) {
	return this.scope(name, { '$nin': value });
};

MongoBuilder.prototype.clone = function(onlyFilter) {
	var self = this;
	var B = new MongoBuilder(self._skip, self._take);

	if (self._filter)
		B._filter = Util._extend({}, self._filter);

	if (self._sort)
		B._sort = Util._extend({}, self._sort);

	if (self._agg)
		B._agg = Util._extend({}, self._agg);

	B._scope = self._scope;

	if (!onlyFilter) {
		if (self._upd)
			B._upd = Util._extend({}, self._upd);
	}

	return B;
};

MongoBuilder.prototype.merge = function(B, rewrite, onlyFilter) {

	var self = this;
	var keys = Object.keys(B._filter);

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		if (rewrite)
			self._filter[key] = B._filter[key];
		else if (self._filter[key] === undefined)
			self._filter[key] = B._filter[key];
	}

	if (B._sort) {
		keys = Object.keys(B._sort);

		if (self._sort)
			self._sort = {};

		for (var i = 0, length = keys.length; i < length; i++) {
			var key = keys[i];
			if (rewrite)
				self._sort[key] = B._sort[key];
			else if (self._sort[key] === undefined)
				self._sort[key] = B._sort[key];
		}
	}

	if (B._agg) {
		keys = Object.keys(B._agg);

		if (self._agg)
			self._agg = {};

		for (var i = 0, length = keys.length; i < length; i++) {
			var key = keys[i];
			if (rewrite)
				self._agg[key] = B._agg[key];
			else if (self._agg[key] === undefined)
				self._agg[key] = B._agg[key];
		}
	}

	if (onlyFilter || !B._upd)
		return self;

	copy(B, self, '$set', rewrite);
	copy(B, self, '$inc', rewrite);
	copy(B, self, '$push', rewrite);
	copy(B, self, '$pull', rewrite);
	copy(B, self, '$pop', rewrite);
	copy(B, self, '$unset', rewrite);
	copy(B, self, '$addToSet', rewrite);
	copy(B, self, '$rename', rewrite);

	return self;
};

function copy(obj, target, name, rewrite) {

	if (!obj._upd[name])
		return;

	var keys = Object.keys(obj._upd[name]);
	if (keys.length === 0)
		return;

	if (!target._upd)
		target._upd = {};

	if (!target._upd[name])
		target._upd[name] = {};

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		if (rewrite)
			target._upd[name][key] = obj._upd[name][key];
		else if (target._upd[name][key] === undefined)
			target._upd[name][key] = obj._upd[name][key];
	}
}

MongoBuilder.prototype.destroy = function() {
	var self = this;
	self._filter = null;
	self._upd = null;
	self._agg = null;
	return self;
};

MongoBuilder.prototype.or = function() {
	var self = this;
	if (self._scope)
		return self.end();
	self._scope = 1;
	return self;
};

MongoBuilder.prototype.and = function() {
	var self = this;
	if (self._scope)
		return self.end();
	self._scope = 2;
	return self;
};

MongoBuilder.prototype.unset = function(name, value) {
	var self = this;
	if (!self._upd)
		self._upd = {};
	if (!self._upd.$unset)
		self._upd.$unset = {};
	self._upd.$unset[name] = arguments.length === 1 ? '' : value;
	return self;
};

MongoBuilder.prototype.push = function(name, value) {
	var self = this;
	if (!self._upd)
		self._upd = {};
	if (!self._upd.$push)
		self._upd.$push = {};
	self._upd.$push[name] = value;
	return self;
};

MongoBuilder.prototype.rename = function(name, value) {
	var self = this;
	if (!self._upd)
		self._upd = {};
	if (!self._upd.$rename)
		self._upd.$rename = {};
	self._upd.$rename[name] = value;
	return self;
};

MongoBuilder.prototype.pull = function(name, value) {
	var self = this;
	if (!self._upd)
		self._upd = {};
	if (!self._upd.$pull)
		self._upd.$pull = {};
	self._upd.$pull[name] = value;
	return self;
};

MongoBuilder.prototype.pop = function(name, value) {
	var self = this;
	if (!self._upd)
		self._upd = {};
	if (!self._upd.$pop)
		self._upd.$pop = {};
	self._upd.$pop[name] = value;
	return self;
};

MongoBuilder.prototype.addToSet = function(name, value) {
	var self = this;
	if (!self._upd)
		self._upd = {};
	if (!self._upd.$addToSet)
		self._upd.$addToSet = {};
	self._upd.$addToSet[name] = value;
	return self;
};

MongoBuilder.prototype.set = function(name, model, skip) {

	var self = this;

	if (!self._upd)
		self._upd = {};

	if (!self._upd.$set)
		self._upd.$set = {};

	var type = typeof(name);

	if (type === 'string') {
		self._upd.$set[name] = model;
		return self;
	}

	if (model instanceof Array) {
		var keys = Object.keys(name);
		for (var i = 0, length = keys.length; i < length; i++) {
			var key = keys[i];
			if (key[0] === '$')
				continue;
			if (skip) {
				if (model.indexOf(key) === -1)
					self._upd.$set[key] = name[key];
			} else {
				if (model.indexOf(key) !== -1)
					self._upd.$set[key] = name[key];
			}
		}
		return self;
	}

	extend(self._upd.$set, name, true);
	return self;
};

/**
 * Diff update
 * @param {Object} a Database object.
 * @param {Object} b Form object.
 * @param {String Array} keys Only this keys
 * @return {Boolean} Returns whether is change or no.
 */
MongoBuilder.prototype.diff = function(a, b, keys, skip) {

	if (!keys)
		keys = Object.keys(a);

	var bl = null;
	var self = this;
	var is = false;

	if (skip) {
		bl = {};
		for (var i = 0, length = keys.length; i < length; i++)
			bl[keys[i]] = true;
		keys = Object.keys(a);
	}

	for (var i = 0, length = keys.length; i < length; i++) {

		var key = keys[i];

		if (bl && bl[key])
			continue;

		if (key === '_id')
			continue;

		if (key[0] === '$')
			continue;

		var valueA = a[key];
		var valueB = b[key];

		if (valueA instanceof Array || valueB instanceof Array) {
			// compare array
			if (JSON.stringify(valueA) === JSON.stringify(valueB))
				continue;
			is = true;
			self.set(key, valueB);
			continue;
		}

		var ta = typeof(valueA);
		var tb = typeof(valueB);

		if (ta !== OBJECT) {

			if (valueA === valueB)
				continue;

			is = true;
			self.set(key, valueB);
			continue;
		}

		if (ta === FUNCTION || tb === FUNCTION)
			continue;

		if (valueA instanceof ObjectID || valueB instanceof ObjectID) {

			if (!valueA || !valueB) {
				is = true;
				self.set(key, valueB);
				continue;
			}

			if (valueA.toString() !== valueB.toString()) {
				is = true;
				self.set(key, valueB);
			}

			continue;
		}

		if (JSON.stringify(valueA) === JSON.stringify(valueB))
			continue;

		is = true;
		self.set(key, valueB);
	}
	return is;
};

MongoBuilder.prototype.clearFilter = function(skip, take) {
	var self = this;
	self._skip = self.parseInt(skip);
	self._take = self.parseInt(take);
	self._filter = null;
	self._fields = null;
	self._scope = 0;
	return self;
};

MongoBuilder.prototype.clearSort = function() {
	this._sort = null;
	return this;
};

MongoBuilder.prototype.clearAggregate = function() {
	this._agg = null;
	return this;
};

MongoBuilder.prototype.clearSet = function() {
	if (!this._upd)
		return this;
	delete this._upd.$set;
	return this;
};

MongoBuilder.prototype.clearUpd = MongoBuilder.prototype.clearUpdate = function() {
	this._upd = null;
	return this;
};

MongoBuilder.prototype.clearInc = function() {
	if (!this._upd)
		return this;
	delete this._upd.$inc;
	return this;
};

MongoBuilder.prototype.clear = function(skip, take) {
	var self = this;
	self._filter = null;
	self._sort = null;
	self._skip = self.parseInt(skip);
	self._take = self.parseInt(take);
	self._scope = 0;
	self._upd = null;
	self._agg = null;
	self._fields = null;
	return self;
};

MongoBuilder.prototype.parseInt = function(num) {
	if (typeof(num) === NUMBER)
		return num;
	if (!num)
		return 0;
	num = parseInt(num);
	if (isNaN(num))
		num = 0;
	return num;
};

MongoBuilder.prototype.inc = function(name, model) {
	var self = this;

	if (!self._upd)
		self._upd = {};

	if (!self._upd.$inc)
		self._upd.$inc = {};

	if (typeof(name) === 'string') {
		self._upd.$inc[name] = model;
		return self;
	}

	if (name instanceof Array) {

		for (var i = 0, length = name.length; i < length; i++) {
			var key = name[i];
			if (key[0] === '$' || key === '_id')
				continue;
			self._upd.$inc[key] = 1;
		}

		return self;
	}

	extend(self._upd.$inc, name, true);
	return self;
};

MongoBuilder.prototype.field = function(name, visible) {
	var self = this;
	if (!self._fields)
		self._fields = {};
	self._fields[name] = visible || visible === undefined ? 1 : 0;
	return self;
};

MongoBuilder.prototype.fields = function() {
	for (var i = 0; i < arguments.length; i++)
		this.field(arguments[i]);
	return this;
}

/**
 * End scope
 * @return {MongoBuilder}
 */
MongoBuilder.prototype.end = function() {
	var self = this;
	self._scope = 0;
	return self;
};

MongoBuilder.prototype.between = function(name, valueA, valueB) {
	var a, b;
	if (valueA > valueB) {
		a = valueB;
		b = valueA;
	} else {
		a = valueA;
		b = valueB;
	}
	return this.scope(name, { '$gte': a, '$lte': b });
};

MongoBuilder.prototype.like = function(name, value) {
	return this.scope(name, { '$regex': value });
};

MongoBuilder.prototype.regex = function(name, value) {
	return this.scope(name, { '$regex': value });
};

MongoBuilder.prototype.where = function(name, operator, value, isID) {
	return this.filter(name, operator, value, isID);
};

MongoBuilder.prototype.filter = function(name, operator, value, isID) {

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	var self = this;

	if (value === true && operator.length > 5) {
		value = operator;
		operator = '=';
		isID = true;
	}

	if (isID)
		value = ObjectID.parse(value);

	switch (operator) {
		case '=':
			return self.scope(name, value);
		case '!=':
		case '<>':
			return self.scope(name, { '$ne': value });
		case '>':
			return self.scope(name, { '$gt': value });
		case '>=':
			return self.scope(name, { '$gte': value });
		case '<':
			return self.scope(name, { '$lt': value });
		case '<=':
			return self.scope(name, { '$lte': value });
	}
	return self;
};

MongoBuilder.prototype.findCount = function(collection, fields, callback) {

	var self = this;
	var take = self._take;
	var skip = self._skip;
	var arg = [];

	if (typeof(fields) === FUNCTION) {
		callback = fields;
		fields = undefined;
	}

	arg.push(self.getFilter());

	 if (typeof(fields) === OBJECT)
		arg.push({ fields: fields });
	else if (self._fields)
		arg.push({ fields: self._fields });

	var cursor = collection.find.apply(collection, arg);

	cursor.count(function(err, count) {
		if (err)
			return callback(err);
		if (!count)
			return callback(err, [], count);

		cursor = collection.find.apply(collection, arg);
		if (skip > 0)
			cursor.skip(skip);
		if (take > 0)
			cursor.limit(take);
		if (self._sort)
			cursor.sort(self._sort);
		cursor.toArray(function(err, docs) {
			callback(err, docs, count);
		});
	});

	return self;
};

MongoBuilder.prototype.distinct = function(collection, key, callback) {
	var self = this;
	var arg = [key];
	arg.push(self.getFilter());
	arg.push(callback);
	collection.distinct.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.$$findCount = function(collection, fields) {
	var self = this;
	return function(callback) {
		var cursor = self.findCount(collection, fields);
		cursor.toArray(callback);
	};
};

MongoBuilder.prototype.find = function(collection, fields, callback) {

	if (typeof(fields) === FUNCTION) {
		callback = fields;
		fields = undefined;
	}

	this.findCursor(collection, { fields: fields }).toArray(callback);
	return this;
};

MongoBuilder.prototype.$$find = function(collection, fields) {
	var self = this;
	return function(callback) {
		var cursor = self.find(collection, fields);
		cursor.toArray(callback);
	};
};

MongoBuilder.prototype.$$count = function(collection) {
	var self = this;
	return function(callback) {
		self.count(collection, callback);
	};
};

MongoBuilder.prototype.$$distinct = function(collection, key) {
	var self = this;
	return function(callback) {
		self.distinct(collection, key, callback);
	};
};

MongoBuilder.prototype.count = function(collection, callback) {
	var self = this;
	var arg = [];
	arg.push(self.getFilter());
	collection.find.apply(collection, arg).count(callback);
	return self;
};

MongoBuilder.prototype.exists = function(collection, fields, callback) {

	var self = this;
	var arg = [];

	if (typeof(fields) === FUNCTION) {
		var tmp = callback;
		callback = fields;
		fields = undefined;
	}

	arg.push(self.getFilter());
	arg.push({ fields: { _id: 1 }});

	if (callback) {
		arg.push(function(err, doc) {
			callback(err, err ? false : doc ? true : false);
		});
	}

	collection.findOne.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.$$exists = function(collection) {
	var self = this;
	return function(callback) {
		self.exists(collection, fields, callback);
	};
};

MongoBuilder.prototype.findCursor = function(collection, fields) {

	var self = this;
	var take = self._take;
	var skip = self._skip;

	var arg = [];
	arg.push(self.getFilter());

	 if (typeof(fields) === OBJECT)
		arg.push({ fields: fields });
	else if (self._fields)
		arg.push({ fields: self._fields });

	var cursor = collection.find.apply(collection, arg);

	if (skip > 0)
		cursor.skip(skip);
	if (take > 0)
		cursor.limit(take);
	if (self._sort)
		cursor.sort(self._sort);

	return cursor;
};

MongoBuilder.prototype.one = function(collection, fields, callback) {
	return this.findOne(collection, fields, callback);
};

MongoBuilder.prototype.findOne = function(collection, fields, callback) {

	var self = this;
	var arg = [];

	if (typeof(fields) === FUNCTION) {
		var tmp = callback;
		callback = fields;
		fields = undefined;
	}

	arg.push(self.getFilter());

	 if (typeof(fields) === OBJECT)
		arg.push({ fields: fields });
	else if (self._fields)
		arg.push({ fields: self._fields });

	if (callback)
		arg.push(callback);

	collection.findOne.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.$$findOne = MongoBuilder.prototype.$$one = function(collection, fields) {
	var self = this;
	return function(callback) {
		self.findOne(collection, fields, callback);
	};
};

MongoBuilder.prototype.insert = function(collection, options, callback) {
	var self = this;

	if ((options === undefined && callback === undefined) || (typeof(options) === OBJECT && callback === undefined))
		callback = NOOP;

	if (typeof(options) === FUNCTION) {
		callback = options;
		options = {};
	}

	var arg = [];

	arg.push(self.getInsert());

	 if (options)
		arg.push(options);

	if (callback) {
		arg.push(function(err, response) {
			if (err) {
				callback(err, null);
				return;
			}
			callback(null, response.result.n);
		});
	}

	collection.insert.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.$$insert = function(collection, options) {
	var self = this;
	return function(callback) {
		self.insert(collection, options, callback);
	};
};

MongoBuilder.prototype.save = function(collection, options, callback) {
	var self = this;

	if ((options === undefined && callback === undefined) || (typeof(options) === OBJECT && callback === undefined))
		callback = NOOP;

	if (typeof(options) === FUNCTION) {
		callback = options;
		options = {};
	}

	if (!options)
		options = {};

	options.w = 1;

	var arg = [];
	var upd = self.getUpdate().$set;

	arg.push(upd);

	if (options)
		arg.push(options);

	if (callback) {
		arg.push(function(err, response) {
			if (err) {
				callback(err, null);
				return;
			}
			callback(null, response.result.n);
		});
	}

	collection.save.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.ui = function(collection, callback, onInsert) {

	var self = this;

	self.updateOne(collection, function(err, count) {
		if (count) {
			callback(err, false);
			return;
		}

		if (onInsert)
			onInsert.call(self, self);

		self.insert(collection, function(err) {
			callback(err, true);
		});
	});

	return self;
};

MongoBuilder.prototype.update = function(collection, options, callback) {
	var self = this;

	if ((options === undefined && callback === undefined) || (typeof(options) === OBJECT && callback === undefined))
		callback = NOOP;

	if (typeof(options) === FUNCTION) {
		callback = options;
		options = {};
	}

	if (!options)
		options = {};

	options.multi = true;

	var arg = [];

	arg.push(self.getFilter());
	arg.push(self.getUpdate());

	if (options)
		arg.push(options);

	if (callback) {
		arg.push(function(err, response) {
			if (err) {
				callback(err, null);
				return;
			}
			callback(null, response.result.n);
		});
	}

	collection.update.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.$$update = function(collection, options) {
	var self = this;
	return function(callback) {
		self.update(collection, options, callback);
	};
};

MongoBuilder.prototype.updateOne = function(collection, options, callback) {

	var self = this;

	if ((options === undefined && callback === undefined) || (typeof(options) === OBJECT && callback === undefined))
		callback = NOOP;

	if (typeof(options) === FUNCTION) {
		callback = options;
		options = {};
	}

	if (!options)
		options = {};

	options.multi = false;

	var arg = [];

	arg.push(self.getFilter());
	arg.push(self.getUpdate());
	arg.push(options);

	if (callback) {
		arg.push(function(err, response) {
			if (err) {
				callback(err, null);
				return;
			}
			callback(null, response.result.n);
		});
	}

	collection.update.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.$$updateOne = function(collection, options) {
	var self = this;
	return function(callback) {
		self.updateOne(collection, options, callback);
	};
};

MongoBuilder.prototype.remove = function(collection, options, callback) {
	var self = this;

	if ((options === undefined && callback === undefined) || (typeof(options) === OBJECT && callback === undefined))
		callback = NOOP;

	var arg = [];

	arg.push(self.getFilter());

	if (options)
		arg.push(options);

	if (callback) {
		arg.push(function(err, response) {
			if (err) {
				callback(err, null);
				return;
			}
			callback(null, response.result.n);
		});
	}

	collection.remove.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.$$remove = function(collection, options) {
	var self = this;
	return function(callback) {
		self.remove(collection, options, callback);
	};
};

MongoBuilder.prototype.removeOne = function(collection, options, callback) {
	var self = this;

	if ((options === undefined && callback === undefined) || (typeof(options) === OBJECT && callback === undefined))
		callback = NOOP;

	if (typeof(options) === FUNCTION) {
		callback = options;
		options = {};
	}

	if (!options)
		options = {};

	options.single = true;

	var arg = [];

	arg.push(self.getFilter());

	 if (options)
		arg.push(options);

	if (callback) {
		arg.push(function(err, response) {
			if (err) {
				callback(err, null);
				return;
			}
			callback(null, response.result.n);
		});
	}

	collection.remove.apply(collection, arg);
	return self;
};

MongoBuilder.prototype.$$removeOne = function(collection, options) {
	var self = this;
	return function(callback) {
		self.removeOne(collection, options, callback);
	};
};

MongoBuilder.prototype.getFilter = function() {
	var self = this;
	var filter = self._filter ? self._filter : {};
	if (self.onFilter)
		self.onFilter(filter);
	return filter;
};

MongoBuilder.prototype.getUpdate = function() {
	var self = this;
	var upd = self._upd;
	if (self.onUpdate)
		self.onUpdate(upd);
	return upd;
};

MongoBuilder.prototype.getInsert = function() {
	var self = this;
	var ins = {};

	if (self._upd) {
		if (self._upd.$inc)
			extend(ins, self._upd.$inc, false);
		if (self._upd.$set)
			extend(ins, self._upd.$set, false);
	}

	if (!ins._id)
		ins._id = new ObjectID();
	if (self.onInsert)
		self.onInsert(ins);
	return ins;
};

MongoBuilder.prototype.aggregate = function(collection, options, callback) {

	var self = this;

	if ((options === undefined && callback === undefined) || (typeof(options) === OBJECT && callback === undefined))
		callback = NOOP;

	if (typeof(options) === FUNCTION) {
		callback = options;
		options = undefined;
	}

	var agg = self._agg;
	if (self.onAggregate)
		self.onAggregate(agg);

	var keys = Object.keys(agg);
	var pipeline = [];

	if (self._filter)
		pipeline.push({ $match: self.getFilter() });

	for (var i = 0, length = keys.length; i < length; i++) {
		var tmp = {};
		tmp[keys[i]] = agg[keys[i]];
		pipeline.push(tmp);
	}

	if (self._sort)
		pipeline.push({ $sort: self._sort });

	if (self._take > 0)
		pipeline.push({ $limit: self._take });

	if (self._skip > 0)
		pipeline.push({ $skip: self._skip });

	if (options)
		collection.aggregate(pipeline, options, callback);
	else
		collection.aggregate(pipeline, callback);

	return self;
};

MongoBuilder.prototype.$$aggregate = function(collection, options) {
	var self = this;
	return function(callback) {
		self.aggregate(collection, options, callback);
	};
};

MongoBuilder.prototype.group = function(id, path) {
	var self = this;

	if (!self._agg)
		self._agg = {};

	if (!self._agg.$group)
		self._agg.$group = {};

	if (id.substring(0, 3) !== '_id')
		id = '_id.' + id;

	makeAgg(self._agg.$group, id);

	if (path)
		makeAgg(self._agg.$group, path);

	return self;
};

MongoBuilder.prototype.project = function(path) {
	var self = this;

	if (!self._agg)
		self._agg = {};

	if (!self._agg.$project)
		self._agg.$project = {};

	makeAgg(self._agg.$project, path);
	return self;
};

MongoBuilder.prototype.unwind = function(path) {
	var self = this;

	if (!self._agg)
		self._agg = {};

	if (path[0] !== '$')
		path = '$' + path;

	self._agg.$unwind = path;
	return self;
};

function makeAgg(obj, path) {

	var arr = path.split('.');
	var value = arr.pop();
	var length = arr.length;

	if (value === '1' || value === '0')
		value = parseInt(value);
	else
		value = value === '' ? null : '$' + value;

	if (!obj)
		obj = {};

	if (!obj[arr[0]]) {
		if (length === 1) {
			obj[arr[0]] = value;
			return;
		}
		obj[arr[0]] = {};
	}

	var current = obj[arr[0]];

	for (var i = 1; i < length; i++) {
		var key = arr[i];

		if (!current[key]) {

			if (i === length - 1) {
				current[key] = value;
				break;
			}

			current[key] = {};
			current = current[key];
			continue;
		}

		if (i === length - 1) {
			if (current[key] instanceof Array)
				current[key].push(value);
			else
				current[key] = [current[key], value];
			break;
		}

		current = current[key];
	}
}

function readFile(db, id, callback) {
	var reader = new GridStore(db, ObjectID.parse(id), 'r');
	reader.open(function(err, fs) {

		if (err) {
			reader.close();
			reader = null;
			return callback(err);
		}

		callback(null, fs, function() {
			reader.close();
			reader = null;
		});
	});
}

function readToStream(db, id, stream, callback) {
	var reader = new GridStore(db, ObjectID.parse(id), 'r');
	reader.open(function(err, fs) {

		if (err) {
			reader.close();
			reader = null;
			if (callback)
				return callback(err);
			return;
		}

		fs.stream(true).pipe(stream).on('close', function() {
			reader.close();
			reader = null;
			if (callback)
				callback(null);
		});

		callback(null, fs, function() {
			reader.close();
			reader = null;
		});
	});
}

function writeFile(db, id, filename, name, meta, callback) {

	if (!callback)
		callback = NOOP;

	if (typeof(meta) === FUNCTION) {
		var tmp = callback;
		callback = meta;
		meta = tmp;
	}

	var arg = [];
	var grid = new GridStore(db, id ? id : new ObjectID(), name, 'w', { metadata: meta });

	grid.open(function(err, fs) {

		if (err) {
			grid.close();
			grid = null;
			return callback(err);
		}

		grid.writeFile(filename, function(err) {
			if (err)
				return callback(err);
			callback(null);
			grid.close();
			grid = null;
		});
	});
}

function writeBuffer(db, id, buffer, name, meta, callback) {

	if (!callback)
		callback = NOOP;

	if (typeof(meta) === FUNCTION) {
		var tmp = callback;
		callback = meta;
		meta = tmp;
	}

	var arg = [];
	var grid = new GridStore(db, id ? id : new ObjectID(), name, 'w', { metadata: meta });

	grid.open(function(err, fs) {

		if (err) {
			grid.close();
			grid = null;
			return callback(err);
		}

		grid.write(buffer, function(err) {
			if (err)
				return callback(err);
			callback(null);
			grid.close();
			grid = null;
		});
	});
}

function extend(target, source, id) {
	for (var m in source) {
		if (m[0] === '$')
			continue;
		if (id && m === '_id')
			continue;
		var val = source[m];
		if (typeof(val) === 'function')
			continue;
		target[m] = val;
	}
}

exports.init = function(options, callback) {
	require('mongodb').MongoClient.connect(options, callback);
};

GridStore.readFile = readFile;
GridStore.writeFile = writeFile;
GridStore.writeBuffer = writeBuffer;
exports.MongoBuilder = MongoBuilder;
global.MongoBuilder = MongoBuilder;