"use strict";

var pg = require('pg');
var Q = require('q');
var pglo = require('../lib');
var fs = require('fs');
var crypto = require('crypto');

var conString = "postgres://nodetest:nodetest@localhost/nodetest";
var testFile = "./test/test.jpg";
var testOutFile = "./test/out.jpg";
var testFileSize = fs.statSync(testFile).size;
var testBuf = new Buffer('0123456789ABCDEF', 'hex');


var createdOid;

module.exports = {
        setUp: function (callback)
        {
                pg.connect(conString, function(err, client, done)
                {
                        if (err)
                        {
                                throw err;
                        }
                        
                        this.client = client;
                        this.clientDone = done;
                        callback();
                }.bind(this));
                
        },
        tearDown: function (callback)
        {
                this.clientDone();
                this.clientDone = null;
                callback();
        },
        testCreateAndWrite: function(test)
        {
                var client = this.client;
                var testCase = this;
                
                test.expect(4);
                        
                Q.ninvoke(client, "query", "BEGIN")
                .then(function()
                {
                        var man = new pglo.LargeObjectManager(client);
                        
                        return Q.ninvoke(man, "create")
                        .then(function(oid)
                        {
                                createdOid = oid;
                                test.ok(oid);
                                test.notEqual(oid, 0);
                                
                                console.log("creating a new Large Object with oid: ", oid);
                                
                                return Q.ninvoke(man, "open", oid, pglo.LargeObjectManager.WRITE)
                                .then(function(obj)
                                {
                                        return Q.ninvoke(obj, "write", testBuf).then(function()
                                        {
                                                test.ok(true);
                                        })
                                        .then(function()
                                        {
                                                return Q.ninvoke(obj, "close");
                                        });
                                });
                        });
                })
                .then(function()
                {
                        test.ok(true);
                        return Q.ninvoke(client, "query", "COMMIT");
                })
                .fail(function(err)
                {
                        test.ifError(err);
                })
                .done(function()
                {
                        test.done();
                });      
        },
        testRead: function(test)
        {
                var oid = createdOid;
                
                var client = this.client;
                var testCase = this;
                
                test.ok(oid);
                test.expect(19);
                
                Q.ninvoke(client, "query", "BEGIN")
                .then(function()
                {
                        var man = new pglo.LargeObjectManager(client);
                        
                        return Q.ninvoke(man, "open", oid, pglo.LargeObjectManager.READ)
                        .then(function(obj)
                        {
                                return Q.ninvoke(obj, "read", 2)
                                .then(function(buf)
                                {
                                        test.ok(buf);
                                        test.equal(buf.length, 2);
                                        test.equal(buf[0], testBuf[0]);
                                        test.equal(buf[1], testBuf[1]);
                                })
                                .then(function()
                                {
                                        return Q.ninvoke(obj, "tell")
                                        .then(function(position)
                                        {
                                                test.equal(position, 2);
                                        });
                                })
                                .then(function()
                                {
                                        return Q.ninvoke(obj, "size")
                                        .then(function(size)
                                        {
                                                test.equal(size, 8);
                                        });
                                })
                                .then(function()
                                {
                                        return Q.ninvoke(obj, "tell")
                                        .then(function(position)
                                        {
                                                test.equal(position, 2, 'calling size() should not change the position');
                                        });
                                })
                                .then(function()
                                {
                                        return Q.ninvoke(obj, "read", 100)
                                        .then(function(buf)
                                        {
                                                test.equal(buf.length, 6);
                                                for (var i = 0; i < 6; ++i)
                                                {
                                                        test.equal(buf[i], testBuf[i+2]);
                                                }
                                        });
                                })
                                .then(function()
                                {
                                        return Q.ninvoke(obj, "seek", -2, pglo.LargeObject.SEEK_END);
                                })
                                .then(function()
                                {
                                        return Q.ninvoke(obj, "read", 100)
                                        .then(function(buf)
                                        {
                                                test.equal(buf.length, 2);
                                                test.equal(buf[0], testBuf[6]);
                                                test.equal(buf[1], testBuf[7]);
                                        });
                                })
                                .then(function()
                                {
                                        return Q.ninvoke(obj, "close");
                                })
                                .then(function()
                                {
                                        createdOid = null;
                                        console.log("unlinking the Large Object with oid: ", oid);
                                        return Q.ninvoke(man, "unlink", oid);
                                })
                        });
                })
                
                .then(function()
                {
                        test.ok(true);
                        return Q.ninvoke(client, "query", "COMMIT");
                })
                .fail(function(err)
                {
                        test.ifError(err);
                })
                .done(function()
                {
                        test.done();
                });
        },
        testWriteStream: function(test)
        {
                var client = this.client;
                
                test.expect(2);
                
                Q.ninvoke(client, "query", "BEGIN")
                .then(function()
                {
                        var man = new pglo.LargeObjectManager(client);
                        return Q.ninvoke(man, "createAndWritableStream");
                })
                .then(function(args)
                {
                        var oid = args[0];
                        var stream = args[1];
                        createdOid = oid;
                        var deferred = Q.defer();
                        
                        console.log("creating a new Large Object with oid: ", oid);
                        
                        var fileStream = fs.createReadStream(testFile);
                        fileStream.pipe(stream);
                        
                        stream.on('error', function(err)
                        {
                                deferred.reject(err);
                        });
                        
                        stream.on('finish', function()
                        {
                                test.ok(true);
                                deferred.resolve();
                        });
                        
                        return deferred.promise;
                })
                .then(function()
                {
                        test.ok(true);
                        return Q.ninvoke(client, "query", "COMMIT");
                })
                .fail(function(err)
                {
                        test.ifError(err);
                })
                .done(function()
                {
                        test.done();
                });
        },
        testReadStream: function(test)
        {
                var client = this.client;
                var oid = createdOid;
                var man = new pglo.LargeObjectManager(client);
                
                test.expect(4);
                
                Q.nfcall(sha256_hex, testFile)
                .then(function(origHash)
                {
                        return Q.ninvoke(client, "query", "BEGIN")
                        .then(function()
                        {
                                return Q.ninvoke(man, "openAndReadableStream", oid);
                        })
                        .then(function(args)
                        {
                                var size = args[0];
                                var stream = args[1];
                                var deferred = Q.defer();
                                
                                test.equal(size, testFileSize);
                                
                                var fileStream = fs.createWriteStream(testOutFile);
                                stream.pipe(fileStream);
                                
                                stream.on('error', function(err)
                                {
                                        deferred.reject(err);
                                });
                                
                                stream.on('end', function()
                                {
                                        test.ok(true);
                                        deferred.resolve();
                                });
                                
                                return deferred.promise;
                        })
                        .then(function()
                        {
                                return Q.nfcall(sha256_hex, testOutFile)
                        })
                        .then(function(outHash)
                        {
                                test.equal(outHash, origHash);
                        })
                        .then(function()
                        {
                                createdOid = null;
                                console.log("unlinking the Large Object with oid: ", oid);
                                return Q.ninvoke(man, "unlink", oid);
                        })
                        .then(function()
                        {
                                test.ok(true);
                                return Q.ninvoke(client, "query", "COMMIT");
                        });
                })
                .fail(function(err)
                {
                        test.ifError(err);
                })
                .done(function()
                {
                        test.done();
                });
        }
};

function sha256_hex(filename, callback)
{
        var sum = crypto.createHash('sha256');
        var s = fs.ReadStream(filename);
        
        s.on('error', function(err)
        {
                callback(err);
        });
        
        s.on('data', function(d)
        {
                sum.update(d);
        });
        
        s.on('end', function()
        {
                callback(null, sum.digest('hex'));
        });
}
