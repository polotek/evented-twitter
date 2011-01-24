var fs = require('fs');
    OAuth = require('oauth').OAuth;

var config = JSON.parse( fs.readFileSync(__dirname + '/default_config.json') );
var oauth = config.oauth;

console.warn(oauth);

var oa = new OAuth(oauth.requestTokenURL
                   , oauth.accessTokenURL
                   , oauth.consumerKey
                   , oauth.consumerSecret
                   , "1.0"
                   , null
                   , "HMAC-SHA1");

oa.getOAuthRequestToken(function(err, oauth_token, oauth_token_secret, results){
                            if(err) throw err;

                            console.warn(oauth.authorizeURL + '?oauth_token=' + oauth_token + "\n");
                            var stdin = process.openStdin();
                            console.warn('PIN: ');
                            stdin.on('data', function(d) {
                                         d = (d+'').trim();
                                         if(!d) {
                                             console.warn('\nTry again: ');
                                         }
                                         console.warn('Received PIN: ' + d);
                                         oa.getOAuthAccessToken(oauth_token
                                                                , oauth_token_secret
                                                                , d
                                                                , function(err, oauth_access_token, oauth_access_token_secret, results2) {
                                                                    if(err) throw err;

                                                                    console.log(results2);

                                                                    if(results2) {
                                                                        config.user_id = results2.user_id;
                                                                        config.screen_name = results2.screen_name;
                                                                    }

                                                                    oauth.accessToken = oauth_access_token;
                                                                    oauth.accessTokenSecret = oauth_access_token_secret;

                                                                    fs.writeFileSync(__dirname + '/credentials.json', JSON.stringify(config));
                                                                    stdin.destroySoon();
                                                                });
                                     });
                        });