var database = require('mssql');
var Events = require('events');
var Parser = require('url');
var queries = {};
var columns_cache = {};
var pools_cache = {};

require('./index');

function SqlBuilder(skip, take, aget) {
	this.agent = agent;
	this.builder = [];
	this._order = null;
	this._skip = skip >= 0 ? skip : 0;
	this._take = take >= 0 ? take : 0;
	this._set = null;
	this._define;
	this._fn;
	this._join;
	this._fields;
	this._schema;
	this._primary;
	this._group;
	this._having;
	this._is = false;
	this.hasOperator = false;
}

SqlBuilder.prototype = {
	get data() {
		return this._set;
	}
};

SqlBuilder.prototype.replace = function(builder) {
	var self = this;

	self.builder = builder.builder.slice(0);

	if (builder._order)
		self._order = builder._order.slice(0);

	self._skip = builder._skip;
	self._take = builder._take;

	if (builder._set)
		self._set = copy(builder._set);

	if (builder._fn)
		self._fn = copy(builder._fn);

	if (builder._join)
		self._join = builder._join.slice(0);

	if (builder._fields)
		self._fields = builder._fields;

	if (builder._schema)
		self._schema = builder._schema;

	if (builder._primary)
		self._primary = builder._primary;

	self._is = builder._is;
	self.hasOperator = builder.hasOperator;
	return self;
};

function copy(source) {

	var keys = Object.keys(source);
	var i = keys.length;
	var target = {};

	while (i--) {
		var key = keys[i];
		target[key] = source[key];
	}

	return target;
};

SqlBuilder.prototype.clone = function() {
	var builder = new SqlBuilder(0, 0, this);
	return builder.replace(this);
};

SqlBuilder.prototype.join = function(name, on, type) {
	var self = this;
	if (!self._join)
		self._join = [];

	if (!type)
		type = 'left'


	if (self._schema && name.lastIndexOf(' ') === -1)
		name += ' ' + self._schema;

	self._join.push(type + ' join ' + name + ' on ' + on);
	return self;
};

SqlBuilder.prototype.schema = function(name) {
	this._schema = name;
	return this;
};

SqlBuilder.prototype.remove = SqlBuilder.prototype.rem = function(name) {
	if (this._set)
		delete this._set[name]
	return this;
};

SqlBuilder.prototype.prepare = function(query) {
	if (this._skip === 0 && this._take > 0)
		return query.replace(/select/i, 'SELECT TOP ' + this._take);
	return query;
};

SqlBuilder.prototype.define = function(name, type) {
	var self = this;
	if (!self._define)
		self._define = {};
	self._define[name] = type;
	return self;
};

SqlBuilder.prototype.set = function(name, value) {
	var self = this;
	if (!self._set)
		self._set = {};

	if (typeof(name) === 'string') {
		self._set[name] = value === '$' ? '#00#' : value;
		return self;
	}

	var keys = Object.keys(name);

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		var val = name[key];
		self._set[key] = val === '$' ? '#00#' : val;
	}

	return self;
};

SqlBuilder.prototype.raw = function(name, value) {
	var self = this;
	if (!self._set)
		self._set = {};
	self._set['!' + name] = value;
	return self;
};

SqlBuilder.prototype.inc = function(name, type, value) {

	var self = this;
	var can = false;

	if (!self._set)
		self._set = {};

	if (value === undefined) {
		value = type;
		type = '+';
		can = true;
	}

	if (typeof(name) === 'string') {

		if (can && typeof(value) === 'string') {
			type = value[0];
			value = parseInt(value.substring(1));
			if (isNaN(value))
				return self;
		}

		if (value === 0)
			return self;

		name = type + name;
		self._set[name] = value === '$' ? '#00#' : value;
		return self;
	}

	var keys = Object.keys(name);

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		var val = name[key];

		if (can && typeof(val) === 'string') {
			type = val[0];
			val = parseInt(val.substring(1));
			if (isNaN(val))
				continue;
		}

		if (val === 0)
			continue;

		key = type + key;
		self._set[key] = val === '$' ? '#00#' : val;
	}

	return self;
};

SqlBuilder.prototype.sort = function(name, desc) {
	return this.order(name, desc);
};

SqlBuilder.prototype.order = function(name, desc) {

	var self = this;
	if (self._order === null)
		self._order = [];

	var lowered = name.toLowerCase();

	if (lowered.lastIndexOf('desc') !== -1 || lowered.lastIndexOf('asc') !== -1) {
		self._order.push(SqlBuilder.column(name, self._schema));
		return self;
	} else if (typeof(desc) === 'boolean')
		desc = desc === true ? 'DESC' : 'ASC';
	else
		desc = 'ASC';

	self._order.push(SqlBuilder.column(name, self._schema) + ' ' + desc);
	return self;
};

SqlBuilder.prototype.skip = function(value) {
	var self = this;
	self._skip = self.parseInt(value);
	return self;
};

SqlBuilder.prototype.limit = function(value) {
	return this.take(value);
};

SqlBuilder.prototype.page = function(value, max) {
	var self = this;
	value = self.parseInt(value) - 1;
	max = self.parseInt(max);
	if (value < 0)
		value = 0;
	self._skip = value * max;
	self._take = max;
	return self;
};

