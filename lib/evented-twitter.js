var sys = require('sys');
var http = require('http');
var querystring = require('querystring');
var events = require('events');
var _ = require('./underscore')._;

var API_HOST = 'api.twitter.com';
var API_ENDPOINT = exports.API_ENDPOINT = '/1/';
var STREAM_HOST = 'stream.twitter.com';
var STREAM_ENDPOINT = exports.API_ENDPOINT = '/1/';

function apiCall(urlPath, method, format, params, authRequired, cb) {
    
    if(_.include(this._FORMATS, format)) {
        urlPath += '.' + format;
    } else {
        throw new Error('The Twitter api does not accept this format: ' + format);
    }

    method = method ? String(method).toUpperCase() : 'GET';
    var auth = (authRequired) ? this._username + (this._password ? ':' + this._password + '@' : '') : '';
    
    var host = auth + API_HOST;

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

    this._lastAPICall = urlPath;

    var client = http.createClient(80, host);
    var request = client.request(method, API_ENDPOINT + urlPath, {"host": API_HOST});
    
    if(method == 'post') {
        request.write(data, 'utf8');
    }

    var tweets = [];
    request.addListener('response', function (response) {
                            response.setBodyEncoding("utf8");
                            response.addListener('data', function(chunk) {
                                                     tweets.push(chunk);
                                                 });
                            response.addListener('end', function() {
                                                     //response.end();
                                                     cb(tweets.join(''));
                                                 });
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
    get username() { return this._username; },
    set password(value) { this._password = value; },
    get FORMATS() { return this._FORMATS; },
    get lastAPICall() { return this._lastAPICall; },
    'apiCall': apiCall
};
    
function Twitter(){
    Twitter.super_.apply(this, _.toArray(arguments));
}
sys.inherits(Twitter, TwitterBase);
Twitter.prototype.userTimeline = function(format, params, cb) {
    var authRequired = false;
    apiCall.call(this, 'statuses/user_timeline/' + this.username, 'GET', format || 'json', params || null, authRequired, cb);
};

function TweetCollector(stream) {
    this._stream = null;
    this._starter = function() { this._stream.start() };

    // This is a setter function that initializes the collector
    if(stream) this.stream = stream;
}
sys.inherits(TweetCollector, events.EventEmitter);
_.extend(TweetCollector.prototype, {
             get stream() {
                 return this._stream;
             },
             set stream(stream) {
                 if(stream && stream instanceof events.EventEmitter) {
                     this._stream = stream;
                     this.init(stream);
                 }
                 else throw Exception('TweetCollector requires a Readable Stream');
             },
             get starter() {
                 return this._starter;
             },
             set starter(starter) {
                 if(typeof starter == 'function') this._starter = starter;
                 else throw new Exception('The starter must be a function.');
             },
             ready: function() {
                 this.emit('ready');
             },
             start: function() {
                 this._starter();
             },
             init: function(stream) {
                 var _dataBuffer = '';
                 var startJSON = /^\s*\{/;
                 var endJSON   = /\}\s*$/;
                 
                 var tc = this;

                 function processChunk(chunk, dataBuffer) {
                     var pieces = (dataBuffer + chunk).split("\r");
                     var text   = pieces[0];

                     if(text && text.match(startJSON) && text.match(endJSON)) {
                         pieces.shift(); // shift the matched element
                                         // off the remaining chunk
                         return [text, pieces.join("\r")];
                     } else {
                         return [null, pieces.join("\r")];
                     }
                 }

                 stream.addListener('data', function (chunk) {

                                        var json_and_rest = processChunk(chunk, _dataBuffer);
                                        var tweet = json_and_rest[0];
                                        _dataBuffer = json_and_rest[1];
                                        if (tweet) tc.emit('tweet', tweet);
                                    });
                 stream.addListener('end', function () {
                                        tc.emit('complete', stream, _dataBuffer);
                                    });
             }
         });

function apiStreamCall(urlPath, method, format, params, authRequired) {

    if(_.include(this._FORMATS, format)) {
        urlPath += '.' + format;
    } else {
        throw new Error('The api call {' + urlPath + '} does not accept this format: ' + format);
    }

    method = method ? String(method).toUpperCase() : 'GET';

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

    this._lastAPICall = 'http://' + STREAM_HOST + STREAM_ENDPOINT + urlPath;

    var client = http.createClient(80, STREAM_HOST);
    var headers = {'Host': STREAM_HOST,
                   'User-Agent': 'node.js',
                   'Connection': 'Keep-Alive'
                  };
    if(authRequired) {
        var auth = (authRequired) ? (this._username + (this._password ? ':' + this._password : '')).base64Encode : '';
        headers['Authorization'] = 'Basic ' + auth;
    }
    if(method == 'post' && data) {
        headers['Content-Length'] = data.length;
    }

    var request = client.request(method, STREAM_ENDPOINT + urlPath, headers);
    
    if(method == 'post' && data) {
        request.write(data, 'utf8');
    }

    var tc = new TweetCollector();
    tc.starter = function() {
        request.end();
    };

    // convenient hook to get the request, not really needed
    tc.__defineGetter__('request', function(){
        return request;
    });

    request.addListener('response', function (response) {
                            if(response.statusCode == 200) {
                                response.setBodyEncoding("utf8");
                                tc.stream = response;

                                tc.ready();
                            } else {
                                throw new Error('Request failed: ' + response.statusCode);
                            }
                        });

    var clientClosed = false;
    tc.close = function() {
        if(!clientClosed) {
            client.destroy();
            clientClosed = true;
        }
    };

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

exports.TweetCollector = TweetCollector;
exports.TwitterBase = Twitter;
exports.Twitter = Twitter;
exports.TwitterStreamBase = TwitterStreamBase;
exports.TwitterStream = TwitterStream;
