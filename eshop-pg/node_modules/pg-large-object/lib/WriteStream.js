"use strict";
var stream = require('stream');

/** @module pg-large-object/WriteStream */

/** 
  * @constructor 
  * @alias module:pg-large-object/WriteStream
  */
var WriteStream = module.exports = function(largeObject, bufferSize)
{
        stream.Writable.call(this, {
                'highWaterMark': bufferSize || 16384,
                'decodeStrings': true,
                'objectMode': false
        });
        this._largeObject = largeObject;
};

WriteStream.prototype = Object.create(stream.Writable.prototype);

WriteStream.prototype._write = function(chunk, encoding, callback)
{
        if (!Buffer.isBuffer(chunk))
        {
                throw "Illegal Argument";
        }
        
        // callback(error)
        this._largeObject.write(chunk, callback);
};