SqlBuilder.prototype.parseInt = function(num) {
	if (typeof(num) === 'number')
		return num;
	if (!num)
		return 0;
	num = parseInt(num);
	if (isNaN(num))
		num = 0;
	return num;
};

SqlBuilder.prototype.take = function(value) {
	var self = this;
	self._take = self.parseInt(value);
	return self;
};

SqlBuilder.prototype.first = function() {
	var self = this;
	self._skip = 0;
	self._take = 1;
	return self;
};

SqlBuilder.prototype.where = function(name, operator, value) {
	return this.push(name, operator, value);
};

SqlBuilder.prototype.push = function(name, operator, value) {
	var self = this;

	if (value === undefined) {
		value = operator;
		operator = '=';
	} else if (operator === '!=')
		operator = '<>';

	var is = false;

	// I expect Agent.$$
	if (typeof(value) === 'function') {
		if (!self._fn)
			self._fn = {};
		var key = Math.floor(Math.random() * 1000000);
		self._fn[key] = value;
		value = '#' + key + '#';
		is = true;
	}

	self.checkOperator();
	self.builder.push(SqlBuilder.column(name, self._schema) + operator + (is ? value : SqlBuilder.escape(value)));
	self._is = true;
	return self;
};

SqlBuilder.prototype.checkOperator = function() {
	var self = this;
	if (!self.hasOperator)
		self.and();
	self.hasOperator = false;
	return self;
};

SqlBuilder.prototype.clear = function() {
	this._take = 0;
	this._skip = 0;
	this._order = null;
	this._set = null;
	this.builder = [];
	this.hasOperator = false;
	return this;
};

SqlBuilder.prototype.fields = function() {
	var self = this;
	if (!self._fields)
		self._fields = '';

	if (arguments[0] instanceof Array) {
		var arr = arguments[0];
		for (var i = 0, length = arr.length; i < length; i++)
			self._fields += (self._fields ? ',' : '') + SqlBuilder.column(arr[i], self._schema);
		return self;
	}

	for (var i = 0; i < arguments.length; i++)
		self._fields += (self._fields ? ',' : '') + SqlBuilder.column(arguments[i], self._schema);
	return self;
};

SqlBuilder.prototype.field = function(name) {
	var self = this;
	if (!self._fields)
		self._fields = '';
	self._fields += (self._fields ? ',' : '') + SqlBuilder.column(name, self._schema);
	return self;
};

SqlBuilder.escape = SqlBuilder.prototype.escape = function(value) {

	if (value === null || value === undefined)
		return 'null';

	var type = typeof(value);

	if (type === 'function') {
		value = value();

		if (value === null || value === undefined)
			return 'null';

		type = typeof(value);
	}

	if (type === 'boolean')
		return value === true ? '1' : '0';

	if (type === 'number')
		return value.toString();

	if (type === 'string')
		return SqlBuilder.escaper(value);

	if (value instanceof Array)
		return SqlBuilder.escaper(value.join(','));

	if (value instanceof Date)
		return dateToString(value);

	return SqlBuilder.escaper(value.toString());
};

SqlBuilder.escaper = function(value) {
	return "'" + value.replace(/\'/g, '\'\'') + "'";
};

SqlBuilder.column = function(name, schema) {

	var cachekey = (schema ? schema + '.' : '') + name;
	var val = columns_cache[cachekey];
	if (val)
		return val;

	var raw = false;

	if (name[0] === '!') {
		raw = true;
		name = name.replace(/^(\!{1,}|\s)*/, '');
	}

	var index = name.lastIndexOf('-->');
	var cast = '';
	var casting = function(value) {
		if (!cast)
			return value;
		return 'CAST(' + value + cast + ')';
	};

	if (index !== -1) {
		cast = name.substring(index).replace('-->', '').trim();
		name = name.substring(0, index).trim();
		switch (cast) {
			case 'integer':
			case 'int':
			case 'byte':
			case 'smallint':
			case 'number':
				cast = 'INT';
				break;
			case 'float':
			case 'real':
			case 'double':
			case 'decimal':
			case 'currency':
				cast = 'REAL';
				break;
			case 'boolean':
			case 'bool':
				cast = 'BIT';
				break;
		}
		cast = ' AS ' + cast;
	}

	var indexAS = name.toLowerCase().indexOf(' as');
	var plus = '';

	if (indexAS !== -1) {
		plus = name.substring(indexAS);
		name = name.substring(0, indexAS);
	} else if (cast)
		plus = ' as [' + name + ']';

	if (raw)
		return columns_cache[cachekey] = casting(name) + plus;

	name = name.replace(/\[|\]/g, '');
	index = name.indexOf('.');

	if (index === -1)
		return columns_cache[cachekey] = casting((schema ? schema + '.' : '') + '[' + name + ']') + plus;
	return columns_cache[cachekey] = casting(name.substring(0, index) + '.[' + name.substring(index + 1) + ']') + plus;
};

