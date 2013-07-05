var express = require('express');  
var io = require('engine.io');
var redis = require('iris-redis');

// set up express to return static resources

var app = express();

// Configure express to allow websckets to be a bit looser on who they accept connections from. 
// Firefox is a pain for this, especially if you go with a hosted solution like nodejitsu

app.configure(function() {
    app.use(function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "X-Requested-With");
      next();
    });
});

// Create the http server and attach engine.io to it

var http = require('http').createServer(app).listen(8080);

var socket = io.attach(http);

// Configure redis PUB/SUB

// Create the publication connection

var pub = redis.createClient();

pub.on("ready", function() {
});

pub.on("end", function() {
});

pub.on("error", function(e) {
	console.log("Publication error!");
	console.log(e);
});

// Create the subscription connection

var sub = redis.createClient();

// Set the refresh timer Id. Subscriptions need to be refreshed after a certain amount of time or they are cancelled

var refreshIntervalId = null;

sub.on("ready", function() {

	// Subscribe to the channel

	sub.subscribe("subscription-channel");

	console.log("Subscribed to messages :)");

	// Clear any existing refresh subscription timers
	
	if (refreshIntervalId != null) {
		clearInterval(refreshIntervalId);
	}

	// Set up the subscription to renew after 10 minutes

	refreshIntervalId = setInterval(function() {
		sub.subscribe("subscription-channel");

		console.log("Refreshed subscription!");
	}, (10*60000));

	// Publish any messages received through redis over this servers websockets

	sub.on("message", function(channel, message) {
		console.log("subscription package received: " + message);

		for( var key in socket.clients ) {	 
			if(typeof message.sendingClientId !== 'undefined') {
				
				// Don't broadcast to sending client

				if( key == message.sendingClientId ) {
					console.log("Found sending client!");

					continue;
				}
			}
	 
	 		console.log("broadcasting to: " + key)
			
			socket.clients[key].send(message);

			console.log("package sent!");
		}
	});
});

sub.on("end", function() {
	console.log("No longer subscribed to messages :(");
});

sub.on("error", function(e) {
	console.log("Subscription error!");
	console.log(e);
});

// Create socket connection and configure to publish through Redis

socket.on('connection', function (client) {
	console.log("connected: " + client.id);

	// When connected send a little package. This helps with firewalls and firefox

	client.send('123456');
	  
  	client.on('message', function (data) {
		data.sendingClientId = client.id;

		try
		{
			// Send through the redis channel

			pub.publish("subscription-channel", data);
		}
		catch (err) {
			console.log("Error publishing: " + err);
		}
  	});
});