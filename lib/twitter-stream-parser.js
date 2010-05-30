// evented-twitter Copyright 2010 - Marco Rogers <http://marcorogers.com/>
// (MIT Licensed - http://www.opensource.org/licenses/mit-license.php)

var sys = require('sys');
var events = require('events');
var _ = require('./underscore')._;

function TwitterStreamParser(stream) {
    events.EventEmitter.call(this);
    this._stream = null;

    // This is a setter function that initializes the collector
    if(stream) this.stream = stream;
}
sys.inherits(TwitterStreamParser, events.EventEmitter);
_.extend(TwitterStreamParser.prototype, {
    get stream() {
        return this._stream;
    }
    , set stream(stream) {
        if(stream && stream instanceof events.EventEmitter) {
            this._stream = stream;
        }
        else throw new Error('TwitterStreamParser requires a Readable Stream');
    }
    , ready: function() {
        if(!this._stream) throw new Error("TweetStreamParser isn't ready until you give it a stream");
        var tc = this;
        this._stream.addListener('data', function (chunk) {
            var tweet = tc.process(chunk);
            if (tweet) tc.emit('tweet', tweet.join(''));
        });
        this._stream.addListener('end', function () {
            tc.emit('complete', stream);
        });

        this._bt = require('./buffered-tokenizer').instance("\r");

        this.emit('ready');
    }
    , start: function() {
        this.request.end();
    }
    , process: function(chunk) {
        return this._bt.extract(chunk);
    }
});

exports.TwitterStreamParser = TwitterStreamParser;
exports.instance = function() { return new TwitterStreamParser(); }