SqlBuilder.prototype.group = function(names) {
	var self = this;

	if (names instanceof Array) {
		for (var i = 0, length = names.length; i < length; i++)
			names[i] = SqlBuilder.column(names[i], self._schema);
		self._group = 'GROUP BY ' + names.join(',');
	} else if (names) {
		var arr = new Array(arguments.length);
		for (var i = 0; i < arguments.length; i++)
			arr[i] = SqlBuilder.column(arguments[i.toString()], self._schema);
		self._group = 'GROUP BY ' + arr.join(',');
	} else
		delete self._group;

	return self;
};

SqlBuilder.prototype.having = function(condition) {
	var self = this;

	if (condition)
		self._having = 'HAVING ' + condition;
	else
		delete self._having;

	return self;
};

SqlBuilder.prototype.and = function() {
	var self = this;
	if (self.builder.length === 0)
		return self;
	self.hasOperator = true;
	self.builder.push('AND');
	return self;
};

SqlBuilder.prototype.or = function() {
	var self = this;
	if (self.builder.length === 0)
		return self;
	self.hasOperator = true;
	self.builder.push('OR');
	return self;
};

SqlBuilder.prototype.scope = function(fn) {
	var self = this;
	self.checkOperator();
	self.builder.push('(');
	self.hasOperator = true;
	fn.call(self);
	self.builder.push(')');
	return self;
};

SqlBuilder.prototype.in = function(name, value) {
	var self = this;
	if (!(value instanceof Array)) {
		self.where(name, value);
		return self;
	}
	self.checkOperator();
	var values = [];
	for (var i = 0, length = value.length; i < length; i++)
		values.push(SqlBuilder.escape(value[i]));
	self.builder.push(SqlBuilder.column(name, self._schema) + ' IN (' + values.join(',') + ')');
	self._is = true;
	return self;
};

SqlBuilder.prototype.like = function(name, value, where) {
	var self = this;
	var search;

	self.checkOperator();

	switch (where) {
		case 'beg':
		case 'begin':
			search = SqlBuilder.escape('%' + value);
			break;
		case '*':
			search = SqlBuilder.escape('%' + value + '%');
			break;
		case 'end':
			search = SqlBuilder.escape(value + '%');
			break;
		default:
			search = SqlBuilder.escape(value);
			break;
	}

	self.builder.push(SqlBuilder.column(name, self._schema) + ' LIKE ' + search);
	self._is = true;
	return self;
};

SqlBuilder.prototype.between = function(name, valueA, valueB) {
	var self = this;
	self.checkOperator();
	self.builder.push(SqlBuilder.column(name, self._schema) + ' BETWEEN ' + SqlBuilder.escape(valueA) + ' AND ' + SqlBuilder.escape(valueB));
	self._is = true;
	return self;
};

SqlBuilder.prototype.sql = function(sql) {
	var self = this;
	self.checkOperator();

	if (arguments.length > 1) {
		var indexer = 1;
		var argv = arguments;
		sql = sql.replace(/\?/g, function() {
			return SqlBuilder.escape(argv[indexer++]);
		});
	}

	self.builder.push(sql);
	self._is = true;
	return self;
};

SqlBuilder.prototype.toString = function(id) {

	var self = this;
	var plus = '';
	var order = '';
	var join = '';

	if (self._join)
		join = self._join.join(' ') + ' ';

	if (self._order)
		order = ' ORDER BY ' + self._order.join(',');

	if (self._skip > 0 && self._take > 0)
		plus = ' OFFSET ' + self._skip + ' ROWS FETCH NEXT ' + self._take + ' ROWS ONLY';
	else if (self._take > 0)
		plus = ' FETCH NEXT ' + self._take + ' ROWS ONLY';
	else if (self._skip > 0)
		plus = ' OFFSET ' + self._skip + ' ROWS';

	if (!self._order && plus.length > 0)
		throw new Error('ORDER BY is missing.');

	if (self.builder.length === 0)
		return (join ? join + ' ' : '') + (self._group ? ' ' + self._group : '') + (self._having ? ' ' + self._having : '') + order + plus;

	var where = self.builder.join(' ');

	if (id === undefined || id === null)
		id = null;

	if (self._fn) {
		where = where.replace(/\#\d+\#/g, function(text) {
			if (text === '#00#')
				return SqlBuilder.escape(id);
			var output = self._fn[parseInt(text.substring(1, text.length - 1))];
			return SqlBuilder.escape(output);
		});
	}

	return (join ? ' ' + join : '') + (self._is ? ' WHERE ' : ' ') + where + (self._group ? ' ' + self._group : '') + (self._having ? ' ' + self._having : '') + order + plus;
};

SqlBuilder.prototype.make = function(fn) {
	var self = this;
	fn.call(self, self)
	return self.agent || self;
};

SqlBuilder.prototype.toQuery = function(query) {
	var self = this;
	if (!self._fields)
		return query;
	return query.replace(/\*/i, self._fields);
};

function Agent(options, error, id) {
	this.$conn = id === undefined ? JSON.stringify(options) : id;
	this.options = options;
	this.command = [];
	this.db = null;
	this.done = null;
	this.last = null;
	this.id = null;
	this.$id = null;
	this.isCanceled = false;
	this.index = 0;
	this.isPut = false;
	this.skipCount = 0;
	this.skips = {};
	this.isErrorBuilder = typeof(global.ErrorBuilder) !== 'undefined' ? true : false;
	this.errors = this.isErrorBuilder ? error : null;
	this.time;
	this.$transaction;
	this.$fast = false;
	this.results = {};
}

