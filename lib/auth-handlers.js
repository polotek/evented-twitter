var _ = require('./underscore')._
        , OAuth = require('oauth').OAuth
        , ra = require('./request-adapters');

var DEFAULT_AUTH_OBJECT = { headers: null, proxy: null }

function basic_authenticate(opts) {
    if(!opts.username || !opts.password)
        throw new Error('You must provide a username and password');

    headers = opts.headers || {};
    var auth = new Buffer(opts.username + (opts.password ? ':' + opts.password : '')).toString('base64');
    headers['Authorization'] = 'Basic ' + auth;
    return _.extend({}, DEFAULT_AUTH_OBJECT, {headers: headers});
}

var DEFAULT_OAUTH_CONFIG = { requestTokenURL : "http://api.twitter.com/oauth/request_token"
                             , accessTokenURL : "http://api.twitter.com/oauth/access_token"
                             , authorizeURL : "https://api.twitter.com/oauth/authorize"
                           };

function oauth_authenticate(opts) {
    if(!opts.consumerKey || !opts.consumerSecret)
        throw new Error('You must provide the consumer key and consumer secret');

    var config = _.extend({}, DEFAULT_OAUTH_CONFIG, opts);

    var oa = new OAuth(config.requestTokenURL
                       , config.accessTokenURL
                       , config.consumerKey
                       , config.consumerSecret
                       , "1.0", null, "HMAC-SHA1"); 

    config.proxy = ra.createRequestAdapter('oauth', oa);
    return _.extend({}, DEFAULT_AUTH_OBJECT, config);
}

var basicAuthHandler = exports.basicAuthHandler = { authenticate: basic_authenticate };
var oAuthHandler = exports.oAuthHandler = { authenticate: oauth_authenticate };
exports.handlers = { basic: basicAuthHandler
                     , oauth: oAuthHandler }