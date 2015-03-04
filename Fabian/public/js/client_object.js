var XDClient = {
	serverPeer : null,
	deviceId : null,

	availablePeers : [],
	connections : [],
	objectsToSync : [],
	roles : [],

	connectToServer : function(userId, host, port) {
		//TODO: reconnect
		if(host == null) {
			host = "localhost";
		}

		if(port == null) {
			port = 9000;
		}

		console.log("Trying to connect to server...");
		this.serverPeer = new Peer(userId, {
			host: host,
			port: port
		});

		this.peer.on('open', function(id) {
			console.log("Connection successfull. Current id: " + id);
			userId = id;
			//TODO: GIVE FEEDBACK
			this.requestAvailablePeers();
		});

		this.serverPeer.on('connection', this.handleConnection);
		this.serverPeer.on('error', this.handleError);
	},

	requestAvailablePeers : function() {
		this.serverPeer.listAllPeers(function(peers) {
			this.availablePeers = [];
			this.connections = [];
			peers.filter(function(p) {
				return p != this.deviceId;
			}).forEach(function(p) {
				this.availablePeers.push(p);
				//TODO: LIST AVAILABLE PEERS
			})
		});
	},

	connectToPeer : function(peer) {
	    var conn = this.serverPeer.connect(peer);
		conn.on('open', function() {
			this.handleConnection(conn);
		});
		conn.on('error', this.handleError);
	},

	handleConnection : function(conn) {
		console.log("Connection from: " + conn.peer);

		conn.on('open', this.hadleOpen(conn));

		conn.on('data', this.handleData);

		conn.on('close', this.handleClose);

		conn.on('error', this.handleError);
	},

	handleOpen : function(conn) {
		if(this.connections.indexOf(conn) == -1) {
			console.log("Connection opened with: " + conn.peer);
			this.connections.push(conn.peer);
		}
	},

	handleData : function(data) {
		console.log('Data received: ' + data);
		//TODO HANDLE DATA
	},

	handleClose : function(conn) {
		if(this.connections.indexOf(conn) != -1) {
			this.connections.splice(this.connections.indexOf(conn), 1);
			console.log('Connection closed to: ' + conn.peer);
		}
	},

	publish: function(text) {
		this.connections.forEach(function(conn) {
			if(conn.open) {
				conn.send(text);
				console.log(message + ' sent to: ' + conn.peer);
			} else {
				console.log(message + ' not sent to: ' + conn.peer);
				this.handleClose(conn);
			}
		})
	}
}