Agent.prototype = {
	get $() {
		return new SqlBuilder(0, 0, this);
	},
	get $$() {
		var self = this;
		return function() {
			return self.$id;
		};
	}
};

Agent.prototype.__proto__ = Object.create(Events.EventEmitter.prototype, {
	constructor: {
		value: Agent,
		enumberable: false
	}
});

// Debug mode (output to console)
Agent.debug = false;

Agent.prototype.default = function(fn) {
	fn.call(this.results, this.results);
	return this;
};

Agent.query = function(name, query) {
	queries[name] = query;
	return Agent;
};

Agent.prototype.nolock = function(enable) {
	if (enable === undefined)
		this.$fast = true;
	else
		this.$fast = false;
	return this;
};

Agent.prototype.primaryKey = Agent.prototype.primary = function(name) {
	// compatibility with PG
	return this;
};

Agent.prototype.skip = function(name) {

	var self = this;

	if (!name) {
		self.skipCount++;
		return self;
	}

	self.skips[name] = true;
	return self;
};

Agent.prototype.prepare = function(fn) {
	var self = this;
	self.command.push({ type: 'prepare', fn: fn });
	return self;
};

Agent.prototype.ifnot = function(name, fn) {
	var self = this;
	self.prepare(function(error, response, resume) {
		if (response[name])
			return resume();
		fn.call(self, error, response);
		resume();
	});
	return self;
};

Agent.prototype.ifexists = function(name, fn) {
	var self = this;
	self.prepare(function(error, response, resume) {
		if (!response[name])
			return resume();
		fn.call(self, error, response);
		resume();
	});
	return self;
};

Agent.prototype.modify = function(fn) {
	var self = this;
	self.command.push({ type: 'modify', fn: fn });
	return self;
};

Agent.prototype.bookmark = function(fn) {
	var self = this;
	self.command.push({ type: 'bookmark', fn: fn });
	return self;
};

Agent.prototype.put = function(value) {
	var self = this;
	self.command.push({ type: 'put', params: value, disable: value === undefined || value === null });
	return self;
};

Agent.prototype.lock = function() {
	return this.put(this.$$);
};

Agent.prototype.unlock = function() {
	this.command.push({ 'type': 'unput' });
	return this;
};

Agent.prototype.query = function(name, query, params) {
	return this.push(name, query, params);
};

Agent.prototype.push = function(name, query, params) {
	var self = this;

	if (typeof(query) !== 'string') {
		params = query;
		query = name;
		name = self.index++;
	}

	var is = false;

	if (!params) {
		is = true;
		params = new SqlBuilder(0, 0, self);
	}

	if (queries[query])
		query = queries[query];

	self.command.push({ name: name, query: query, params: params, first: isFIRST(query) });
	return is ? params : self;
};

Agent.prototype.validate = function(fn, error, reverse) {
	var self = this;
	var type = typeof(fn);

	if (typeof(error) === 'boolean') {
		reverse = error;
		error = undefined;
	}

	if (type === 'string' && error === undefined) {
		// checks the last result
		error = fn;
		fn = undefined;
	}

	if (type === 'function') {
		self.command.push({ type: 'validate', fn: fn, error: error });
		return self;
	}

	var exec;

	if (reverse) {
		exec = function(err, results, next) {
			var id = fn === undefined || fn === null ? self.last : fn;
			if (id === null || id === undefined)
				return next(true);
			var r = results[id];
			if (r instanceof Array)
				return next(r.length === 0);
			if (r)
				return next(false);
			next(true);
		};
	} else {
		exec = function(err, results, next) {
			var id = fn === undefined || fn === null ? self.last : fn;
			if (id === null || id === undefined)
				return next(false);
			var r = results[id];
			if (r instanceof Array)
				return next(r.length > 0);
			if (r)
				return next(true);
			next(false);
		};
	}

	self.command.push({ type: 'validate', fn: exec, error: error });
	return self;
};

Agent.prototype.cancel = function(fn) {
	return this.validate(fn);
};

Agent.prototype.begin = function() {
	var self = this;
	self.command.push({ type: 'begin' });
	return self;
};

Agent.prototype.end = function() {
	var self = this;
	self.command.push({ type: 'end' });
	return self;
};

Agent.prototype.commit = function() {
	return this.end();
};

function prepareValue(value) {

	if (value === undefined || value === null)
		return null;

	var type = typeof(value);

	if (type === 'function')
		return value();

	if (type === 'string')
		return value.trim();

	return value;
}

