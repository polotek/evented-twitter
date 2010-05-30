// evented-twitter Copyright 2010 - Marco Rogers <http://marcorogers.com/>
// (MIT Licensed - http://www.opensource.org/licenses/mit-license.php)

var sys = require('sys');
var http = require('http');
var querystring = require('querystring');
require('./base64');
var _ = require('./underscore')._;

var API_HOST = 'api.twitter.com';
var API_ENDPOINT = exports.API_ENDPOINT = '/1/';
var STREAM_HOST = 'stream.twitter.com';
var STREAM_ENDPOINT = exports.API_ENDPOINT = '/1/';
var DEFAULT_PARAMS = {};
var DEFAULT_OPTIONS = {authRequired:true
                      , 'errHandler': function(err, data) { throw err; }
                      };

var REST_API = {
    statuses: {
        supress:true
        , public_timeline: {
            params: null
            , options: {authRequired:false}
        }
        , home_timeline: {params:null}
        , friends_timeline: {params:null}
        , user_timeline: {params:null}
        , mentions: {params:null}
        , retweeted_by_me: {params:null}
        , retweeted_to_me: {params:null}
        , retweets_of_me: {params:null}
        , show: {params:null}
        , update: {params:null}
        , destroy: {params:null}
        , retweet: {params:null}
        , retweets: {params:null}
        , id: {
            supress:true
            , retweeted_by: {
                params: null
                , ids: {params:null}
            }
        }
        , friends: {params:null}
        , followers: {params:null}
    }
    , users: {
        supress:true
        , show: {params:null}
        , lookup: {params:null}
        , search: {params:null}
        , suggestions: {
            params:null
            , category: {params:null}
        }
    }
};

function buildAPI(ctx, schema, path, name) {
    path = path || '';
    name = name || '';
    sys.puts(path);
    sys.puts(name);

    if(typeof schema == 'object') {

        if(schema.hasOwnProperty('params')) addAPIMethod(ctx
                                          , path
                                          , name
                                          , schema['options']
                                          , schema['params']);

        for(var i=0, okeys = Object.keys(schema); i<okeys.length; i++) {
            var key = okeys[i];
            var curPath = path;
            var curName = name;
            if(!schema[key] || !schema[key].supress) {
                var keyName = key.replace(/_(.)([^_]*?)/g,
                                          function(m, first, rest) {
                                              return first.toUpperCase() + rest;
                                          })
                                 .replace('_','');
                if(name) keyName = keyName[0].toUpperCase() + keyName.slice(1);
                curName += keyName;
            }

            if(['options', 'params', 'supress'].indexOf(key) === -1) {
                buildAPI(ctx, schema[key], (curPath ? curPath + '/' + key : key), curName);
            }
        }
    }
}

function addAPIMethod(ctx, path, name, default_o, default_p) {
    sys.puts('  api method: ' + name);

    var urlPath = path;

    var default_options = _.extend({}, DEFAULT_OPTIONS, default_o);
    sys.puts('  o:' + sys.inspect(default_options));

    var default_params = _.extend({}, DEFAULT_PARAMS, default_p);
    sys.puts('  p:' + sys.inspect(default_params));
    ctx.prototype[name] = function(format, params, cb) {
        format = format || DEFAULT_FORMAT;
        if(params) {
            params = _.extend({}, default_params, params);
        }
        if(params && !Object.keys(params).length) params = null;

        apiCall.call(this
                     , urlPath
                     , 'GET'
                     , format
                     , params
                     , default_options.authRequired
                     , default_options.errHandler
                     , cb);
    };
}

function basic_authentication(username, password, client, headers) {
    headers = headers || {};
    var auth = (username + (password ? ':' + password : '')).base64Encode;
    headers['Authorization'] = 'Basic ' + auth;
    return {headers: headers};
}
var basicAuthHandler = {authenticate:basic_authentication};

function apiCall(urlPath, method, format, params, authRequired, errHandler, cb) {

    if(_.include(this._FORMATS, format)) {
        urlPath += '.' + format;
    } else {
        throw new Error('The Twitter api does not accept this format: ' + format);
    }

    method = method ? method.toString().toUpperCase() : 'GET';

    var data = null;

    if(params) {
        if(_.isString(params)) {
            data = params;
        } else {
            data = querystring.stringify(params);
            if(method == 'GET') {
                urlPath += '?' + data;
            }
        }
    }


    var client = http.createClient(80, API_HOST);

    var headers =  {"host": API_HOST};
    if(method == 'POST' && data) {
        headers['Content-Length'] = data.length;
    }
    if(authRequired) {
        headers = this.authHandler.authenticate(this._username, this._password, client, headers).headers;
    }

    this._lastAPICall = 'http://'
                        + (authRequired ? this._username + (this._password ? ':<password>@' : '') : '')
                        + API_HOST + API_ENDPOINT + urlPath;

    var request = client.request(method, API_ENDPOINT + urlPath, headers);

    if(method == 'POST') {
        request.write(data, 'utf8');
    }

    var tweets = [];
    request.addListener('response', function (response) {
                            response.setEncoding("utf8");
                            response.addListener('data', function(chunk) {
                                                     tweets.push(chunk);
                                                 });
                            response.addListener('end', function() {
                                                     cb(tweets.join(''));
                                                 });
                            if(typeof errHandler == 'function')
                                response.addListener('error', errHandler);
                            else
                                response.addListener('error', cb);
                        });
    request.end();
}

