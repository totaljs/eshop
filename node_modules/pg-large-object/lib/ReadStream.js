"use strict";
var stream = require('stream');

/** @module pg-large-object/ReadStream */

/** 
  * @constructor 
  * @alias module:pg-large-object/ReadStream
  */
var ReadStream = module.exports = function(largeObject, bufferSize)
{
        stream.Readable.call(this, {
                'highWaterMark': bufferSize || 16384,
                'encoding': null,
                'objectMode': false
        });
        this._largeObject = largeObject;
};

ReadStream.prototype = Object.create(stream.Readable.prototype);

ReadStream.prototype._read = function(length)
{
        if (length <= 0)
        {
                throw "Illegal Argument";
        }
        
        this._largeObject.read(length, function(error, data)
        {
                if (error)
                {
                        this.emit('error', error);
                        return;
                }
                
                this.push(data);
                if (data.length < length)
                {
                        this.push(null); // the large object has no more data left
                }
        }.bind(this));
};