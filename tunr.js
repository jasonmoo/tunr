require.paths.unshift(__dirname+"/lib/node");

// general
var sys = require('sys'),
  crypto = require('crypto'),
  URL = require('url'),
  http = require('http'),
  qs = require('querystring').stringify;

// express
var express = require('express'),
  app = express.createServer(
    // express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time' }),
    express.errorHandler()
  );

// config
var c = require('./config'),
  t = c.twitter,
  f = c.facebook,
  m = c.mongo,
  tunr = c.tunr;
  
// oauth
var OAuth = require('node-oauth').OAuth,
  OAuth2 = require('node-oauth').OAuth2,
  twitter = new OAuth(t.request_token_url, t.access_token_url, t.consumerkey, t.consumersecret, "1.0", null, "HMAC-SHA1"), // oauth_callback will be supplied at request time
  facebook = new OAuth2(f.appid, f.appsecret,f.base_url);

// mongodb
var Db = require('mongodb').Db,
  Server = require('mongodb').Server,
  BSON = require('mongodb').BSONPure;


// adding a post method for our purposes
facebook.post = function(url,post_data,access_token,callback) {
    var creds = crypto.createCredentials({ }),
      parsedUrl= URL.parse( url, true ),
      headers = {};
      
    if( parsedUrl.protocol == "https:" && !parsedUrl.port ) parsedUrl.port= 443;
    var httpClient = http.createClient(parsedUrl.port, parsedUrl.hostname, true, creds);
      
    post_data["access_token"] = access_token;
    postData = qs(post_data);

    headers['Host']= parsedUrl.host;
    headers["Content-Type"]= "application/x-www-form-urlencoded";
    headers['Content-Length'] = postData.length;

    var request = httpClient.request('POST', parsedUrl.pathname, headers );   

    if (!callback) {
      request.write(postData);
      return request;
    }

    var data=""; 
    var self= this;
    request.addListener('response', function (response) {
      response.setEncoding('utf8');
      response.addListener('data', function (chunk) {
        data+=chunk;
      });
      response.addListener('end', function () {
        if( response.statusCode != 200 ) {
          callback({ statusCode: response.statusCode, data: data });
        } else {
          callback(null, data, response);
        }
      });
    });

    request.socket.addListener("error",callback);
    request.write(postData);
    request.end();
};

function make_post(time,accuracy) {
  var time = ~~time,
    minutes = ~~(time/60),
    seconds = time%60,
    time_text = minutes ? minutes+' minute'+(minutes>1?'s':'')+', '+seconds+' seconds' : seconds+' seconds';
    accuracy = ~~accuracy+'%';
  return 'I played #tunr in '+time_text+' with '+accuracy+' accuracy. '+tunr.shortlink;
}

app.get('/twitter', function(req, res) {
  var uri = t.return_url+"?"+qs({time:req.query.time,accuracy:req.query.accuracy}); // sneaky way to pass vars back to the return uri
  twitter.getOAuthRequestToken({oauth_callback:uri},function(error, oauth_token, oauth_token_secret, results){
    if (error) 
      return fail("Request Token call failed: "+sys.inspect(error),req,res);
    res.redirect(t.authorize_url+'?'+qs({oauth_token:oauth_token}));
  });
});

app.get('/twitter/return', function(req, res){
  if (!req.query.oauth_token) {
    return fail('Missing oauth token...',req,res);
  }
  twitter.getOAuthAccessToken(req.query.oauth_token, null, req.query.oauth_verifier, function(error, access_token, access_token_secret, results2) {
    if (error) {
      return fail("Access Token call failed.",req,res);
    }
    if (!req.query.time || !req.query.accuracy) {
      return fail("Missing cookie information..",req,res);
    }
    var tweet = make_post(req.query.time,req.query.accuracy);
    twitter.post("http://api.twitter.com/1/statuses/update.json", access_token, access_token_secret, { status: tweet }, function (error, data, response) {
      if (error) 
        return fail("Tweet fail...",req,res);
      data = JSON.parse(data);
      var db = new Db(m.dbname, new Server(m.domain,m.port,{}));
      db.addListener('error',function(e) {sys.puts(sys.inspect(e))});
      db.open(function(err, db) {
        db.collection(m.collection, function(err, collection) {
          collection.save({
            'type': 'tw',
            'userid':data.user.id,
            'time':req.query.time,
            'accuracy':req.query.accuracy
          },function() { 
            db.close(); 
          });
        });
      });
      res.redirect(t.success_redirect);
    });  
  });
});

app.get('/facebook', function(req, res) {  
  res.redirect(f.authorize_url+'?'+qs({
    client_id: f.appid,
    scope: 'publish_stream',
    redirect_uri: f.return_url+"?"+qs({time:req.query.time,accuracy:req.query.accuracy}) // sneaky way to pass the vars back to the return url
  }));
});

app.get('/facebook/return', function(req, res){
  if (req.query.error_reason || !req.query.code) {
    return fail('Facebook said something failed..',req,res);
  }
  var uri = f.return_url+"?"+qs({time:req.query.time,accuracy:req.query.accuracy}); /* must match redirect uri exactly */
  facebook.getOAuthAccessToken(req.query.code,{ redirect_uri: uri }, function(error, access_token) {
    if (error) {
      return fail("Access Token call failed."+sys.inspect(error),req,res);
    }
    if (!req.query.time || !req.query.accuracy) {
      sys.puts(sys.inspect(req.query));
      return fail("Missing score information..",req,res);
    }
    var post = make_post(req.query.time,req.query.accuracy);
    facebook.post("https://graph.facebook.com/me/feed", { message: post }, access_token, function (error, data, response) {
      if (error) 
        return fail("Facebook post fail...",req,res);
      data = JSON.parse(data);
      var db = new Db(m.dbname, new Server(m.domain,m.port,{}));
      db.addListener('error',function(e) {sys.puts(sys.inspect(e))});
      db.open(function(err, db) {
        db.collection(m.collection, function(err, collection) {
          collection.save({
            'type': 'fb',
            'userid':data.id.split('_')[0], // userid_postid 
            'time':req.query.time,
            'accuracy':req.query.accuracy
          },function() { 
            db.close(); 
          });
        });
      });
      res.redirect(f.success_redirect);
    });  
  });
});

app.get('/fail',function(req,res) {
  sys.puts('fail');
  res.send('Wow.  Something really bad happened.  <a href="mailto:jason@barkingsnake.com">Email me</a> so I can fix it please.  :)<br />');  
});
var fail = function(err, req, res, next) {
  sys.puts('errrrooorrrrr');
  sys.puts(err);
  res.redirect('/fail');
}
app.error(fail);


app.listen(3000);
