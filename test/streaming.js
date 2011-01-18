
/**
 * Your credentials should be in a file called credentials.json.
 * The file can should have username and password and optionally
 * oauth credentials.
 *
 * The oauth can be left out entirely. If so, oauth authorization
 * will not be tested. If provided, the oauth credentials include
 * the following:
 *
 * - consumerKey: a consumer key for your app
 * - consumerSecret: a consumer secret for your app
 * - accessToken: access token for the current user
 * - accessTokenSecret: access token secret for the current user
 * - requestTokenURL (optional): request token URL
 * - accessTokenURL (optional): access token URL
 * - authorizeURL (optional): authorization URL
 *
 * The format of the credentials json is like so:
 *
 *
 * { "username": 'polotek',
 *   "password": 'NiceTryBuddy',
 *   "oauth": { "consumerKey": "your_consumer_key",
 *            "consumerSecret" : "your_consumer_secret",
 *            "accessToken": "access_token_for_this_user",
 *            "accessTokenSecret": "access_secret_for_this_user",
 *            "requestTokenURL" : "http://api.twitter.com/oauth/request_token",
 *            "accessTokenURL" : "http://api.twitter.com/oauth/access_token",
 *            "authorizeURL" : "https://api.twitter.com/oauth/authorize"}
 * }
 *
 */

var fs = require('fs'),
    assert = require('assert'),
    et = require('../lib/evented-twitter');

var creds = JSON.parse(fs.readFileSync(__dirname + '/credentials.json'))
    , oauth = creds.oauth;

assert.ok(creds);
delete creds.oauth;

assert.ok(oauth);

oauth.auth = 'oauth';

var data;
var tweet;
var t = new et.TwitterStream(creds);
//var t = new et.TwitterStream({oauth: oauth});
var s = t.sample('json');

s.on('ready', function() {
    s.on('data', function(chunk_data) {
        data = chunk_data
    });

    s.on('tweet', function(tweet_data) {
        try {
            tweet = JSON.parse(tweet_data);
        } catch(e) {
            assert.ifError(e);
        }
    });

    s.on('complete', function(response) {
        stream.close();
        throw new Error('"complete" event. Stream should not stop');
    });
});


var timer = setTimeout(function() {
    fs.writeFileSync('databuffer.json', s._dataBuffer.join('\n-\n-\n-part-\n-\n-\n'));
    assert.ok(data);
    assert.ok(tweet);
    s.close();
}, 2000);

s.on('error', function(err) {
    clearTimeout(timer);
    timer = setTimeout(function() {
        s.close();
    }, 2000);
    console.error(err.message, "\n", err.stack);
    var buffer = [];
    s.on('data', function(chunk) {
        buffer.push(chunk);
    });
    s.removeAllListeners('complete');
    s.on('complete', function() {
        clearTimeout(timer);
        s.close();
        console.error(buffer.join(''));
    });
});

s.start();
