var peer;
var userId;

var availablePeers = [];
var connections = [];
var objectsToSync = [];

Object.observe(objectsToSync, function(changes) {
		changes.forEach(function(change) {
			//console.log(change.type, change.name, change.oldValue);
			console.log(change.oldValue.toString(), objectsToSync[change.name].toString());
			console.log(objectsToSync[change.name].toString());
			if(change.oldValue.toString() != objectsToSync[change.name].toString()) {
				sendText(objectsToSync[change.name].toString());
			}
		});
	});

function connectToServer(){
	console.log("Trying to connect to server...");
	peer = new Peer({host: "localhost", port: 9000});
	peer.on("open", function(id){
		console.log("Connection successfull. Current id: " + id);
		userId = id;
		document.getElementById("myId").innerHTML = "<hr />Your Id: " + userId + "<hr />";
		requestAvailablePeers();
	});

	peer.on("connection", handleConnection);
	peer.on("error", function(err) { handleError(err)});
}

function requestAvailablePeers() {
	peer.listAllPeers(function (peers) {
        availablePeers = [];
		connections = [];
        peers.filter(function(p) {
			return p != userId;
		}).forEach(function (p) {
				/*var conn = peer.connect(p);
			    conn.on('open', function() {
			           handleConnection(conn);
			    });
			    conn.on('error', function(err) { handleError(err); });*/
				availablePeers.push(p);
				document.getElementById("peers").innerHTML = document.getElementById("peers").innerHTML + '<input type="checkbox" value="' + p + '">' + p + '<br />';
            });
		document.getElementById("peers").innerHTML = document.getElementById("peers").innerHTML + '<button onclick="connectToSelectedPeers();">Connect!</button>';
		console.log("Currently available peers: " + availablePeers.length);
    });
}

function sendText(text) {
	var message = text;
	connections.forEach(function(conn) {
		if(conn.open) {
			conn.send(text);
			//conn.send(document.getElementById("text").value);
			console.log(message +" sent to: " + conn.peer);
		} else {
			console.log(message + " not sent to: " + conn.peer);
		}
	});
}

function connectToSelectedPeers() {
	var collection = document.getElementById('peers')
							 .getElementsByTagName('INPUT');

	for (var x=0; x<collection.length; x++) {
	    if (collection[x].type.toUpperCase()=='CHECKBOX' && collection[x].checked == 1) {
			var conn = peer.connect(collection[x].value);
			conn.on('open', function() {
			   handleConnection(conn);
			});
			conn.on('error', function(err) { handleError(err); });
	    }
	}
}
/*
function handleConnection(dataConnection) {
	//alert("connection!");
	dataConnection.on("open", function() {
		console.log("Incoming Connection from: " + dataConnection.peer);
		//dataConnection.send("Message received!");
		connections.push(dataConnection);

		dataConnection.on("data", function(data) {
			alert(data);
		});
	});
}*/

function addConnection(conn) {
    console.log("New connection: " + conn.peer);
    console.trace();
	if(connections.indexOf(conn) == -1) {
		connections.push(conn);
	}
}

// TODO maybe the developer/user should be able to specify an order.
// Order is not enough for some cases, take into account device roles?

function handleOpen() {
}

function handleConnection(conn) {
		console.log("Connection from: " + conn.peer);

		conn.on('error', function(err) {
			handleError(err)
		});
		conn.on('data', function(data) {
			handleData(data);
		});
		conn.on('open', function() {
			console.log("Open");
			if(connections.indexOf(conn) == -1) {
				connections.push(conn.peer);
			}
		});
		conn.on('close', function() {
			handleClose(conn)
		});
		if(connections.indexOf(conn) == -1) {
			connections.push(conn);
		}
}

function handleData(msg) {
	console.log("Data received: " + msg);
	map.setCenter(new google.maps.LatLng(msg));
}

function handleError(err) {
	alert("ERROR: " + err);
}

function handleClose(conn) {
	connections.splice(connections.indexOf(conn),1);
}
