"use strict";

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
		Schema = mongoose.Schema;

var extrafieldSchema = new mongoose.Schema({
	_id: String,
	ico: String,
	langs: [String],
	lang: String,
	schemaMongoose: {
		name: String,
		plugins: [String],
		enabled: {type: Boolean, default: false},
		collection: String
	},
	fields: {type: mongoose.Schema.Types.Mixed},
	data: Buffer
});

exports.Schema = mongoose.model('extrafields', extrafieldSchema, 'ExtraFields');
exports.name = 'extrafield';