// evented-twitter Copyright 2010 - Marco Rogers <http://marcorogers.com/>
// (MIT Licensed - http://www.opensource.org/licenses/mit-license.php)

var sys = require('sys')
    , http = require('http')
    , querystring = require('querystring')
    , _ = require('./underscore')._
    , jp = require('./json-stream-parser')
    , ra = require('./request-adapters')
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
        _supress: true
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
        , show: {
            ':id': { 
                _name: 'status'
                , params: {
                    authRequired: false
                }
            }
        }
        , update: {
            options: {
                method: 'POST'
            }
            , params: null
        }
        , destroy:  {
            ':id': {
                _supress: true
                , options: {
                    method: 'POST'
                }
                , params: null
            }
        }
        , retweet:  {
            ':id': {
                _supress: true
                , options: {
                    method: 'POST'
                }
                , params: null
            }
        }
        , retweets: {
            ':id': {
                _supress: true
                , params: null
            }
        }
        , ':id': {
            _supress: true
            , retweeted_by: {
                params: null
                , ids: {params:null}
            }
        }
        , friends: {params:null}
        , followers: {params:null}
    }
    , users: {
        _supress: true
        , show: {
            _name: 'showUser'
            , params: {
                authRequired: false
                , screen_name: true
            }
        }
        , lookup: {
            params: {
                screen_name: true
            }
        }
        , search: {
            params: {
                q: true
            }
        }
        , suggestions: {
            params:  {
                authRequired: false
            }
            , ':category': {
                params: {
                    authRequired: false
                }
            }
        }
        , profile_image: {
            ':screen_name': {
                _supress: true
                , params: null
            }
        }
    }
    , account: {
        _supress:true
        , rate_limit_status: {params:null}
    }
    , direct_messages: {
        params: null
        , sent: {params:null}
        , 'new': {
            options: {
                method: 'POST'
            }
            , params: {
                screen_name: true
                , text: true
            }
        }
        , destroy: {
            ':id': {
                _supress: true
                , options: {
                    method: 'POST'
                }
                , params: null
            }
        }
    }
};

