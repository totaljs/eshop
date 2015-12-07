[![NPM version][npm-version-image]][npm-url] [![NPM downloads][npm-downloads-image]][npm-url] [![MIT License][license-image]][license-url]

# MongoBuilder

`npm install mongobuilder`

- Best use with [total.js - web application framework for node.js](https://www.totaljs.com)

## GridStore
- is a global variable

```javascript
GridStore.writeFile(DB, new ObjectID(), '/path/file.txt', 'file.txt', { 'ME':1 }, function(err) {
    // CALLBACK IS OPTIONAL
});
```

```javascript
GridStore.writeBuffer(DB, new ObjectID(), new Buffer('File content'), 'file.txt', { 'ME':1 }, function(err) {
    // CALLBACK IS OPTIONAL
});
```

```javascript
GridStore.readFile(DB, 'object-id', function(err, fs, close) {
    var writer = fs.createWriteStream('/path/file.txt');
    fs.stream(true).on('end', close).pipe(writer);
});
```

## ObjectID
- is a global variable

## ObjectID.parse(value)
- a simple static function to parse ObjectID from some value

## ObjectID.parseArray(value)
- a simple static function to parse Array of ObjectID from string array or from string (delimiter ",")

## MongoBuilder

A helper class for building filters and __it's a global variable__.

### Quering

```javascript
var builder = new MongoBuilder();
// var builder = new MongoBuilder(skip, take);

builder.between('age', 20, 30);
builder.or().where('firstname', '=', 'Peter').where('firstname', '=', 'Jozef').end();
builder.where('_id', '=', '0000', true); // true === AUTOCONVERT string to ObjectID
builder.where('isremoved', false); // default operator is "="
builder.sort('age', false); // true == ascending, false == descending

builder.field('age');
builder.field('firstname');
builder.fields('age', 'firstname', 'lastname');

// builder.between(name, min, max);
// builder.like(name, value);
// builder.regex(name, value);
// builder.or()...filter...end();
// builder.and()...filter...end();
// builder.in(name, value);
// builder.nin(name, value);
// builder.field(name, [visible]); --> visible is by default: true
// builder.fields(field1, field2, field3, ...);
// builder.where(name, operator, value);
// builder.filter(name, operator, value); --> is same as builder.where()
// builder.clear();
// builder.clearFilter([skip, take]);
// builder.clearSort();
// builder.clearAggregate();
// builder.clearSet();
// builder.clearInc();
// builder.take(number);
// builder.limit(number); --> is same as builder.take()
// builder.skip(number);
// builder.sort(name, [asc]);
// builder.page(page, max);

builder.page(3, 50); // Sets the page 3 with 50 items (max) on the page

// Execute
// Uses filter, pagination + sorting and returns cursor
builder.findCursor(COLLECTION).toArray(function(err, docs) {
    console.log(docs);
});

// Execute
// Uses filter, pagination + sorting + count() + requery collection
builder.findCount(COLLECTION, function(err, docs, count) {
    console.log(docs, count);
});

// Uses filter, pagination + sorting
builder.find(COLLECTION, function(err, docs) {
    console.log(docs);
});

// Execute
// Uses filter
builder.findOne(COLLECTION, function(err, doc) {
    console.log(doc);
});

// Execute
// Uses filter
builder.exists(COLLECTION, function(err, exists) {
    console.log(exists);
});


builder.count(COLLECTION, function(err, count) {
    console.log(count);
});

builder.distinct(COLLECTION, 'KEY', function(err, docs) {
    console.log(docs);
});
```

### Inserting

```javascript
var builder = new MongoBuilder();

// Values to insert
builder.set('_id', new ObjectID());
builder.set('firstname', 'Peter');
builder.set({ firstname: 'Peter', lastname: 'Širka' });

// Execute
builder.insert(COLLECTION, function(err, count) {
    console.log(count);
});
```

### Updating

- `_id` property is skipped automatically

```javascript
var builder = new MongoBuilder();

// Filter
builder.where('age', '>', 10);

// Update
builder.set('firstname', 'Peter');
builder.set({ firstname: 'Peter', lastname: 'Širka' });
builder.inc('countview', 1);

// builder.push(name, value)
// builder.pull(name, value)
// builder.addToSet(name, value)
// builder.pop(name, value)
// builder.unset(name, value)

// Updates only age field
// _id is skipped automatically
builder.set({ _id: ObjectID('..'), firstname: 'Peter' lastname: 'Širka', age: 30 }, ['age']);

// Skips the age field
// _id is skipped automatically
builder.set({ _id: ObjectID('..'), firstname: 'Peter' lastname: 'Širka', age: 30 }, ['age'], true);

// Execute
builder.update(COLLECTION, function(err, count) {
    console.log(count);
});

// Execute
builder.updateOne(COLLECTION, function(err, count) {
    console.log(count);
});
```

### Updating of differences

```javascript
var builder = new MongoBuilder();

// A some document from database which we will update later.
var doc = {};

// A document from the form
var form = {};

// Filter
builder.where('_id', SOME_OBJECT_ID);

// Makes a differences
// builder.diff(doc, form, ['only', 'this', 'properties']);
// builder.diff(doc, form, ['skip', 'this', 'properties'], true);
if (builder.diff(doc, form)) 
    builder.updateOne();
```

### Deleting

```javascript
var builder = new MongoBuilder();

// Filter
builder.where('age', '>', 10);

// Execute
builder.remove(COLLECTION, function(err, count) {
    console.log(count);
});

builder.removeOne(COLLECTION, function(err, count) {
    console.log(count);
});
```

### Saving

__Classic document saving__:

```javascript
// _id is need to add manually
builder.set('_id', 'MY_ID');

// Performs save
builder.save(COLLECTION, function(err, count) {
    console.log(count);
});
```

__Update or Insert__:

```javascript
// builder.ui(COLLECTION, [callback], [onInsert]);

// Performs first updateOne(), then insert
builder.ui(COLLECTION, function(err, inserted) {
    console.log(err, inserted);
});

builder.ui(COLLECTION, function(err, inserted) {
    console.log(err, inserted);
}, function(builder) {
    // OnInsert delegate
    // The delegate can change "insert" values
    builder.set('datecreated', new Date());
    builder.set('countview', 0);
});
```

### Aggregation

__$match__:

```javascript
var builder = new MongoBuilder();

builder.where('_id', '=', new ObjectID());
// { $match: { _id: 54d916f34c46f862576336a3 }}
```

__$skip and $limit__:

```javascript
builder.skip(10);
// { $skip: 10 }

builder.take(10);
// { $limit: 10 }
```

__$sort__:

```javascript
var builder = new MongoBuilder();

builder.sort('age', false);
// { $sort: { age: -1 }}
```

__$group__:

```javascript
builder.group('_id.year.year', 'count.$sum.1');
builder.group('_id.month.month');
// { $group: { _id: { year: '$year', month: '$month' }, count: { $sum: 1 }}}

builder.group('_id.', 'count.$avg.quantity');
// { $group: { _id: null, count: { $avg: '$quantity' }}}

builder.group('_id.item', 'count.$push.item');
builder.group('_id.item', 'count.$push.quantity');
// { $group: { _id: 'item', count: { $push: ['$item', '$quantity'] }}}
```

__$unwind__:

```javascript
builder.unwind('sizes');
// { $unwind: '$sizes' }}
```

__$project__:

```javascript
builder.project('title.1');
builder.project('author.1');
// { $project: { 'title': 1, 'author': 1 }}
```

__execute aggregation__:

```javascript
// builder.aggregate(collection, [options], callback);
builder.aggregate(COLLECTION, function(err, results) {
    console.log(results);
});
```

### Cloning & Merging

```javascript
var builder = new MongoBuilder();

// Filter
builder.where('age', '>', 10);

// Cloning
var newbuilder = builder.clone();
var newbuilderOnlyFilterAndSort = builder.clone(true);

newbuilder.where('firstname', 'Peter');

builder.merge(newbuilder);
// builder.merge(builder, [rewrite], [onlyFilter]);
```

### Generators

```javascript
var builder = new MongoBuilder();

// builder.$$findCount(collection, [fields]);
// builder.$$find(collection, [fields]);
// builder.$$count(collection);
// builder.$$exists(collection);
// builder.$$findOne(collection, [fields]);
// builder.$$insert(collection, [options]);
// builder.$$update(collection, [options]);
// builder.$$updateOne(collection, [options]);
// builder.$$remove(collection, [options]);
// builder.$$removeOne(collection, [options]);
// builder.$$aggregate(collection, [options]);

// Total.js example:
var users = yield sync(builder.$$find(DATABASE('users')))();
console.log(users);
```

### Extra

You can change the input arguments via delegates:

```javascript
var builder = new MongoBuilder();

builder.onFilter = function(obj) {
    
};

builder.onUpdate = function(obj) {
    // e.g. obj.$set
    // e.g. obj.$inc
};

builder.onInsert = function(obj) {
    
};

builder.onAggregate = function(obj) {
    
};
```

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: license.txt

[npm-url]: https://npmjs.org/package/mongobuilder
[npm-version-image]: https://img.shields.io/npm/v/mongobuilder.svg?style=flat
[npm-downloads-image]: https://img.shields.io/npm/dm/mongobuilder.svg?style=flat