Agent.prototype._insert = function(item) {

	var self = this;
	var name = item.name;
	var values = item.values;
	var table = item.table;
	var isPrepare = false;

	if (values instanceof SqlBuilder) {
		isPrepare = values._define ? true : false;
		values = values._set;
	}

	var keys = Object.keys(values);

	var columns = [];
	var columns_values = [];
	var params = [];
	var index = 1;

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		var value = values[key];

		var isRAW = key[0] === '!';
		if (isRAW)
			key = key.substring(1);

		if (item.without && item.without.indexOf(key) !== -1)
			continue;

		if (key[0] === '$')
			continue;

		switch (key[0]) {
			case '+':
			case '-':
			case '*':
			case '/':
				key = key.substring(1);
				if (!value)
					value = 1;
				break;
		}

		columns.push('[' + key + ']');

		if (isRAW) {
			columns_values.push(value);
			continue;
		}

		columns_values.push('@' + key);

		var type = typeof(value);
		var isFN = false;

		if (type === 'function')
			value = value();

		if (type === 'string')
			value = value.trim();

		if (type === 'function')
			isFN = true;

		if (type === 'object') {
			if (Buffer.isBuffer(value))
				type = 'varbinary';
			else if (typeof(value.getTime) === 'function')
				type = 'datetime';
		}

		if (isPrepare) {
			if (item.values._define[key])
				type = item.values._define[key];
		}

		params.push({ name: key, type: type, value: value === undefined ? null : value, isFN: isFN });
	}

	return { type: item.type, name: name, query: 'INSERT INTO ' + table + ' (' + columns.join(',') + ') VALUES(' + columns_values.join(',') + '); SELECT @@identity AS [identity]', params: params, first: true };
};

Agent.prototype._update = function(item) {

	var name = item.name;
	var values = item.values;

	if (values instanceof SqlBuilder)
		values = values._set;

	var condition = item.condition;
	var table = item.table;
	var keys = Object.keys(values);

	var columns = [];
	var params = [];
	var index = 1;

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		var value = values[key];

		var isRAW = key[0] === '!';
		if (isRAW)
			key = key.substring(1);

		if (item.without && item.without.indexOf(key) !== -1)
			continue;

		if (key[0] === '$')
			continue;

		var type = typeof(value);
		if (type === 'function')
			value = value();

		if (type === 'string')
			value = value.trim();

		switch (key[0]) {
			case '+':
				key = key.substring(1);
				columns.push('[' + key + ']=ISNULL([' + key + '],0)+@' + key);
				if (!value)
					value = 1;
				break;
			case '-':
				key = key.substring(1);
				columns.push('[' + key + ']=ISNULL([' + key + '],0)-@' + key);
				if (!value)
					value = 1;
				break;
			case '*':
				key = key.substring(1);
				columns.push('[' + key + ']=ISNULL([' + key + '],0)*@' + key);
				if (!value)
					value = 1;
				break;
			case '/':
				key = key.substring(1);
				columns.push('[' + key + ']=ISNULL([' + key + '],0)/@' + key);
				if (!value)
					value = 1;
				break;
			default:
				if (isRAW)
					columns.push('[' + key + ']=' + value);
				else
					columns.push('[' + key + ']=@' + key);
				break;
		}

		if (!isRAW)
			params.push({ name: key, type: type, value: value === undefined ? null : value });
	}

	return { type: item.type, name: name, query: 'UPDATE ' + table + ' SET ' + columns.join(',') + condition.toString(this.id) + '; SELECT @@rowcount As affectedRows', params: params, first: true, column: 'affectedRows' };
};

Agent.prototype._select = function(item) {
	return { name: item.name, query: item.condition.toQuery(item.query) + item.condition.toString(this.id), params: null, first: item.condition._take === 1, datatype: item.datatype };
};

Agent.prototype._delete = function(item) {
	return { name: item.name, query: item.query + item.condition.toString(this.id) + '; SELECT @@rowcount As affectedRows', params: null, first: true, column: 'affectedRows' };
};

Agent.prototype.save = function(name, table, insert, maker) {

	if (typeof(table) === 'boolean') {
		maker = insert;
		insert = table;
		table = name;
		name = undefined;
	}

	var self = this;
	if (insert)
		maker(self.insert(name, table), true);
	else
		maker(self.update(name, table), false);

	return self;
};

Agent.prototype.insert = function(name, table, values, without) {

	var self = this;

	if (typeof(table) !== 'string') {
		without = values;
		values = table;
		table = name;
		name = self.index++;
	}

	if (values instanceof Array) {
		var tmp = without;
		without = values;
		values = tmp;
	}

	var is = false;
	if (!values) {
		is = true;
		values = new SqlBuilder(0, 0, self);
	}

	self.command.push({ type: 'insert', table: table, name: name, values: values, without: without });
	return is ? values : self;
};

Agent.prototype.select = function(name, table, schema, without, skip, take) {

	var self = this;
	if (typeof(table) !== 'string') {
		take = skip;
		skip = without;
		without = schema;
		schema = table;
		table = name;
		name = self.index++;
	}

	if (!schema)
		schema = '*';

	var condition = new SqlBuilder(skip, take, self);
	var columns;

	if (schema instanceof Array) {
		columns = schema;
	} else if (typeof(schema) === 'string') {
		columns = [schema];
	} else {
		columns = [];
		var arr = Object.keys(schema);
		for (var i = 0, length = arr.length; i < length; i++) {
			if (without && without.indexOf(arr[i]) !== -1)
				continue;
			if (arr[i][0] === '$')
				continue;
			columns.push(SqlBuilder.column(arr[i]));
		}
	}

	self.command.push({ type: 'select', query: 'SELECT ' + columns.join(',') + ' FROM ' + table + (self.$fast ? ' WITH (NOLOCK)' : ''), name: name, without: without, condition: condition });
	return condition;
};

