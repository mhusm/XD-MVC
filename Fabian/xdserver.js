exports.start = function(port){
	var PeerServer = require('peer').PeerServer;
	var pserver = new PeerServer({port: port, allow_discovery: true});

	pserver.on('connection', function(id) {
		console.log(id +" connected");
	    // TODO create event
	});

	pserver.on('disconnect', function(id) {
		console.log(id +" disconnected");
	    // TODO create event
	});

}
