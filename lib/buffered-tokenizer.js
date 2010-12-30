// BufferedTokenizer - Originally by halorgium (Tim Carey-Smith)
// -- refactored from EM::BufTok

var BufferedTokenizer = function (delimiter, size_limit) {
    this.delimiter = delimiter || "\n";
    this.size_limit = size_limit;
    this.input = [];
    this.input_size = 0;
}

// Extract takes an arbitrary string of input data and returns an array of
// tokenized entities, provided there were any available to extract.  This
// makes for easy processing of datagrams using a pattern like:
//
//   tokenizer.parse(data).map { |entity| Decode(entity) }.each do ...
BufferedTokenizer.prototype.parse = function (data) {
    // Extract token-delimited entities from the input string with the split command.
    // There's a bit of craftiness here with the -1 parameter.  Normally split would
    // behave no differently regardless of if the token lies at the very end of the
    // input buffer or not (i.e. a literal edge case)  Specifying -1 forces split to
    // return "" in this case, meaning that the last entry in the list represents a
    // new segment of data where the token has not been encountered
    var entities = data.split(this.delimiter, -1);

    // Check to see if the buffer has exceeded capacity, if we're imposing a limit
    if (this.size_limit) {
        if (this.input_size + entities[0].length > this.size_limit) {
            throw('input buffer full');
        }
        this.input_size += entities[0].length;
    }

    // Move the first entry in the resulting array into the input buffer.  It represents
    // the last segment of a token-delimited entity unless it's the only entry in the list.
    this.input.push(entities.shift());

    // If the resulting array from the split is empty, the token was not encountered
    // (not even at the end of the buffer).  Since we've encountered no token-delimited
    // entities this go-around, return an empty array.
    if (entities.length == 0) {
        return [];
    }

    // At this point, we've hit a token, or potentially multiple tokens.  Now we can bring
    // together all the data we've buffered from earlier calls without hitting a token,
    // and add it to our list of discovered entities.
    entities.unshift(this.input.join(''));

    // Now that we've hit a token, joined the input buffer and added it to the entities
    // list, we can go ahead and clear the input buffer.  All of the segments that were
    // stored before the join can now be garbage collected.
    this.input.length = 0;

    // The last entity in the list is not token delimited, however, thanks to the -1
    // passed to split.  It represents the beginning of a new list of as-yet-untokenized
    // data, so we add it to the start of the list.
    this.input.push(entities.pop());

    // Set the new input buffer size, provided we're keeping track
    if (this.size_limit) {
        this.input_size = this.input[0].size;
    }

    // Now we're left with the list of extracted token-delimited entities we wanted
    // in the first place.  Hooray!
    return entities;
}

// Flush the contents of the input buffer, i.e. return the input buffer even though
// a token has not yet been encountered
BufferedTokenizer.prototype.flush = function () {
    var buffer = this.input.join('');
    this.input.length = 0;
    return buffer;
}

// Is the buffer empty?
BufferedTokenizer.prototype.empty = function () {
    return this.input.length == 0;
}

exports.BufferedTokenizer = BufferedTokenizer;
exports.createBufferedTokenizer = exports.getInstance = function(delim) { return new BufferedTokenizer(delim); };