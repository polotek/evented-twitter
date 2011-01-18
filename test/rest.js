
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

function handler(name) {
    return function(err, data) {
        assert.ifError(err, name);
        assert.ok(data && data.length > 0);
    }
}

var data;
var tweet;
var t = new et.Twitter(creds);

    t.publicTimeline('json', oauth, handler('publicTimeline'));
    
    t.homeTimeline('json', oauth, handler);

    t.friendsTimeline('json', oauth, handler);

    t.userTimeline('json', oauth, handler);
    
    t.mentions('json', oauth, handler);

    t.retweetedByMe('json', oauth, handler);

    t.retweetedToMe('json', oauth, handler);

    t.retweetsOfMe('json', oauth, handler);

    t.show('json', oauth, handler);

    t.update('json', oauth, handler);

    t.destroy('json', oauth, handler);

    t.retweet('json', oauth, handler);

    t.retweets('json', oauth, handler);

    t.retweetedBy('json', oauth, handler);

    t.retweetedByIds('json', oauth, handler);

    t.friends('json', oauth, handler);

    t.followers('json', oauth, handler);

    t.lookup('json', oauth, handler);

    t.search('json', oauth, handler);

    t.suggestions('json', oauth, handler);

    t.suggestionsCategory('json', oauth, handler);

    t.directMessages('json', oauth, handler);

    t.directMessagesSent('json', oauth, handler);

    t.directMessagesNew('json', oauth, handler);

    t.directMessagesDestroy('json', oauth, handler);