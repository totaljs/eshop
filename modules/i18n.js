/**
 * @module i18next
 * @version v0.64
 * @author Herve Prot
 */

var VERSION = 'v0.64';

var fs = require('fs');
global.i18n = require('i18next');
var FilesystemBackend = require('i18next-node-fs-backend'),
        sprintf = require('i18next-sprintf-postprocessor');

function Translation() {
    this.options = null;
    this.translations = null;
}

Translation.prototype.call = function () {
    var key = arguments[1];
    var language = this.options.language;
    var params = {};

    if (arguments[2] != null)
        language = arguments[2];

    if (arguments[3] != null)
        params = arguments[3];

    return this.translate(key, language, params);
};

/**
 * @param {String} key
 * @param {String} language
 * @param {Object} params
 *
 * @return {String}
 */
Translation.prototype.translate = function (key, language, params) {
    //console.log(key);
    return i18n.t(key);
};

Translation.prototype.load = function () {
    var namespaces = [];

    fs.readdirSync('locales/fr').forEach((file) => namespaces.push(file.substr(0, file.indexOf(".json"))));

    i18n
            .use(FilesystemBackend)
            .use(sprintf)
            .init({
                ns: namespaces,
                defaultNS: 'main',
                fallbackNS: "new",
                "backend": {
                    "loadPath": "locales/{{lng}}/{{ns}}.json",
                   // "addPath": "locales/add/{{lng}}/{{ns}}",
                   // "allowMultiLoading": false,
                    "crossDomain": false
                },
                //supportedLngs: ['fr-FR', 'en-US'],
                load: 'all',
                //preload: false,
                useCookie: false,
                detectLngFromHeaders: false,
                saveMissing: false,
                debug: false,
                saveMissingTo: 'fallback',
                lng: "fr",
                fallbackLng: ["fr"]
            }, function(err, t){
                
                F.emit('i18n', {});
                
                console.log("traduction ok !");
            });
            
    
};

exports.name = 'i18n';
exports.version = VERSION;

var allowed = { fr: true, en: true };

exports.install = function (options) {

    var translation = new Translation();

    translation.options = U.extend({language: 'en'}, options);
    F.helpers.i18n = translation;
    translation.load();

    // HACK:
    F.translate = function (language, content) {

        // Sets a default language.
        // Prevention for a manual calling.
        if (typeof (content) === 'undefined') {
            content = language;
            language = 'fr';
        }

        return translation.translate(content, language);
    };
       
    F.onLocale = function(req, res) {
    var language = req.query.language;

    // Set the language according to the querystring and store to the cookie
    if (language) {
        if (!allowed[language])
            return 'fr';

        return language;
    }
    
    // Sets the language according to user-agent
    language = req.language;
    //language = req.path[0];

    if (language.indexOf('en') > -1)
        return 'en';
    
    return '';
};

    // It will be work when you move /app/views/ --> to --> /public/views/ (the method below is optimized for the performance)
    // If you use it then remove file handler F.file('/views/*.html')
    // F.localize('/views/*.html', ['compress']);

    //F.localize('/views/*', ['compress']);

    F.file('/views/*', function (req, res) {
        var filename = F.path.virtual(req.url);
        if (fs.existsSync(filename))
            res.send(200, F.translator(req.language, fs.readFileSync(filename).toString('utf8')), 'text/html');
        else
            res.throw404();
    });

    F.file('/templates/*', function (req, res) {
        var filename = F.path.virtual(req.url);
        if (fs.existsSync(filename))
            res.send(200, F.translator(req.language, fs.readFileSync(filename).toString('utf8')), 'text/html');
        else
            res.throw404();
    });
};

module.exports.uninstall = function (options) {
    delete framework.helpers.i18n;
};