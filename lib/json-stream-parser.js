// evented-twitter Copyright 2010 - Marco Rogers <http://marcorogers.com/>
// (MIT Licensed - http://www.opensource.org/licenses/mit-license.php)

var sys = require('sys');
var events = require('events');
var _ = require('./underscore')._;

function JSONStreamParserBase(opts) {
    events.EventEmitter.call(this);

    opts = opts || {};

    this._debug = !!opts.debug || false;
    this._debug = true;
    this._dataBuffer = this._debug ? [] : null;

    var delim = opts.delimiter || "\r";
    if(opts.tokenizer) {
        this._bt = opts.tokenizer.getInstance(delim);
    } else {
        this._bt = require('./buffered-tokenizer').createBufferedTokenizer(delim);
    }

    this._stream = null;

    // This is a setter function that initializes the collector
    if(opts.stream) this.stream = opts.stream;
}
sys.inherits(JSONStreamParserBase, events.EventEmitter);
_.extend(JSONStreamParserBase.prototype, {
    get stream() {
        return this._stream;
    }
    , set stream(stream) {
        if(stream && stream instanceof events.EventEmitter) {
            this._stream = stream;
        }
        else throw new Error('BasicJSONStreamParser requires a Readable Stream');
    }
    , ready: function() {
        if(!this._stream) throw new Error("TweetStreamParser isn't ready until you give it a stream");
        var tc = this;
        this._stream.addListener('data', function (chunk) {
            if(this._debug) {
                tc._dataBuffer.push(chunk);
            }
            tc.emit('data', chunk);
            var tweets = tc.process(chunk);
            for(var i = 0; i < tweets.length; i++) {
                tc.emit('tweet', tweets[i]);
            }
        });
        this._stream.addListener('end', function () {
            tc.emit('complete', this._stream);
        });

        this.emit('ready');
    }
    , onReady: function(func) {
        if(typeof func == 'function')
            this.start = func;
        else
            throw new Error('onReady requires a function');
    }
    , start: function() { throw new Error('Try setting a start function with onReady'); }
    , process: function(chunk) {
        return this._bt.parse(chunk);
    }
});

function BasicJSONStreamParser() {
    JSONStreamParserBase.apply(this, arguments);
};
sys.inherits(BasicJSONStreamParser, JSONStreamParserBase);

/*
var yajljs = require('yajl-js');
function YajlJSONStreamParser(stream, cfg) {
    this.config = _.extend({
        checkUTF8: true
        //, allowComments: 1,
    }, cfg);

    var self = this;
    var tokenizer = {
        getInstance: function() {
            return yajljs.createHandle(self.config);
        }
    };

    JSONStreamParserBase.call(this, stream, tokenizer);
    this.init();
}
sys.inherits(YajlJSONStreamParser, JSONStreamParserBase);
var proto = (function() {
    var arrayStack = 0
    , objStack = 0
    , buf = [];

    return {
        init: function() {
            var self = this;
            this._bt.addListener('startMap', function() {
                objStack++;
            });
            this._bt.addListener('endMap', function() {
                objStack--;
                if(objStack === 0) {
                    self.emit('tweet', buf.join(''));
                    buf = [];
                }
            });
            this._bt.addListener('end', function() {
                this._bt.parseComplete();
            });
            this._bt.addListener('error', function(err) {
                throw err;
            });
            this.init = function(){};
        }
        , process: function(chunk) {
            buf.push(chunk);
            this._bt.parse(chunk);
        }
    };
})();
_.extend(YajlJSONStreamParser.prototype, proto);
*/

var parsers = {};
exports.BasicJSONStreamParser
    = parsers['default']
    = parsers['basic']
    = BasicJSONStreamParser;

/*
exports.YajlJSONStreamParser
    = parsers.yajl
    = YajlJSONStreamParser;
*/

exports.createJSONParser = function(type, parserCfg) {
    return (type && parsers[type]) ?
        new parsers[type](parserCfg)
        : new parsers['default'](parserCfg);
}