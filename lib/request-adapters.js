var _ = require('./underscore')._
    , querystring = require('querystring')
    , request = require('request');

var slice = Array.prototype.slice;

function RequestAdapter() {

    function responseHandler(cb, err, req, data) {
        return cb(err, data, req);
    }

    return {
        get: function(opts) {
            var cb = slice.call(arguments, -1)[0];
            cb = _.bind(responseHandler, this, cb);
            if(typeof opts.body == 'object') {
                opts.body = querystring.stringify(opts.body);
                opts.uri += '?' + opts.body;
                delete opts.body;
            }
            request(opts, cb);
        },
        post: function(opts) {
            var cb = slice.call(arguments, -1)[0];
            cb = _.bind(responseHandler, this, cb);
            if(typeof opts.body == 'object')
                opts.body = querystring.stringify(opts.body);
            request(opts, cb);
        }
    }

}

function OAuthRequestAdapter(opts) {
    var oa = opts;
    return {
        get: function(opts) {
            var cb = slice.call(arguments, -1)[0];
            if(typeof opts.body == 'object') {
                opts.body = querystring.stringify(opts.body);
                opts.uri += '?' + opts.body;
                delete opts.body;
            }
            oa.get(opts.uri,
                   opts.authObject.accessToken,
                   opts.authObject.accessTokenSecret,
                   cb);
        },
        post: function(opts) {
            var cb = slice.call(arguments, -1)[0];
            if(_.isString(opts.body))
                opts.body = querystring.parse(opts.body);
            oa.post(opts.uri,
                    opts.authObject.accessToken,
                    opts.authObject.accessTokenSecret,
                    opts.body,
                    cb);
        }
    }
}

var types = { 'oauth': OAuthRequestAdapter }

function createRequestAdapter(type) {
    var args = slice.call(arguments, 1);
    if( type && types[type] ) {
        return types[type].apply(null, args);
    } else {
        return new RequestAdapter();
    }
}


exports.createRequestAdapter = createRequestAdapter;
exports.OAuthRequestAdapter = OAuthRequestAdapter;