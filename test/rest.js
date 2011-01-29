
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

var util = require('util')
        , fs = require('fs')
        , assert = require('assert')
        , _ = require('../lib/underscore')._
        , et = require('../lib/evented-twitter');

var creds = JSON.parse(fs.readFileSync(__dirname + '/credentials.json'))
    , oauth = creds.oauth;

assert.ok(creds);
delete creds.oauth;

assert.ok(oauth);

oauth.auth = 'oauth';

function ets(err, noStack) {
    if(!err) return '';
    else if(err.statusCode && err.data) {
        var data = JSON.parse(err.data);
        err = new Error(data.error + '(' + err.statusCode + '): ' + data.request);
        noStack = true;
    }
    return (err.name ? err.name + ': ' : '') +
           (err.message ? err.message + '\n' : '') +
           ( (!noStack && err.stack) ? err.stack : '');
}

function handler(name) {
    return function(err, data) {
        try {
            if(err) throw err;
            assert.ok(data && (_.isArray(data) ? !!data.length : true));
        } catch(e) {
            console.error('<Twitter.' + name + '>\n', ets(e), '\n\n\n');
        }
    }
}

function batch(tests, opts) {
    opts = opts || {};
    opts.batchSize = opts.batchSize || 1;
    opts.batchInt = opts.batchInt || 1000;
    for(var i=0; i < opts.batchSize; i++) {
        try {
            tests[i]();
        } catch(e) {
            console.error(ets(e), '\n\n\n');
        }
    }

    tests = _.rest(tests, i);
    if(tests.length) {
        setTimeout(function() {
                       batch(tests, opts );
                   }, opts.batchInt);
    }
}

var data;
var tweet;
var p = null;
var t = new et.Twitter(creds);

function testTimeline() {
    t.publicTimeline('json', oauth, handler('publicTimeline'));

    t.homeTimeline('json', oauth, handler('homeTimeline'));

    t.friendsTimeline('json', oauth, handler('friendsTimeline'));

    t.userTimeline('json', oauth, handler('friendsTimeline'));

    t.mentions('json', oauth, handler('friendsTimeline'));

    t.retweetedByMe('json', oauth, handler('retweetedByMe'));

    t.retweetedToMe('json', oauth, handler('retweetedToMe'));

    t.retweetsOfMe('json', oauth, handler('retweetsOfMe'));
}

function testUser() {
    p = _.extend({}, oauth, { screen_name: 'polotek' });
    t.showUser('json', p, handler('showUser'));

    t.lookup('json', p, handler('lookup'));

    p = _.extend({}, oauth, { q: 'polotek' });
    t.search('json', p, handler('search'));

    t.suggestions('json', oauth, handler('suggestions'));

    p = _.extend({}, oauth, { category: 'twitter' });
    t.suggestionsCategory('json', p, handler('suggestionsCategory'));

    //t.profileImage('json', oauth, handler('profileImage'));

    t.friends('json', oauth, handler('friends'));
    
    t.followers('json', oauth, handler('followers'));
}

function testTweet() {
    p = _.extend({}, oauth, { id: '30489217779896320' });
    t.showStatus('json', p, handler('showStatus'));

    //t.update('json', oauth, handler('update'));

    //t.destroy('json', oauth, handler('destroy'));
    
    //t.retweet('json', oauth, handler('retweet'));

    p = _.extend({}, oauth, { id: '30333475600998400' });
    t.retweets('json', p, handler('retweets'));

    t.retweetedBy('json', p, handler('retweetedBy'));

    t.retweetedByIds('json', p, handler('retweetedByIds'));
}


function testDM() {
    t.directMessages('json', oauth, handler('directMessages'));

    t.directMessagesSent('json', oauth, handler('directMessagesSent'));

    //t.directMessagesNew('json', oauth, handler('directMessagesNew'));
    
    //t.directMessagesDestroy('json', oauth, handler('directMessagesDestroy'));
}

batch([ testTimeline, testUser, testTweet, testDM ], { batchSize: 1 });