Agent.prototype.builder = function(name) {
	var self = this;
	for (var i = 0, length = self.command.length; i < length; i++) {
		var command = self.command[i];
		if (command.name === name)
			return command.values ? command.values : command.condition;
	}
};

Agent.prototype.exists = function(name, table) {
	var self = this;

	if (typeof(table) !== 'string') {
		table = name;
		name = self.index++;
	}

	var condition = new SqlBuilder(0, 0, self);
	condition.first();
	self.command.push({ type: 'query', query: 'SELECT 1 as sqlagentcolumn_e FROM ' + table, name: name, condition: condition, first: true, column: 'sqlagentcolumn_e' });
	return condition;
};

Agent.prototype.count = function(name, table, column) {
	var self = this;

	if (typeof(table) !== 'string') {
		table = name;
		name = self.index++;
	}

	if (!column)
		column = '*';

	var condition = new SqlBuilder(0, 0, self);
	self.command.push({ type: 'query', query: 'SELECT COUNT(' + column + ') as sqlagentcolumn FROM ' + table, name: name, condition: condition, first: true, column: 'sqlagentcolumn', datatype: 1 });
	return condition;
};

Agent.prototype.max = function(name, table, column) {
	var self = this;
	if (typeof(table) !== 'string') {
		table = name;
		name = self.index++;
	}

	var condition = new SqlBuilder(0, 0, self);
	self.command.push({ type: 'query', query: 'SELECT MAX(' + column + ') as sqlagentcolumn FROM ' + table, name: name, condition: condition, first: true, column: 'sqlagentcolumn', datatype: 1 });
	return condition;
};

Agent.prototype.min = function(name, table, column) {
	var self = this;
	if (typeof(table) !== 'string') {
		table = name;
		name = self.index++;
	}

	var condition = new SqlBuilder(0, 0, self);
	self.command.push({ type: 'query', query: 'SELECT MAX(' + column + ') as sqlagentcolumn FROM ' + table, name: name, condition: condition, first: true, column: 'sqlagentcolumn', datatype: 1 });
	return condition;
};

Agent.prototype.avg = function(name, table, column) {
	var self = this;
	if (typeof(table) !== 'string') {
		table = name;
		name = self.index++;
	}

	var condition = new SqlBuilder(0, 0, self);
	self.command.push({ type: 'query', query: 'SELECT AVG(' + column + ') as sqlagentcolumn FROM ' + table, name: name, condition: condition, first: true, column: 'sqlagentcolumn', datatype: 1 });
	return condition;
};

Agent.prototype.updateOnly = function(name, table, values, only) {

	var model = {};

	if (values instanceof SqlBuilder)
		values = values._set;

	for (var i = 0, length = only.length; i < length; i++) {
		var key = only[i];
		model[key] = values[i] === undefined ? null : values[i];
	}

	return this.update(name, table, model, null);
};

Agent.prototype.update = function(name, table, values, without) {

	var self = this;

	if (typeof(table) !== 'string') {
		without = values;
		values = table;
		table = name;
		name = self.index++;
	}

	if (values instanceof Array) {
		var tmp = without;
		without = values;
		values = tmp;
	}

	var condition;

	if (values instanceof SqlBuilder)
		condition = values;
	else
		condition = new SqlBuilder(0, 0, self);

	if (!values)
		values = condition;

	self.command.push({ type: 'update', table: table + (self.$fast ? ' WITH (ROWLOCK)' : ''), name: name, values: values, without: without, condition: condition });
	return condition;
};

Agent.prototype.delete = function(name, table) {

	var self = this;

	if (typeof(table) !== 'string') {
		table = name;
		name = self.index++;
	}

	var condition = new SqlBuilder(0, 0, self);
	self.command.push({ type: 'delete', query: 'DELETE FROM ' + table + (self.$fast ? ' WITH (ROWLOCK)' : ''), name: name, condition: condition });
	return condition;
};

Agent.prototype.remove = function(name, table) {
	return this.delete(name, table);
};

Agent.prototype.destroy = function(name) {
	var self = this;
	for (var i = 0, length = self.command.length; i < length; i++) {
		var item = self.command[i];
		if (item.name !== name)
			continue;
		self.command.splice(i, 1);
		return true;
	}
	return false;
};

Agent.prototype.expected = function(name, index, property) {

	var self = this;

	if (typeof(index) === 'string') {
		property = index;
		index = undefined;
	}

	return function() {
		var output = self.results[name];
		if (!output)
			return null;
		if (index === undefined) {
			if (property === undefined)
				return output;
			return output[property];
		}
		output = output[index];
		if (output)
			return output[property];
		return null;
	};
};

Agent.prototype.close = function() {
	var self = this;
	if (self.done)
		self.done();
	self.done = null;
	return self;
};

