node-pg-large-object
====================
Large object support for PostgreSQL clients using the [node-postgres](https://www.npmjs.org/package/pg) library.

The API of this library resembles the JDBC library for PostgreSQL.

Installation
------------

        npm install pg-large-object

You will also need to install the [pg](https://www.npmjs.org/package/pg) library:

        npm install pg

Some of the methods in this library require PostgreSQL 9.3 (server) and up:
* LargeObject.seek()
* LargeObject.tell()
* LargeObject.size()
* LargeObject.truncate()

All other methods should work on PostgreSQL 8.4 and up.

Documentation
-------------
You can generate documentation using jsdoc:
        
        npm install -g jsdoc
        jsdoc pg-large-object/lib
        
Also see: http://www.postgresql.org/docs/9.3/static/largeobjects.html

Large Objects
-------------
Large Objects in PostgreSQL lets you store files/objects up to 4 TiB in size. The main benefit 
of using Large Objects instead of a simple column is that the data can be read and written in 
chunks (e.g. as a stream), instead of having to load the entire column into memory.

Examples
--------

Reading a large object using a stream:

```javascript
var pg = require('pg'); 
var LargeObjectManager = require('pg-large-object').LargeObjectManager;
var conString = "postgres://postgres:1234@localhost/postgres";

pg.connect(conString, function(err, client, done)
{
        if (err) 
        {
                return console.error('could not connect to postgres', err);
        }
        
        var man = new LargeObjectManager(client);
        
        // When working with Large Objects, always use a transaction
        client.query('BEGIN', function(err, result)
        {
                if (err)
                {
                        done(err);
                        return client.emit('error', err);
                }
                
                // A LargeObject oid, probably stored somewhere in one of your own tables.
                var oid = 123;
                
                // If you are on a high latency connection and working with
                // large LargeObjects, you should increase the buffer size
                var bufferSize = 16384;
                man.openAndReadableStream(oid, bufferSize, function(err, size, stream)
                {
                        if (err)
                        {
                                done(err);
                                return console.error('Unable to read the given large object', err);
                        }
                
                        console.log('Streaming a large object with a total size of ', size);
                        stream.on('end', function()
                        {
                                client.query('COMMIT', done);
                        });
                        
                        // Store it as an image
                        var fileStream = require('fs').createWriteStream('my-file.png');
                        stream.pipe(fileStream);
                });
        });
});
```


Creating a new large object using a stream:

```javascript
var pg = require('pg'); 
var LargeObjectManager = require('pg-large-object').LargeObjectManager;
var conString = "postgres://postgres:1234@localhost/postgres";

pg.connect(conString, function(err, client, done)
{
        if (err) 
        {
                return console.error('could not connect to postgres', err);
        }
        
        var man = new LargeObjectManager(client);
        
        // When working with Large Objects, always use a transaction
        client.query('BEGIN', function(err, result)
        {
                if (err)
                {
                        done(err);
                        return client.emit('error', err);
                }
                
                // If you are on a high latency connection and working with
                // large LargeObjects, you should increase the buffer size
                var bufferSize = 16384;
                man.createAndWritableStream(bufferSize, function(err, oid, stream)
                {
                        if (err)
                        {
                                done(err);
                                return console.error('Unable to create a new large object', err);
                        }
                
                        // The server has generated an oid
                        console.log('Creating a large object with the oid ', oid);
                        stream.on('finish', function()
                        {
                                // Actual writing of the large object in DB may
                                // take some time, so one should provide a
                                // callback to client.query.
                                client.query('COMMIT', done);
                        });
                        
                        // Upload an image
                        var fileStream = require('fs').createReadStream('upload-my-file.png');
                        fileStream.pipe(stream);
                });
        });
});
```

Using LargeObject methods.

```javascript
var pg = require('pg'); 
var LargeObjectManager = require('pg-large-object').LargeObjectManager;
var LargeObject = require('pg-large-object').LargeObject;
var conString = "postgres://postgres:1234@localhost/postgres";

pg.connect(conString, function(err, client, done)
{
        if (err) 
        {
                return console.error('could not connect to postgres', err);
        }
        
        var man = new LargeObjectManager(client);
        
        // When working with Large Objects, always use a transaction
        client.query('BEGIN', function(err, result)
        {
                if (err)
                {
                        done(err);
                        return client.emit('error');
                }
                
                // A LargeObject oid, probably stored somewhere in one of your own tables.
                var oid = 123;
                
                // Open with READWRITE if you would like to use
                // write() and truncate()
                man.open(oid, LargeObjectManager.READ, function(err, obj)
                {
                        if (err)
                        {
                                done(err);
                                return console.error(
                                        'Unable to open the given large object', 
                                        oid, 
                                        err);
                        }
                        
                        // Read the first 50 bytes
                        obj.read(50, function(err, buf)
                        {
                                // buf is a standard node.js Buffer
                                console.log(buf.toString('hex'));
                        });
                        
                        // pg uses a query queue, this guarantees the LargeObject
                        // will be executed in the order you call them, even if you do not 
                        // wait on the callbacks.
                        // In this library the callback for methods that only return an error
                        // is optional (such as for seek below). If you do not give a callback
                        // and an error occurs, this error will me emit()ted on the client object.
                        
                        // Set the position to byte 5000
                        obj.seek(5000, LargeObject.SEEK_SET);
                        obj.tell(function(err, position)
                        {
                                console.log(err, position); // 5000
                        });
                        obj.size(function(err, size)
                        {
                                console.log(err, size); // The size of the entire LargeObject
                        });
                        
                        // Done with the object, close it
                        obj.close();
                        client.query('COMMIT', done);
                });
        });
});
```

Testing
-------
You can test this library by running:

        npm install pg-large-object
        npm test

The test assumes that postgres://nodetest:nodetest@localhost/nodetest is a valid database.
You also need to place a large file named "test.jpg" in the test folder.

License
-------
The MIT License (MIT)

Copyright (c) 2014 Joris van der Wel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
