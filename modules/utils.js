exports.name = 'utils';
exports.version = '1.02';

var _ = require('lodash'),
        mongoose = require('mongoose');


function round(value, decimals) {
    if (value > Math.pow(10, (decimals + 2) * -1) * -1 && value < Math.pow(10, (decimals + 2) * -1)) // Fix error little number
        return 0;
    return Number(Math.round(value + 'e' + (decimals)) + 'e-' + (decimals));
}

exports.round = round;

exports.setPrice = function (value) {
    return round(value, 2);
};

exports.numberFormat = function (number, width) {
    //console.log("number : " + number);
    //console.log("width : " + width);
    //console.log(number + '');
    return new Array(width + 1 - (number + '').length).join('0') + number;
};

// merge 2 arrays of object with specif prop example _id
//arr1  = [{_id:1, total:34}]
//arr2 = [{_id:1, moy:12}]
//[{_id:1, total:34, moy:12}]
exports.mergeByProperty = function (arr1, arr2, prop) {
    _.each(arr2, function (arr2obj) {
        var arr1obj = _.find(arr1, function (arr1obj) {
            return arr1obj[prop] === arr2obj[prop];
        });

        arr1obj ? _.extend(arr1obj, arr2obj) : arr1.push(arr2obj);
    });
};

// Same but type is ObjectId()
exports.mergeByObjectId = function (arr1, arr2, prop) {
    _.each(arr2, function (arr2obj) {
        var arr1obj = _.find(arr1, function (arr1obj) {
            return arr1obj[prop].toString() === arr2obj[prop].toString();
        });

        arr1obj ? _.extend(arr1obj, arr2obj) : arr1.push(arr2obj);
    });
};


exports.ObjectId = mongoose.Types.ObjectId;