'use strict';

var _ = require('lodash');

function Pricebreak() {
}

Pricebreak.prototype.set = function (base, breaks) {
    if (typeof breaks == 'undefined')
        breaks = {};

    this.base = base;
    this.breaks = breaks;

    this.sortedBreaks = _.map(Object.keys(breaks), function (elem) {
        return parseInt(elem);
    }).sort(function (a, b) {
        return a - b;
    });
    //console.log(this.sortedBreaks);
};


/**
 * Calculate total price based on quantity.
 * @param quantity
 * @returns {number}
 */
Pricebreak.prototype.price = function (quantity) {
    var price = this.base;
    var max = 0;
    var self = this;

    this.sortedBreaks
            .forEach(function (_break) {
                _break = parseInt(_break, 10);
                if (_break > max) {
                    max = _break;
                }
                if (quantity >= _break) {
                    price = self.breaks[_break];
                }
            });

    var total = MODULE('utils').round(quantity * (price || self.breaks[max]), 2);

    return ({price: (price || self.breaks[max]),
        total: total});
};

/**
 * Get an array of objects with humanized ranges and prices
 * @param vague - if true, display range as X+ instead of X-Y
 * @returns {Array}
 */
Pricebreak.prototype.humanize = function (vague, len) {
    var self = this;

    var statements = this.sortedBreaks.map(function (_break, idx, arr) {
        _break = parseInt(_break, 10);
        var nextBreak = parseInt(arr[idx + 1], 10);
        var start = _break;
        var end = 0;

        if (idx === arr.length - 1 || vague) {
            end = '+'; //old +
        }
        else {
            end = '-' + (nextBreak - 1);
        }

        return {
            range: start + end,
            rangeQty: start,
            price: MODULE('utils').round(self.breaks[_break.toString()], (len || 2))
        };
    });

    statements.unshift({
        range: '1' + ((vague) ? '+' : '-' + (self.sortedBreaks[0] - 1)),
        rangeQty: 1,
        price: MODULE('utils').round(self.base, (len || 2))
    });

    return statements;
};

module.exports = new Pricebreak();
