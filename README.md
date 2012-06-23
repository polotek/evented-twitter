Evented Twitter is an asynchronous twitter client for node.js.  I
supports the REST api and the Streaming API (no search yet).

## Usage

#### REST

    var util = require('util');

    var Twitter = require('evented-twitter').Twitter;
    var t = new Twitter('username', 'password');
    t.userTimeline('json', null, function(result) {
         // The response is not parsed for you
         try {
             json = JSON.parse(result);
         } catch(e) {}

         util.puts(util.inspect(json));
    });

    util.puts('Calling ' + t.lastAPICall);

You can inspect the Twitter function to see what methods are available

    util.puts(util.inspect(Twitter));

#### Streaming

    var util = require('util');

    var TwitterStream = require('evented-twitter').TwitterStream;
    var t = new TwitterStream('username', 'password');

    var params = {'track':'Twitter'};

    // statuses/sample from streaming api
    var stream = t.filter('json', params);

    // There are also functions for filter, links, retweet and firehose.
    // Fill out the params object with query params to them
    // i.e. params = {delimeter: 'length', track: 'Twitter'}

    // see the api call that is being made
    util.debug('Calling ' + t.lastAPICall);

    // "ready" is emitted when the stream is ready to go
    // Similar to how clientRequest emits "response"
    // Now you can attach events
    stream.addListener('ready', function() {
        stream.addListener('tweet', function(tweet) {
            if(!String(tweet).trim()) return;
            try {
                // The result is not parsed for you
                var t = JSON.parse(tweet);
                util.puts(util.inspect(t));
            } catch(e) {
                util.debug('\nProblem parsing: ' + tweet);
                util.debug(e.message);
                util.debug(e.stack);
            }
        });

        stream.addListener('complete', function(response) {
            stream.close();
        });
    });

    stream.addListener('error', function(err) {
        util.debug(err.message);
        throw err;
    });

    stream.start();

## The MIT License

Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