function buildAPI(ctx, schema, path, name, initialParams) {
    path = path || '';
    name = name || '';

    var tmpKey = null
        , curParams = null;
    
    if(typeof schema == 'object') {

        if(schema.hasOwnProperty('params')) {
            if(initialParams) curParams = _.extend({}, initialParams, schema['params']);
            addAPIMethod(ctx
                         , path
                         , name
                         , schema['options']
                         , curParams);
        }

        for(var i=0, okeys = Object.keys(schema); i<okeys.length; i++) {
            var key = okeys[i];
            var curPath = path;
            var curName = name;

            curParams = initialParams;

            if(key[0] == ':') {
                curParams = curParams || {};
                tmpKey = key.substring(1);
                curParams[tmpKey] = true;
            }

            if(!schema[key] || !schema[key]._supress) {
                var keyName = (schema[key] && schema[key]._name) ? schema[key]._name : key;
                keyName = keyName.replace(/^:/,'')
                                 .replace(/_(.)([^_]*?)/g
                                          , function(m, first, rest) {
                                              return first.toUpperCase() + rest;
                                          })
                                 .replace('_','');
                if(name) {
                    keyName = keyName[0].toUpperCase() + keyName.slice(1);
                }
                curName += keyName;
            }

            if(['options', 'params', '_supress', '_name'].indexOf(key) === -1) {
                buildAPI(ctx, schema[key], (curPath ? curPath + '/' + key : key), curName, curParams);
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
        
        params = _.extend({}, default_params, params);
        checkParams(params, default_params);

        var pid = null
        , m = (urlPath).match(/\/:(\w+)(\/|$)/);
        if(m && m.length > 1) {
            for(var i=1, pid=m[i]; i<m.length; i+=2) {
                urlPath = urlPath.replace(':' + pid, params[pid]);
                delete params[pid];
            }
        }

        var opts = default_options;
        if(this._auth)
            opts = _.extend({}, default_options, this._auth);

        this.apiCall.call(this
                     , urlPath
                     , default_options.method || 'GET'
                     , format
                     , params
                     , opts
                     , cb);
    }
}

function checkParams(params, defaults) {
    var keys = Object.keys(defaults);
    for(var i=0, key=keys[i]; i<keys.length; i++) {
        if(defaults[key] === true && !params[key]) {
            throw new Error('Missing required parameter: ' + key);
        }
    }
}

function apiCall(urlPath, method, format, params, opts, cb) {

    var authRequired = opts.authRequired
        , errHandler = opts.errHandler;

    if(_.include(this._FORMATS, format)) {
        urlPath += '.' + format;
    } else {
        throw new Error('The Twitter api does not accept this format: ' + format);
    }

    method = method ? (method+'').toUpperCase() : 'GET';

    var data = params || null;

    if(typeof errHandler != 'function')
        errHandler = cb;

    var headers =  { "User-Agent": "evented-twitter - node.js" };

    var authObject
        , client;
    if(opts.authRequired) {
        if(opts.auth && authHandlers[opts.auth]) {
            authObject = authHandlers[opts.auth];
            authObject = authObject.authenticate(opts);
        } else if(opts.auth && opts.auth.authenticate) {
            authObject = params.auth.authenticate(this._auth);
        } else {
            return cb(new Error('Authentication required, provide an authObject or OAuth info'));
        }
    }

    if(authObject && authObject.proxy) {
        client = authObject.proxy;
    } else {
        authObject = {};
        client = ra.createRequestAdapter();
    }

    var lastAPICall = this._lastAPICall = 'http://' + REST_API_HOST + REST_API_ENDPOINT + urlPath;

    function responseHandler(err, data, res) {
        if(err) {
            err.et = { url: lastAPICall };
            return errHandler(err, data);
        }

        if(res && res.statusCode && res.statusCode !== 200) {
            return errHandler(new Error('Twitter error (' + res.statusCode + ')'), data);
        }
        
        cb(null, data, res);
    }

    if(method == 'POST') {
        client.post({ uri: this._lastAPICall
                      , body: data
                      , authObject: authObject 
                    }
                    , responseHandler);
    } else {
        client.get({ uri: this._lastAPICall
                     , authObject: authObject 
                     , body: data
                   }
                   , responseHandler);
    }
}

function TwitterBase(opts) {
    if(opts) {
        if(opts.username) {
            this._username = opts.username;
            this._password = opts.password || null;
        }
        
        if(opts.oauth && typeof opts.oauth == 'object') {
            this._auth = _.extend({}, opts.oauth);
        }
    }

    this._lastAPICall = null;
    this._FORMATS = ['json','xml','rss','atom'];
}

TwitterBase.prototype = {
    get username() { return this._username; }
    , set password(value) { this._password = value; }
    , get FORMATS() { return this._FORMATS; }
    , get lastAPICall() { return this._lastAPICall; }
    , authHandler: authHandlers.basic
    , apiCall: apiCall
};

function Twitter(){
    Twitter.super_.apply(this, _.toArray(arguments));
}
sys.inherits(Twitter, TwitterBase);

Twitter.prototype.apiCall = apiCall;

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
    if(this._auth) {
        authObject = authHandlers.oauth;
        authObject = authObject.authenticate(this._auth);

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

    var clientClosed = false;
    parser.close = function() {
        if(!clientClosed) {
            //response.end();
            client.destroy();
            clientClosed = true;
        }        
    }

    parser.onReady(function() { request.end(); });

    var errHandler = function(err) {
        parser.emit('error', err);
    }
    client.on('error', errHandler);
    request.on('error', errHandler);


    request.addListener('response', function (response) {
        if(response.statusCode == 200) {
            response.setEncoding("utf8");

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
    this.parserType = null;
    if(opts && opts.parserType)
        this.parserType = opts.parser;
    this._FORMATS = ['json'];
}
sys.inherits(TwitterStreamBase, TwitterBase);
TwitterStreamBase.prototype.apiCall = function() { throw new Error("Twitter streaming doesn't support synchronous api calls"); };

function TwitterStream() {
    TwitterStream.super_.apply(this, _.toArray(arguments));
}
sys.inherits(TwitterStream, TwitterStreamBase);

TwitterStream.prototype.apiStreamCall = apiStreamCall;

TwitterStream.prototype.sample = function(format, params) {
    var authRequired =  true;
    return this.apiStreamCall.call(this, 'statuses/sample', 'GET', format || 'json', params || null, authRequired);
}

TwitterStream.prototype.filter = function(format, params) {
    if(!params.follow && !params.track && !params.locations)
        throw new Error('You must specify a predicate for the filter stream: follow, track or locations.');

    var authRequired =  true;
    return this.apiStreamCall.call(this, 'statuses/filter', 'GET', format || 'json', params, authRequired);
}

TwitterStream.prototype.firehose = function(format, params) {
    var authRequired =  true;
    return this.apiStreamCall.call(this, 'statuses/firehose', 'GET', format || 'json', params, authRequired);
}

TwitterStream.prototype.links = function(format, params) {
    var authRequired =  true;
    return this.apiStreamCall.call(this, 'statuses/links', 'GET', format || 'json', params || null, authRequired);
}

TwitterStream.prototype.retweet = function(format, params) {
    var authRequired =  true;
    return this.apiStreamCall.call(this, 'statuses/retweet', 'GET', format || 'json', params || null, authRequired);
}

exports.Twitter = Twitter;
exports.TwitterStream = TwitterStream;