Agent.prototype.rollback = function(where, e, next) {
	var self = this;

	if (self.errors)
		self.errors.push(e);

	self.command.length = 0;
	if (!self.isTransaction)
		return next();
	self.isRollback = true;
	self.end();
	next();
};

Agent.prototype._prepare = function(callback) {

	var self = this;

	self.isRollback = false;
	self.isTransaction = false;

	if (!self.errors)
		self.errors = self.isErrorBuilder ? new global.ErrorBuilder() : [];

	self.command.sqlagent(function(item, next) {

		if (item.type === 'validate') {
			try {
				item.fn(self.errors, self.results, function(output) {
					if (output === true || output === undefined)
						return next();
					// reason
					if (typeof(output) === 'string')
						self.errors.push(output);
					else if (item.error)
						self.errors.push(item.error);

					// we have error
					if (self.isTransaction) {
						self.command.length = 0;
						self.isRollback = true;
						self.end();
						next();
					} else
						next(false);
				});
			} catch (e) {
				self.rollback('validate', e, next);
			}
			return;
		}

		if (item.type === 'bookmark') {
			try {
				item.fn(self.errors, self.results);
				return next();
			} catch (e) {
				self.rollback('bookmark', e, next);
			}
		}

		if (item.type === 'modify') {
			try {
				item.fn(self.results);
				next();
			} catch (e) {
				self.rollback('modify', e, next);
			}
			return;
		}

		if (item.type === 'prepare') {
			try {
				item.fn(self.errors, self.results, function() {
					next();
				});
			} catch (e) {
				self.rollback('prepare', e, next);
			}
			return;
		}

		if (item.type === 'unput') {
			self.isPut = false;
			next();
			return;
		}

		if (item.type === 'put') {
			if (item.disable)
				self.$id = null;
			else
				self.$id = typeof(item.params) === 'function' ? item.params() : item.params;
			self.isPut = !self.disable;
			next();
			return;
		}

		if (self.skipCount > 0) {
			self.skipCount--;
			next();
			return;
		}

		if (typeof(item.name) === 'string') {
			if (self.skips[item.name] === true) {
				next();
				return;
			}
		}

		var current;

		switch (item.type) {
			case 'update':
				current = self._update(item);
				break;
			case 'insert':
				current = self._insert(item);
				break;
			case 'select':
				current = self._select(item);
				break;
			case 'delete':
				current = self._delete(item);
				break;
			default:
				current = item;
				break;
		}

		if (current.params instanceof SqlBuilder) {
			current.query = current.params.prepare(current.query) + current.params.toString(self.$id);
			current.params = undefined;
		}

		if (current.condition instanceof SqlBuilder)
			current.query = current.query + current.condition.toString(self.id);

		var query = function(err, rows) {
			if (err) {
				self.errors.push(err.message);
				if (self.isTransaction)
					self.isRollback = true;
			} else {

				if (current.type === 'insert') {
					self.id = rows.length > 0 ? rows[0].identity : null;
					if (self.isPut === false)
						self.$id = self.id;
				}

				if (current.first && current.column) {
					if (rows.length > 0)
						self.results[current.name] = current.column === 'sqlagentcolumn_e' ? true : current.datatype === 1 ? parseFloat(rows[0][current.column] || 0) : rows[0][current.column];
				}
				else if (current.first)
					self.results[current.name] = rows instanceof Array ? rows[0] : rows;
				else
					self.results[current.name] = rows;
				self.emit('data', current.name, self.results);
			}
			self.last = item.name;
			next();
		};

		if (item.type !== 'begin' && item.type !== 'end') {
			if (!current.first)
				current.first = isFIRST(current.query);

			if (Agent.debug)
				console.log(self.debugname, current.name, current.query);

			self.emit('query', current.name, current.query, current.params);
			var request = new database.Request(self.$transaction ? self.$transaction : self.db);
			if (current.params)
				prepare_params_request(request, current.params);
			request.query(current.query, query);
			return;
		}

		if (item.type === 'begin') {

			if (Agent.debug)
				console.log(self.debugname, 'begin transaction');

			self.$transaction = new database.Transaction(self.db);
			self.$transaction.begin(function(err) {
				if (err) {
					self.errors.push(err.message);
					self.command.length = 0;
					next(false);
					return;
				}
				self.isTransaction = true;
				self.isRollback = false;
				next();
			});
			return;
		}

		if (item.type === 'end') {
			self.isTransaction = false;
			if (self.isRollback) {

				if (Agent.debug)
					console.log(self.debugname, 'rollback transaction');

				self.$transaction.rollback(function(err) {
					self.$transaction = null;
					if (!err)
						return next();
					self.command.length = 0;
					self.push(err.message);
					self.$transaction = null;
					next(false);
				});
				return;
			}

			if (Agent.debug)
				console.log(self.debugname, 'commit transaction');

			self.$transaction.commit(function(err) {

				if (!err) {
					self.$transaction = null;
					return next();
				}

				self.errors.push(err.message);
				self.command.length = 0;
				self.$transaction.rollback(function(err) {
					self.$transaction = null;
					if (!err)
						return next();
					self.errors.push(err.message);
					next();
				});
			});
			return;
		}

	}, function() {
		self.time = Date.now() - self.debugtime;
		self.index = 0;
		if (self.done)
			self.done();
		self.done = null;
		var err = null;

		if (self.isErrorBuilder) {
			if (self.errors.hasError())
				err = self.errors;
		} else if (self.errors.length > 0)
			err = self.errors;

		if (Agent.debug)
			console.log(self.debugname, '----- done (' + self.time + ' ms)');

		self.emit('end', err, self.results, self.time);

		if (callback)
			callback(err, self.returnIndex !== undefined ? self.results[self.returnIndex] : self.results);
	});

	return self;
};

