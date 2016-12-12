"use strict";

var async = require('async');

NEWSCHEMA('Dict').make(function (schema) {

    schema.define('_id', 'String');
    schema.define('lang', 'Lower(2)');
    schema.define('default', 'String(80)');

    // Gets listing
    schema.setQuery(function (error, options, callback) {
         // options.id {String}
        // options.lang {String}

        var noql = DB(error);

        noql.select('dict', 'Dict').make(function (builder) {
            options._id && builder.in('_id', options._id);
            options.lang && builder.where('lang', options.lang);
        });

        //noql.validate('post', 'error-404-post');

        noql.exec(function (err, response) {
            //console.log(response);
            
            var result = {};

            async.each(response.dict, function(dict, cb) {
                convertDict(options, dict, function(res) {
                    //console.log(res);
                    result[dict._id] = res;
                    cb();
                });
            }, function(err) {
                //console.log(result);
                callback(result);
            });
        });
    });

    // Gets a specific post
    schema.setGet(function (error, model, options, callback) {

        // options.id {String}
        // options.lang {String}

        var noql = DB(error);

        noql.select('dict', 'Dict').make(function (builder) {
            options._id && builder.where('_id', options._id);
            options.lang && builder.where('lang', options.lang);
            builder.first();
        });

        //noql.validate('post', 'error-404-post');

        noql.exec(function (err, response) {
            console.log(response);
            callback(response.dict);
        });
    });

    // Removes a specific post
    schema.setRemove(function (error, id, callback) {

    });

    // Saves the blog into the database
    schema.setSave(function (error, model, controller, callback) {
    });
});

function convertDict(params, doc, callback) {
    var result = {};

    if (params.object) // retourne le dict complet
        return callback(doc);

    if (doc) { // converti le dict en array
        result = {
            _id: doc._id,
            values: []
        };

        if (doc.lang)
            result.lang = doc.lang;

        for (var i in doc.values) {
            if (doc.values[i].enable) {
                if (doc.values[i].pays_code && doc.values[i].pays_code != 'FR')
                    continue;

                var val = doc.values[i];
                val.id = i;

                if (doc.lang) //(doc.values[i].label)
                    val.label = i18n.t(doc.lang + ":" + doc.values[i].label);
                else
                    val.label = doc.values[i].label;

                //else
                //  val.label = req.i18n.t("companies:" + i);

                result.values.push(val);
                //console.log(val);
            }
        }
    } else {
        console.log('Dict is not loaded');
    }

    callback(result);
}