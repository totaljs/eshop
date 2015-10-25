"use strict";

/** @module pg-large-object/LargeObject */

/** Represents an opened large object.
  * 
  * @constructor 
  * @alias module:pg-large-object/LargeObject
  */
var LargeObject = module.exports = function(client, oid, fd)
{
        this._client = client;
        this.oid = oid;
        this._fd = fd;
};

var ReadStream = require('./ReadStream');
var WriteStream = require('./WriteStream');

/**
  * A seek from the beginning of a object
  * @constant {Number}
  */
LargeObject.SEEK_SET = 0;

/**
  * A seek from the current position
  * @constant {Number}
  */
LargeObject.SEEK_CUR = 1;

/**
  * A seek from the end of a object
  * @constant {Number}
  */
LargeObject.SEEK_END = 2;

/** @typedef {function} pg-large-object/closeCallback
  * @param {?Error} error If set, an error occured.
  */
/** Closes this large object. 
  *  You should no longer call any methods on this object.
  * @param {pg-large-object/closeCallback} [callback]  
  */
LargeObject.prototype.close = function(callback)
{
        this._client.query(
                {name: "npg_lo_close", text:"SELECT lo_close($1) as ok", values: [this._fd]},
                callback ? function(err, result)
                {
                        callback(err);       
                } : undefined
        );
};

/** @typedef {function} pg-large-object/readCallback
  * @param {?Error} error If set, an error occured.
  * @param {Buffer} data The binary data that was read.
  *        If the lenght of this buffer is less than the supplied
  *        length param, there is no more data to be read.    
  */
/** Reads some data from the large object.
  * @param {Number} length How many bytes to read
  * @param {pg-large-object/readCallback} callback  
  */
LargeObject.prototype.read = function(length, callback)
{
        this._client.query(
                {name: "npg_loread", text:"SELECT loread($1, $2) as data", values: [this._fd, length]},
                function(err, result)
                {
                        if (err) return callback(err);
                        
                        var data = result.rows[0].data;
                        callback(null, data);
                }
        );
};

/** @typedef {function} pg-large-object/writeCallback
  * @param {?Error} error If set, an error occured.
  */
/** Writes some data to the large object.
  * @param {Number} length How many bytes to read
  * @param {pg-large-object/writeCallback} [callback]  
  */
LargeObject.prototype.write = function(buffer, callback)
{
        this._client.query(
                {name: "npg_lowrite", text:"SELECT lowrite($1, $2)", values: [this._fd, buffer]},
                callback ? function(err, result)
                {
                        callback(err);
                } : undefined
        );
};

/** @typedef {function} pg-large-object/seekCallback
  * @param {?Error} error If set, an error occured.
  * @param {Number} position The new position  
  */
/** Sets the position within the large object.
  * Beware floating point rounding with values greater than 2^53 (8192 TiB)
  * @param {Number} position
  * @param {Number} ref One of SEEK_SET, SEEK_CUR, SEEK_END
  * @param {pg-large-object/seekCallback} [callback]
  */
LargeObject.prototype.seek = function(position, ref, callback)
{
        this._client.query(
                {name: "npg_lo_lseek64", text:"SELECT lo_lseek64($1, $2, $3) as location", values: [this._fd, position, ref]},
                callback ? function(err, result)
                {
                        if (err) return callback(err);
                        
                        var location = result.rows[0].location;
                        callback(null, location);
                } : undefined
        );
};

/** @typedef {function} pg-large-object/tellCallback
  * @param {?Error} error If set, an error occured.
  * @param {Number} position The position  
  */
/** Retrieves the current position within the large object.
  * Beware floating point rounding with values greater than 2^53 (8192 TiB)
  * @param {pg-large-object/tellCallback} callback
  */
LargeObject.prototype.tell = function(callback)
{
        this._client.query(
                {name: "npg_lo_tell64", text:"SELECT lo_tell64($1) as location", values: [this._fd]},
                function(err, result)
                {
                        if (err) return callback(err);
                        
                        var location = result.rows[0].location;
                        callback(null, location);
                }
        );
};


/** @typedef {function} pg-large-object/sizeCallback
  * @param {?Error} error If set, an error occured.
  * @param {Number} size Object size in bytes  
  */
/** Find the total size of the large object.
  * @param {pg-large-object/sizeCallback} callback
  */
LargeObject.prototype.size = function(callback)
{
        var text = "SELECT lo_lseek64($1, location, 0), seek.size FROM "+
                "(SELECT lo_lseek64($1, 0, 2) AS SIZE, tell.location FROM " + 
                        "(SELECT lo_tell64($1) AS location) tell) "+ 
                "seek;"
        this._client.query(
                {name: "npg_size", text: text, values: [this._fd]},
                function(err, result)
                {
                        if (err) return callback(err);
                        
                        var size = result.rows[0].size;
                        callback(null, size);
                }
        );
};

/** @typedef {function} pg-large-object/truncateCallback
  * @param {?Error} error If set, an error occured.  
  */
/** Truncates the large object to the given length in bytes.
  * If the number of bytes is larger than the current large
  * object length, the large object will be filled with zero
  * bytes.  This method does not modify the current file offset.
  * @param {Number} length  
  * @param {pg-large-object/truncateCallback} [callback]
  */
LargeObject.prototype.truncate = function(length, callback)
{
        this._client.query(
                {name: "npg_lo_truncate64", text:"SELECT lo_truncate64($1, $2)", values: [this._fd, length]},
                callback ? function(err, result)
                {
                        callback(err);
                } : undefined
        );
};

/** Return a stream to read this large object.
  * Call this within a transaction block.
  * @param {Number} [bufferSize=16384] A larger buffer size will 
  * require more memory on both the server and client, however it will make 
  * transfers faster because there is less overhead (less read calls to the server). 
  * his overhead is most noticeable on high latency connections because each 
  * ransfered chunk will incur at least RTT of additional transfer time.
  * @returns {module:pg-large-object/ReadStream}
  */
LargeObject.prototype.getReadableStream = function(bufferSize)
{
        return new ReadStream(this, bufferSize);
        
};

/** Return a stream to write to this large object.
  * Call this within a transaction block.
  * @param {Number} [bufferSize=16384] A larger buffer size will 
  * require more memory on both the server and client, however it will make 
  * transfers faster because there is less overhead (less read calls to the server). 
  * his overhead is most noticeable on high latency connections because each 
  * ransfered chunk will incur at least RTT of additional transfer time.  
  * @returns {module:pg-large-object/WriteStream}
  */
LargeObject.prototype.getWritableStream = function(bufferSize)
{
        return new WriteStream(this, bufferSize);
};

