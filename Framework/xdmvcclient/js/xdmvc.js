/*global console, CustomEvent, Peer, Event */
'use strict';
/*jslint plusplus: true */
var XDmvc = {
	peer : null,
	connections : [],
    attemptedConnections : [],
	deviceId : undefined,
    device: {},
    othersDevices: {small:0, medium:0, large:0},
	syncData : {},
	lastSyncId : 0,
	storedPeers: [],
	reconnect: false,
	myPosition: {value: -1},
    roles: [], // roles that this peer has
    othersRoles: {}, // roles that other peers have
    availablePeers: [],
	
	connectToServer : function (userId, host, port) {
        // If not connected already
        if (!XDmvc.peer) {
            XDmvc.deviceId = userId;
            XDmvc.peer = new Peer(userId, {
                host: host,
                port: port,
                //           debug: 3,
                // There is still an issue sometimes with connecting remote devices. But not consistently
                // Not sure whether the STUN servers help
                config: { 'iceServers': [
                    {url: 'stun:stun.l.google.com:19302'},
                    {url: 'stun:stun1.l.google.com:19302'},
                    {url: 'stun:stun2.l.google.com:19302'},
                    {url: 'stun:stun3.l.google.com:19302'},
                    {url: 'stun:stun4.l.google.com:19302'}
                ]}
            });
            XDmvc.peer.on('connection', XDmvc.handleConnection);
            XDmvc.peer.on('error', XDmvc.handleError);
            if (XDmvc.reconnect) {
                XDmvc.connectToStoredPeers();
            }

            // Check periodically who is connected.
            window.setInterval(XDmvc.requestAvailablePeers, 5000);
        }
	},

    // TODO integrate this from Fabian
    requestAvailablePeers: function () {
		XDmvc.peer.listAllPeers(function (peers) {
            XDmvc.availablePeers.length = 0;
            var peer;
            peers.filter(function (p) {
                return p !== XDmvc.deviceId && !XDmvc.connections.some(function (el) {return el.peer === p; });
            })
                .forEach(function (peer) {
                    XDmvc.availablePeers.push(peer);
                });
        });
        
    },
	
	connectToStoredPeers: function () {
		XDmvc.storedPeers.forEach(XDmvc.connectTo);
	},
	
	storePeers: function () {
		localStorage.peers = JSON.stringify(XDmvc.storedPeers);
	},
    
    removeStoredPeer: function (peerId) {
        var index = XDmvc.storedPeers.indexOf(peerId);
        if (index > -1) {
            XDmvc.storedPeers.splice(index, 1);
            XDmvc.storePeers();
        }
    },
    
	loadPeers: function () {
		if (localStorage.peers) {
            XDmvc.storedPeers.length = 0;
			var peers = JSON.parse(localStorage.peers);
            peers.forEach(function (peer) {
                XDmvc.storedPeers.push(peer);
            });
		}
    },


	handleOpen : function () {
		console.log('open');
		var conn = this;
        console.log(conn.peer);
        
        XDmvc.addConnection(conn);
        if (XDmvc.storedPeers.indexOf(conn.peer) === -1) {
			XDmvc.storedPeers.push(conn.peer);
			XDmvc.storePeers();
		}
		var others = XDmvc.connections.filter(function (el) {return el.peer !== conn.peer; })
                    .map(function (el) {return el.peer; });
		this.send({type: 'connections', data: others });

        //TODO also send state of synchronised objects
        
        XDmvc.sendRoles();
        XDmvc.sendDevice();

        // Send the current state the newly connected device
        if (conn.sendSync) {
            Object.keys(XDmvc.syncData).forEach(function (element, index) {
                console.log(element);
                console.log(XDmvc.syncData[element]);
                XDmvc.syncData[element].syncFunction();
            });
            conn.sendSync = false;
        }

	},
	
	handleConnection : function (conn) {
		console.log("connection");
        console.log(conn.peer);
		conn.on('error', XDmvc.handleError);
		conn.on('data', XDmvc.handleData);
		conn.on('open', XDmvc.handleOpen);
		conn.on('close', XDmvc.handleClose);
        XDmvc.attemptedConnections.push(conn);

        // Flag that this peer should receive state on open
        conn.sendSync = true;

	},
	
	handleData : function (msg) {
        var old, event, ids;
		console.log(msg);
		if (Object.prototype.toString.call(msg) === "[object Object]") {
			// Connect to the ones we are not connected to yet
			if (msg.type === 'connections') {
				ids = XDmvc.connections.map(function (el) {return el.peer; });
				msg.data.filter(function (el) { return ids.indexOf(el) < 0; }).forEach(function (el) {
					XDmvc.connectTo(el);
				});
			} else if (msg.type === 'data') {
				event = new CustomEvent('XDdata', {'detail': msg.data});
				document.dispatchEvent(event);
			} else if (msg.type === 'roles') {
                old = this.roles;
                this.roles = msg.data;
                XDmvc.updateOthersRoles(old, this.roles);
            } else if (msg.type === 'device') {
                this.device = msg.data;
                XDmvc.othersDevices[msg.data.type] +=1;
                event = new CustomEvent('XDdevice', {'detail': msg.data});
                document.dispatchEvent(event);
            } else if (msg.type === 'sync') {
		//		console.log(msg);
				XDmvc.update(XDmvc.syncData[msg.id].data, msg.data, msg.id);
				if (XDmvc.syncData[msg.id].callback) {
					XDmvc.syncData[msg.id].callback.apply(undefined, [msg.data, msg.id]);
				}
			} else if (msg.type === 'role') {
                if (msg.operation === "add") {
                    XDmvc.addRole(msg.role);
                } else {
                    XDmvc.removeRole(msg.role);
                }
			} else {
                console.log("received unhandled msg type");
                console.log(msg);
            }
		}
	},
	
    updateOthersRoles: function (oldRoles, newRoles) {
        var added = newRoles.filter(function (r) { return oldRoles ? oldRoles.indexOf(r) === -1 : true; });
        var removed = oldRoles ? oldRoles.filter(function (r) { return newRoles.indexOf(r) === -1; }) : [];
        var roles = XDmvc.othersRoles;
        var event;
        
        
        added.forEach(function (a) {
            roles[a] = roles[a] ? roles[a] + 1 : 1;
        });
        removed.forEach(function (r) {
            roles[r] = roles[r] && roles[r] > 0 ? roles[r] - 1 : 0;
        });

        // TODO check whether there really was a change? Report added and removed?
        event = new CustomEvent('XDothersRolesChanged');
        document.dispatchEvent(event);
    },
	
	handleError : function (err) {
		console.log(err);
		XDmvc.cleanUpConnections();
		var event = new Event('XDerror');
		document.dispatchEvent(event);
        
        var peerError = "Could not connect to peer ";
        if (err.message.indexOf(peerError) === 0) {
            var peer = err.message.substring(peerError.length);
            var conn = XDmvc.getAttemptedConnection(peer);
            var index = XDmvc.attemptedConnections.indexOf(conn);
            if (index > -1) {
                XDmvc.attemptedConnections.splice(index, 1);
            }
        }
	},
	
	cleanUpConnections : function () {
		var closed = XDmvc.connections.filter(function (c) {
 //           console.log(c.peer);
 //           console.log(c.open);
			return !c.open;
		});
		
		var len = closed.length,
            i;
		for (i = 0; i < len; i++) {
			XDmvc.removeConnection(closed[i]);
		}
	},

	handleClose : function () {
		XDmvc.removeConnection(this);
	},
	
	removeConnection: function (connection) {
		var index = XDmvc.connections.indexOf(connection);
		console.log("removed " + connection.peer);
		if (index > -1) {
			XDmvc.connections.splice(index, 1);
			XDmvc.sortConnections(XDmvc.compareConnections);
		}
        XDmvc.updateOthersRoles(connection.roles, []);

        if (connection.device) {
            XDmvc.othersDevices[connection.device.type] -=1;
        }
        
        index = XDmvc.attemptedConnections.indexOf(connection);
        if (index > -1) {
            XDmvc.attemptedConnections.splice(index, 1);
        }

	    console.table(XDmvc.attemptedConnections, ["peer", "open"]);
	},
	
	connectTo : function (clientId) {
		// Check if connection exists already
        console.log("connecting to " + clientId);
        console.log(!XDmvc.connections.concat(XDmvc.attemptedConnections)
            .some(function (el) {return el.peer === clientId; }));
		if (!XDmvc.connections.concat(XDmvc.attemptedConnections)
                .some(function (el) {return el.peer === clientId; })) {
			var conn = XDmvc.peer.connect(clientId, {serialization : 'binary', reliable: true});
			conn.on('error', XDmvc.handleError);
			conn.on('open', XDmvc.handleOpen);
			conn.on('data', XDmvc.handleData);
			conn.on('close', XDmvc.handleClose);
            XDmvc.attemptedConnections.push(conn);
//			XDmvc.addConnection(conn);
		}
	},
	
    
    sendToAll : function (msgType, data) {
        console.log("send to all");
		var len = XDmvc.connections.length,
            i;
		for (i = 0; i < len; i++) {
			var con = XDmvc.connections[i];
			if (con.open) {
				con.send({type: msgType, data: data });
			}
		}
	},
	
	sendSyncToAll : function (changes, id) {
		console.log(changes);
	//	console.log(XDmvc.syncData);
		var len = XDmvc.connections.length,
            i;
		for (i = 0; i < len; i++) {
			var con = XDmvc.connections[i];
			if (con.open) {
				console.log("sync");
				// TODO maybe send only changes?
				con.send({type: 'sync', data: XDmvc.syncData[id].data, id: id});
			}
		}
        if (XDmvc.syncData[id].callback){
            XDmvc.syncData[id].callback.apply(undefined, [XDmvc.syncData[id].data, id]); // notify for local changes
        }
		
	},

    // TODO maybe specify a path in an object tree to be watched?
	synchronize : function (data, callback, id) {
		// if no id given, generate one
		id = typeof id !== 'undefined' ? id : 'sync' + (XDmvc.lastSyncId++);
	//	var id = 'sync' +(XDmvc.lastSyncId++);
		var sync = function (data) {return XDmvc.sendSyncToAll(data, id); };
		XDmvc.syncData[id] = {data: data, callback: callback, syncFunction: sync};
		Object.observe(data, sync);
        // TODO this only observes one level. should observe nested objects as well!
    },
	
	
	
	update : function (oldObj, newObj, id) {
	// temporarily disable observation to avoid triggering events
        console.log("update");
        console.log(newObj);
        var key;
		Object.unobserve(oldObj, XDmvc.syncData[id].syncFunction);
		for (key in newObj) {
            // TODO what about properties that were deleted?
            if (oldObj.hasOwnProperty(key) && newObj.hasOwnProperty(key)) {
                delete oldObj[key];
            }
		}
		for (key in newObj) {
            if (newObj.hasOwnProperty(key)) {
                oldObj[key] = newObj[key];
            }
		}
		Object.observe(oldObj, XDmvc.syncData[id].syncFunction);
        
	},
    
	loadNew : function (oldObj, newObj, id) {
////        console.log(oldObj);
 //       console.log(newObj);
        var key;
		for (key in newObj) {
            // TODO what about properties that were deleted?
            if (oldObj.hasOwnProperty(key) && newObj.hasOwnProperty(key)) {
                delete oldObj[key];
            }
		}
		for (key in newObj) {
            if (newObj.hasOwnProperty(key)) {
                oldObj[key] = newObj[key];
            }
		}
	},

	
	// TODO set configs such as server etc here
	init : function (reconnect) {
		XDmvc.loadPeers();
		XDmvc.reconnect = reconnect;
        XDmvc.detectDevice();

	/*
		Object.observe(XDmvc.connections, function(changes){
			console.log(changes);
	//		renderConnections();
			// TODO send an event?
		});
		*/
	},
	
	addConnection: function (conn) {
        console.log("adding connection" + conn.peer);
        console.trace();
		XDmvc.connections.push(conn);
		XDmvc.sortConnections(XDmvc.compareConnections);
        var index = XDmvc.attemptedConnections.indexOf(conn);
        if (index > -1) {
            XDmvc.attemptedConnections.splice(index, 1);
        }
        
	//	console.log("added " +conn.peer);
	//	console.log(XDmvc.connections);
	},
	
	// TODO maybe the developer/user should be able to specify an order. 
	// Order is not enough for some cases, take into account device roles?
	compareConnections: function (connection1, connection2) {
		if (connection1.peer > connection2.peer) {
			return 1;
		}
		if (connection1.peer < connection2.peer) {
			return -1;
		}
		return 0;
	},
	
	sortConnections: function (compareFunc) {
        
		XDmvc.connections.sort(compareFunc);
		var thisConn = {peer: XDmvc.deviceId};
		var idx = XDmvc.connections.findIndex(function (element) {
			return compareFunc(thisConn, element) < 0;
		});
		XDmvc.myPosition.value = idx > -1 ? idx : XDmvc.connections.length;
	//	console.log(XDmvc.myPosition)
	},
    
    addRole: function (role) {
        if (!this.hasRole(role)) {
            this.roles.push(role);
            this.sendRoles();
        }
    },
    
    removeRole: function (role) {
        console.log("removing role " + role);
        var index = this.roles.indexOf(role);
        if (index > -1) {
            this.roles.splice(index, 1);
            this.sendRoles();
            console.log("sending roles to others");
        }
    },
    
    hasRole: function (role) {
       // console.log(role);
     //   console.log(this.roles);
        return this.roles.indexOf(role) > -1;
    },
    
    sendRoles: function () {
        console.log('sending roles');
        console.log(this.deviceId);
        console.log(this.roles);
        this.sendToAll('roles', this.roles);
    },
    
    // Returns an array of connections that have a given role
    otherHasRole: function (role) {
        var haveRoles = this.connections.filter(function (conn) {
            return conn.roles ? conn.roles.indexOf(role) > -1 : false;
        }).map(function (conn) {
            return conn.peer;
        });
        return haveRoles;
    },
    
    getConnection: function (peerId) {
        return XDmvc.connections.find(function (c) {return c.peer === peerId; });
    },
    
    getAttemptedConnection: function (peerId) {
        return XDmvc.attemptedConnections.find(function (c) {
            return c.peer === peerId;
        });
    },

    disconnect: function (peerId) {
        var conn = XDmvc.getConnection(peerId);
        console.log(peerId);
        console.log(conn);
        console.log("disconnecting...");
        if (conn) {
            conn.close();
            XDmvc.removeConnection(conn);
        }
        
    },
    
     
    changeRoleForPeer: function (role, isAdd, peer) {
        var conn = XDmvc.getConnection(peer);
        conn.send({type: "role",  operation: isAdd ? "add" : "remove", role: role});
    },

    sendDevice: function () {
        this.sendToAll('device', this.device);
    },


    detectDevice: function(){
        // TODO this is not optimal. Would be nice to detect physical size. But also type, such as tablet, TV etc.
        var width = document.documentElement.clientWidth;
        var height = document.documentElement.clientHeight;
        var smaller = Math.min(width, height);
        this.device.width = width;
        this.device.height = height;

        if (smaller <= 500 ) {
            this.device.type = "small";
        } else if (smaller > 500 && smaller <= 800) {
            this.device.type = "medium";
        } else {
            this.device.type = "large";
        }
    }

};
