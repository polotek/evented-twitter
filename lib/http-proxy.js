var request = require('request');

var slice = Array.prototype.slice;
function createClient(port, host) {

    return {
        get: function(url) {
            var cb = slice.call(arguments, -1)[0];
            request({uri:url, method: 'GET'},
                    function (error, response, body) {
                        cb(error, body, response);
                    });
        },
        post: function(url) {
            var args = slice.call(arguments, -2);
            var data = args[0];
            var cb = args[1];
            request({uri:url, method: 'POST', body: data},
                    function (error, response, body) {
                        cb(error, body, response);
                    });
        }
    }

}

exports.createClient = createClient;