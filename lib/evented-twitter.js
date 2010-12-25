// evented-twitter Copyright 2010 - Marco Rogers <http://marcorogers.com/>
// (MIT Licensed - http://www.opensource.org/licenses/mit-license.php)

var sys = require('sys')
    , http = require('http')
    , querystring = require('querystring')
    , _ = require('./underscore')._
    , jp = require('./json-stream-parser')
    , authHandlers = require('./auth-handlers').handlers
    , OAuth = require('oauth').OAuth;

var DEFAULT_CONFIG = { "requestTokenURL" : "http://api.twitter.com/oauth/request_token"
                       , "accessTokenURL" : "http://api.twitter.com/oauth/access_token"
                       , "authorizeURL" : "https://api.twitter.com/oauth/authorize"
                     };

var REST_API_HOST = 'api.twitter.com';
var REST_API_ENDPOINT = exports.API_ENDPOINT = '/1/';
var STREAM_API_HOST = 'stream.twitter.com';
var STREAM_API_ENDPOINT = exports.API_ENDPOINT = '/1/';
var DEFAULT_PARAMS = {};
var DEFAULT_OPTIONS = { authRequired: true
                        , errHandler: null
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
    , direct_messages: {
        params:null
        , sent: {params:null}
        , 'new': {params:null}
        , destroy: {params:null}
    }
};

function buildAPI(ctx, schema, path, name) {
    path = path || '';
    name = name || '';

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
                var keyName = key.replace(/_(.)([^_]*?)/g
                                          , function(m, first, rest) {
                                              return first.toUpperCase() + rest;
                                          });
                keyName = keyName.replace('_','');
                if(name) {
                    keyName = keyName[0].toUpperCase() + keyName.slice(1);
                }
                curName += keyName;
            }

            if(['options', 'params', 'supress'].indexOf(key) === -1) {
                buildAPI(ctx, schema[key], (curPath ? curPath + '/' + key : key), curName);
            }
        }
    }
}

function addAPIMethod(ctx, path, name, default_o, default_p) {

    var urlPath = path;

    var default_options = _.extend({}, DEFAULT_OPTIONS, default_o);

    var default_params = _.extend({}, DEFAULT_PARAMS, default_p);

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

    function responseHandler(err, data) {
        if(err) {
            if(typeof errHandler === 'function')
                return errHandler(err, data);
            else
                return cb(err);
        }
        cb(null, data);
    }

    var headers =  { "User-Agent": "evented-twitter - node.js" };

    var authObject
        , client;
    if(authRequired && params.auth) {
        if(_.isString(params.auth) && authHandlers[params.auth]) {
            authObject = authHandlers[params.auth];
            authObject = authObject.authenticate(params);
        } else if(params.auth.authenticate) {
            authObject = params.auth.authenticate(params)
        }
    }

    this._lastAPICall = 'http://' + REST_API_HOST + REST_API_ENDPOINT + urlPath;

    if(authObject && authObject.proxy)
        client = authObject.proxy

    if(!client) throw new Error('No client');

    if(method == 'POST') {
        client.post(this._lastAPICall
                    , authObject.accessToken
                    , authObject.accessTokenSecret
                    , data
                    , responseHandler);
    } else {
        client.get(this._lastAPICall
                   , authObject.accessToken
                   , authObject.accessTokenSecret
                   , responseHandler);
    }
}

function TwitterBase(opts) {
    if(opts.username) {
        this._username = opts.username;
        this._password = opts.password || null;
    } else if(opts.oauth && typeof opts.oauth == 'object') {
        this._oauth = _.extend({}, opts.oauth);
    }

    this._lastAPICall = null;
    this._FORMATS = ['json','xml','rss','atom'];
}

TwitterBase.prototype = {
    get username() { return this._username; }
    , set password(value) { this._password = value; }
    , get FORMATS() { return this._FORMATS; }
    , get lastAPICall() { return this._lastAPICall; }
    , 'authHandler': authHandlers.basic
    , 'apiCall': apiCall
};

function Twitter(){
    Twitter.super_.apply(this, _.toArray(arguments));
}
sys.inherits(Twitter, TwitterBase);

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

    this._lastAPICall = 'http://' + STREAM_API_HOST + STREAM_API_ENDPOINT + urlPath;

    var client, request;
    if(this._oauth) {
        authObject = authHandlers.oauth;
        authObject = authObject.authenticate(this._oauth);

        var oa = authObject.proxy;

        if(method == 'POST') {
            request = oa.post(this._lastAPICall
                              , authObject.accessToken
                              , authObject.accessTokenSecret
                              , data);
        } else {
            request = oa.get(this._lastAPICall
                             , authObject.accessToken
                             , authObject.accessTokenSecret);
        }

        client = request.socket;
    } else {

        client = http.createClient(80, STREAM_API_HOST);

        var headers = {'Host': STREAM_API_HOST
                       , 'User-Agent': 'evented-twitter - node.js'
                       , 'Connection': 'Keep-Alive'};

        if(method == 'POST' && data) {
            headers['Content-Length'] = data.length;
        }

        if(authRequired) {
            var auth_config = {username: this._username
                               , password: this._password
                               , headers: headers};
            headers = this.authHandler.authenticate(auth_config).headers;
        }

        request = client.request(method, STREAM_API_ENDPOINT + urlPath, headers);
    }

    if(method == 'POST' && data) {
        request.write(data, 'utf8');
    }

    var parser = jp.createJSONParser(this.parserType);

    // convenient hook to get the request, not really needed
    parser.__defineGetter__('request', function(){
        return request;
    });
    parser.onReady(function() { request.end(); });

    var clientClosed = false;
    request.addListener('response', function (response) {
        if(response.statusCode == 200) {
            response.setEncoding("utf8");

            parser.close = function() {
                if(!clientClosed) {
                    //response.end();
                    client.destroy();
                    clientClosed = true;
                }
            }

            parser.stream = response;

            parser.ready();
        } else {
            throw new Error('Request failed: ' + response.statusCode);
        }
    });

    return parser;
}

function TwitterStreamBase(opts) {
    TwitterStreamBase.super_.apply(this, _.toArray(arguments));
    this.parserType = opts && opts.parser;
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
}

TwitterStream.prototype.filter = function(format, params) {
    if(!params.follow && !params.track && !params.locations)
        throw new Error('You must specify a predicate for the filter stream: follow, track or locations.');

    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/filter', 'GET', format || 'json', params, authRequired);
}

TwitterStream.prototype.firehose = function(format, params) {
    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/firehose', 'GET', format || 'json', params, authRequired);
}

TwitterStream.prototype.links = function(format, params) {
    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/links', 'GET', format || 'json', params || null, authRequired);
}

TwitterStream.prototype.retweet = function(format, params) {
    var authRequired =  true;
    return apiStreamCall.call(this, 'statuses/retweet', 'GET', format || 'json', params || null, authRequired);
}

exports.Twitter = Twitter;
exports.TwitterStream = TwitterStream;