Agent.prototype.exec = function(callback, returnIndex) {

	var self = this;

	if (Agent.debug) {
		self.debugname = 'sqlagent/sqlserver (' + Math.floor(Math.random() * 1000) + ')';
		self.debugtime = Date.now();
	}

	if (returnIndex !== undefined && typeof(returnIndex) !== 'boolean')
		self.returnIndex = returnIndex;
	else
		delete self.returnIndex;

	if (self.command.length === 0) {
		if (callback)
			callback.call(self, null, {});
		return self;
	}

	if (Agent.debug)
		console.log(self.debugname, '----- exec');

	if (!pools_cache[self.$conn]) {
		if (typeof(self.options) === 'string') {
			var options = Parser.parse(self.options);
			self.options = {};
			self.options.server = options.host;
			if (options.pathname && options.pathname.length > 1)
				self.options.database = options.pathname.substring(1);
			if (options.port)
				self.options.port = options.port;
			var auth = options.auth;
			if (auth) {
				auth = auth.split(':');
				self.options.user = auth[0];
				self.options.password = auth[1];
			}
			pools_cache[self.$conn] = self.options;
		} else
			pools_cache[self.$conn] = self.options;
	} else
		self.options = pools_cache[self.$conn];

	self.db = new database.Connection(self.options, function(err) {
		if (err) {
			callback.call(self, err, null);
			return;
		}
		self._prepare(callback);
	});

	return self;
};

Agent.destroy = function() {
	var keys = Object.keys(pools_cache);
	for (var i = 0, length = keys.length; i < length; i++)
		pools_cache[keys[i]].end(function(){});
};

Agent.prototype.$$exec = function(returnIndex) {
	var self = this;
	return function(callback) {
		return self.exec(callback, returnIndex);
	};
}

function dateToString(dt) {
	var arr = [];
	arr.push(dt.getFullYear().toString());
	arr.push((dt.getMonth() + 1).toString());
	arr.push(dt.getDate().toString());
	arr.push(dt.getHours().toString());
	arr.push(dt.getMinutes().toString());
	arr.push(dt.getSeconds().toString());
	for (var i = 1, length = arr.length; i < length; i++) {
		if (arr[i].length === 1)
			arr[i] = '0' + arr[i];
	}
	return arr[0] + '-' + arr[1] + '-' + arr[2] + ' ' + arr[3] + ':' + arr[4] + ':' + arr[5];
}

function prepare_params_request(request, params) {

	if (!params)
		return;

	for (var i = 0, length = params.length; i < length; i++) {
		var param = params[i];
		var type = param.type.toLowerCase();
		var value = param.value;

		if (param.isFN) {
			value = value(params);
			type = typeof(value);
		}

		switch (type) {
			case 'number':
				request.input(param.name, value % 1 === 0 ? database.Int : database.Decimal, value);
				break;
			case 'decimal':
				request.input(param.name, database.Decimal, value);
				break;
			case 'uniqueidentifier':
			case 'guid':
				request.input(param.name, database.UniqueIdentifier, value);
				break;
			case 'money':
				request.input(param.name, database.Money, value);
				break;
			case 'float':
				request.input(param.name, database.Float, value);
				break;
			case 'bigint':
				request.input(param.name, database.BigInt, value);
				break;
			case 'smallint':
			case 'byte':
				request.input(param.name, database.SmallInt, value);
				break;
			case 'string':
			case 'nvarchar':
				request.input(param.name, database.NVarChar, value);
				break;
			case 'boolean':
			case 'bit':
				request.input(param.name, database.Bit, value);
				break;
			case 'datetime':
				request.input(param.name, database.DateTime, value);
				break;
			case 'smalldatetime':
				request.input(param.name, database.SmallDateTime, value);
				break;
			case 'binary':
				request.input(param.name, database.Binary, value);
				break;
			case 'image':
				request.input(param.name, database.Image, value);
				break;
			case 'varbinary':
				request.input(param.name, database.VarBinary, value);
				break;
			case 'varchar':
				request.input(param.name, database.VarChar, value);
				break;
			case 'text':
				request.input(param.name, database.Text, value);
				break;
			case 'ntext':
				request.input(param.name, database.NText, value);
				break;
		}
	}
}

function isFIRST(query) {
	if (!query)
		return false;
	return query.substring(0, 13).toLowerCase() === 'select top 1';
}

Agent.init = function(conn, debug) {
	Agent.debug = debug ? true : false;
	var id = JSON.stringify(conn).hash();
	framework.database = function(errorBuilder) {
		return new Agent(conn, errorBuilder, id);
	};
};

module.exports = Agent;
global.SqlBuilder = SqlBuilder;