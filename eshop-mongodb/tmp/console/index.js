exports.id = 'console';
exports.version = '1.01';

var console_log = console.log;
var console_error = console.error;
var console_warm = console.warm;
var options = { history: 50, url: '/$console/', user: '', password: '' };
var history = [];
var ticks = 0;

exports.install = function(framework, opt) {

    U.copy(opt, options);

    F.route(options.url, view_console);
    F.route(options.url, json_console, ['xhr', 'json']);

    console.log = function() {
        prepend('log', arguments);
        console_log.apply(console_log, arguments);
    };

    console.error = function() {
        prepend('error', arguments);
        console_error.apply(console_error, arguments);
    };

    console.warm = function() {
        prepend('warm', arguments);
        console_warm.apply(console_warm, arguments);
    };

    F.on('controller', auth);
};

exports.uninstall = function() {
    console.log = console_log;
    console.error = console_error;
    console.warm = console_warm;
    F.removeListener('controller', auth);
    options = null;
};

function prepend(type, arg) {
    if (history.length === options.history)
        history.shift();
    var dt = new Date();
    ticks = dt.getTime();
    history.push(dt.format('yyyy-MM-dd HH:mm:ss') + ' (' + type + '): ' + append.apply(null, arg));
}

function append() {

    var output = '';

    for (var i = 0; i < arguments.length; i++) {

        if (i > 0)
            output += ' ';

        var value = arguments[i];

        if (value === null) {
            output += 'null';
            continue;
        }

        if (value === undefined) {
            output += 'undefined';
            continue;
        }

        var type = typeof(value);

        if (type === 'string' || type === 'number' || type === 'boolean') {
            output += value.toString();
            continue;
        }

        output += JSON.stringify(value);
    }

    return output;
}

function view_console() {
    var self = this;
    self.view('@console/index');
}

function json_console() {

    var self = this;
    var body = self.body;

    if (body.exec) {
        try
        {
            F.eval(body.exec);
        } catch (e) {
            F.error(e);
        }
    }

    if (body.ticks === ticks) {
        self.plain('null');
        return;
    }

    self.json({ ticks: ticks, output: history });
}

function auth(controller) {

    if (controller.name !== '#console')
        return;

    if (!options.user || !options.password)
        return;

    var user = controller.baa();
    if (user.empty) {
        controller.baa('Console:');
        controller.cancel();
        return;
    }

    if (user.user !== options.user || user.password !== options.password) {
        controller.throw401();
        controller.cancel();
        return;
    }
}