function TwitterBase(user, pass) {
    this._username = user;
    this._password = pass || null;
    this._lastAPICall = null;
    this._FORMATS = ['json','xml','rss','atom'];
}
// apiCall(urlPath, method, format, params, authRequired, cb)
TwitterBase.prototype = {
    get username() { return this._username; }
    , set password(value) { this._password = value; }
    , get FORMATS() { return this._FORMATS; }
    , get lastAPICall() { return this._lastAPICall; }
    , 'authHandler': basicAuthHandler
    , 'apiCall': apiCall
};

function Twitter(){
    Twitter.super_.apply(this, _.toArray(arguments));
}
sys.inherits(Twitter, TwitterBase);
// Twitter.prototype.userTimeline = function(format, params, cb) {
//     var authRequired = false;
//     apiCall.call(this, 'statuses/user_timeline/' + this.username, 'GET', format || 'json', params || null, authRequired, cb);
// };
buildAPI(Twitter, REST_API);

function apiStreamCall(urlPath, method, format, params, authRequired) {

    if(_.include(this._FORMATS, format)) {
        urlPath += '.' + format;
    } else {
        throw new Error('The api call {' + urlPath + '} does not accept this format: ' + format);
    }

    method = method ? method.toString().toUpperCase() : 'GET';

    var data = null;

    if(params) {
        if(_.isString(params)) {
            data = params;
        } else {
            data = querystring.stringify(params);
            if(method == 'GET') {
                urlPath += '?' + data;
            }
        }
    }

    var client = http.createClient(80, STREAM_HOST);

    var headers = {'Host': STREAM_HOST,
                   'User-Agent': 'node.js',
                   'Connection': 'Keep-Alive'
                  };
    if(method == 'POST' && data) {
         headers['Content-Length'] = data.length;
    }
    if(authRequired) {
        headers = this.authHandler.authenticate(this._username, this._password, client, headers).headers;
    }

    this._lastAPICall = 'http://' + STREAM_HOST + STREAM_ENDPOINT + urlPath;

    var request = client.request(method, STREAM_ENDPOINT + urlPath, headers);

    if(method == 'POST' && data) {
        request.write(data, 'utf8');
    }

    var tc = require('./twitter-stream-parser').instance();

    // convenient hook to get the request, not really needed
    tc.__defineGetter__('request', function(){
        return request;
    });

    var clientClosed = false;

    request.addListener('response', function (response) {
                            if(response.statusCode == 200) {
                                response.setEncoding("utf8");

                                tc.close = function() {
                                    if(!clientClosed) {
                                        //response.end();
                                        client.destroy();
                                        clientClosed = true;
                                    }
                                }

                                tc.stream = response;

                                tc.ready();
                            } else {
                                throw new Error('Request failed: ' + response.statusCode);
                            }
                        });

    return tc;
}

function TwitterStreamBase() {
    TwitterStreamBase.super_.apply(this, _.toArray(arguments));
    this._FORMATS = ['json', 'xml'];
}
sys.inherits(TwitterStreamBase, TwitterBase);
TwitterStreamBase.prototype.apiCall = function() { throw new Error("Twitter streaming doesn't support synchronous api calls"); };
TwitterStreamBase.prototype.apiStreamCall = apiStreamCall;

function TwitterStream() {
    TwitterStream.super_.apply(this, _.toArray(arguments));
}
sys.inherits(TwitterStream, TwitterStreamBase);
TwitterStream.prototype.sample = function(format, params) {
    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/sample', 'GET', format || 'json', params || null, authRequired);
};

TwitterStream.prototype.filter = function(format, params) {
    if(!params.follow && !params.track && !params.locations)
        throw new Error('You must specify a predicate for the filter stream; follow, track or locations.');

    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/filter', 'GET', format || 'json', params, authRequired);
};

TwitterStream.prototype.firehose = function(format, params) {
    if(!params.follow && !params.track && !params.locations)
        throw new Error('You must specify a predicate for the filter stream; follow, track or locations.');

    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/firehose', 'GET', format || 'json', params, authRequired);
};

TwitterStream.prototype.links = function(format, params) {
    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/links', 'GET', format || 'json', params || null, authRequired);
};

TwitterStream.prototype.retweet = function(format, params) {
    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/retweet', 'GET', format || 'json', params || null, authRequired);
};

exports.TwitterBase = Twitter;
exports.Twitter = Twitter;
exports.TwitterStreamBase = TwitterStreamBase;
exports.TwitterStream = TwitterStream;
