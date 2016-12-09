"use strict";

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
		Schema = mongoose.Schema,
		timestamps = require('mongoose-timestamp');

var dictSchema = new mongoose.Schema({
	_id: String,
	lang: String,
	default: String,
	values: {type: mongoose.Schema.Types.Mixed}
});

dictSchema.plugin(timestamps);

exports.Schema = mongoose.model('dict', dictSchema, 'Dict');
exports.name = 'dict';