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
    ajaxPort: 9001,
    port: 9000,
    host: "",
	
	connectToServer : function (host, port, ajaxPort) {
        this.port = port? port : this.port;
        this.ajaxPort = ajaxPort? ajaxPort : this.ajaxPort;
        this.host = host? host : this.host;

        // If not connected already
        if (!this.peer) {
            this.peer = new Peer(this.deviceId, {
                host: this.host,
                port: this.port,
//                           debug: 3,
                config: {
                    'iceServers': [
                        {url: 'stun:stun.l.google.com:19302'},
                        {url: 'stun:stun1.l.google.com:19302'},
                        {url: 'stun:stun2.l.google.com:19302'},
                        {url: 'stun:stun3.l.google.com:19302'},
                        {url: 'stun:stun4.l.google.com:19302'}
                    ]
                }
            });
            this.peer.on('connection', this.handleConnection);
            this.peer.on('error', this.handleError);
            if (this.reconnect) {
                this.connectToStoredPeers();
            }

            // Check periodically who is connected.
            this.requestAvailablePeers();
            window.setInterval(this.requestAvailablePeers, 5000);

            this.sendToServer('device', this.device);
            this.sendToServer('roles', this.roles);

        }
	},

    requestAvailablePeers: function () {
        XDmvc.sendToServer("listAllPeers", null, function(msg){
            var peers = JSON.parse(msg).peers;
            XDmvc.availablePeers.length = 0;
            // Filter out self and peers that we are connected to already
            peers.filter(function (p) {
                return p.id !== XDmvc.deviceId && !XDmvc.connections.some(function (el) {return el.peer === p.id; });
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
		var conn = this;

        XDmvc.addConnection(conn);
        if (XDmvc.storedPeers.indexOf(conn.peer) === -1) {
			XDmvc.storedPeers.push(conn.peer);
			XDmvc.storePeers();
		}
		var others = XDmvc.connections.filter(function (el) {return el.peer !== conn.peer; })
                    .map(function (el) {return el.peer; });
		this.send({type: 'connections', data: others });

        XDmvc.sendRoles();
        XDmvc.sendDevice();

        // Send the current state the newly connected device
        if (conn.sendSync) {
            Object.keys(XDmvc.syncData).forEach(function (element) {
                var msg = {type: 'sync', data: XDmvc.syncData[element].data, id: element};
                conn.send(msg);
            });
            conn.sendSync = false;
        }

	},
	
	handleConnection : function (conn) {
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
                // Device type changed (due to window resize usually)
                if (this.device && this.device.type) {
                    XDmvc.othersDevices[this.device.type] -=1;
                }
                this.device = msg.data;
                XDmvc.othersDevices[msg.data.type] +=1;
                event = new CustomEvent('XDdevice', {'detail': msg.data});
                document.dispatchEvent(event);
            } else if (msg.type === 'sync') {
				XDmvc.update(msg.data, msg.id, msg.arrayDelta);
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
                console.warn("received unhandled msg type");
                console.warn(msg);
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
		console.warn(err);
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
		if (index > -1) {
			XDmvc.connections.splice(index, 1);
			XDmvc.sortConnections(XDmvc.compareConnections);
		}
        XDmvc.updateOthersRoles(connection.roles, []);
        XDmvc.othersDevices[connection.device.type] -=1;


        if (connection.device) {
            XDmvc.othersDevices[connection.device.type] -=1;
        }
        
        index = XDmvc.attemptedConnections.indexOf(connection);
        if (index > -1) {
            XDmvc.attemptedConnections.splice(index, 1);
        }

	},
	
	connectTo : function (clientId) {
		// Check if connection exists already
		if (!XDmvc.connections.concat(XDmvc.attemptedConnections)
                .some(function (el) {return el.peer === clientId; })) {
			var conn = XDmvc.peer.connect(clientId, {serialization : 'binary', reliable: true});
			conn.on('error', XDmvc.handleError);
			conn.on('open', XDmvc.handleOpen);
			conn.on('data', XDmvc.handleData);
			conn.on('close', XDmvc.handleClose);
            XDmvc.attemptedConnections.push(conn);
		}
	},
	
    
    sendToAll : function (msgType, data) {
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
        var arrayDelta = [];
        if (Array.isArray(XDmvc.syncData[id].data) && changes){
            var splices = changes;
            splices.forEach(function(splice) {
                var spliceArgs = [splice.index, splice.removed.length];
                var addIndex = splice.index;
                while (addIndex < splice.index + splice.addedCount) {
                    spliceArgs.push(XDmvc.syncData[id].data[addIndex]);
                    addIndex++;
                }
                arrayDelta.push(spliceArgs);
            });
        }
        // Send delta for array, otherwise new copy of object
        var msg = {type: 'sync', data: arrayDelta.length > 0? arrayDelta: XDmvc.syncData[id].data, id: id, arrayDelta: arrayDelta.length>0};
		var len = XDmvc.connections.length,
            i;
		for (i = 0; i < len; i++) {
			var con = XDmvc.connections[i];
			if (con.open) {
 				con.send(msg);
			}
		}

        if (XDmvc.syncData[id].updateServer) {
            XDmvc.sendToServer("sync", msg);
        }

        if (XDmvc.syncData[id].callback){
            XDmvc.syncData[id].callback.apply(undefined, [XDmvc.syncData[id].data, id]); // notify for local changes
        }
		
	},

    sendToServer: function(type, data, callback){
        var url = window.location.protocol +"//" +window.location.hostname +":" +XDmvc.ajaxPort;
        ajax.postJSON(url, {type: type, data:data, id: XDmvc.deviceId},
            function(reply){
                if (callback){
                    callback(reply);
                }
            },
            true
        );

    },


	synchronize : function (data, callback, id, updateServer) {
        // if no id given, generate one. Though this may not always work. It could be better to enforce IDs.
        id = typeof id !== 'undefined' ? id : 'sync' + (XDmvc.lastSyncId++);
        var sync = function (data) {return XDmvc.sendSyncToAll(data, id); };
        XDmvc.syncData[id] = {data: data, callback: callback, syncFunction: sync, updateServer: updateServer};
        if (Array.isArray(data)){
            XDmvc.syncData[id].observer = new ArrayObserver(data);
            XDmvc.syncData[id].observer.open(sync);
        } else {
            // TODO this only observes one level. should observe nested objects as well?
            // TODO use observeJS also for objects?
            XDmvc.syncData[id].observer = new ObjectObserver(data);
            XDmvc.syncData[id].observer.open(sync);
//            Object.observe(data, sync);
        }
    },

	
	update : function (newObj, id, arrayDelta) {
        var observed =  XDmvc.syncData[id];
        if (Array.isArray(observed.data)) {
             if (arrayDelta) {
                newObj.forEach(function(spliceArgs){
                    Array.prototype.splice.apply(observed.data, spliceArgs);
                });
            } else {
                // No delta, replace with old
                observed.data.splice(0, observed.data.length);
                Array.prototype.push.apply(observed.data, newObj);
            }

        } else {
            var key;
            // Deleted properties
            for (key in observed.data) {
                if (observed.data.hasOwnProperty(key) && !newObj.hasOwnProperty(key)) {
                    delete observed.data[key];
                }
            }
            // New and changed properties
            for (key in newObj) {
                if (newObj.hasOwnProperty(key)) {
                    observed.data[key] = newObj[key];
                }
            }
        }
        // Discard changes that were caused by the update
        observed.observer.discardChanges();

	},

    // TODO set configs such as server etc here
    init : function () {
        // Check if there is an id, otherwise generate ones
        var id = localStorage.getItem("deviceId");
        this.deviceId = id? id:  "Id"+Date.now();
        localStorage.setItem("deviceId", this.deviceId);


        XDmvc.loadPeers();
        XDmvc.detectDevice();
        XDmvc.host = document.location.hostname;
        window.addEventListener('resize', function(event){
            XDmvc.detectDevice();
            XDmvc.sendDevice();
        });
    },


    addConnection: function (conn) {
        XDmvc.connections.push(conn);
        XDmvc.sortConnections(XDmvc.compareConnections);
        var index = XDmvc.attemptedConnections.indexOf(conn);
        if (index > -1) {
            XDmvc.attemptedConnections.splice(index, 1);
        }
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
    },

    addRole: function (role) {
        if (!this.hasRole(role)) {
            this.roles.push(role);
            this.sendRoles();
        }
    },

    removeRole: function (role) {
        var index = this.roles.indexOf(role);
        if (index > -1) {
            this.roles.splice(index, 1);
            this.sendRoles();
        }
    },

    hasRole: function (role) {
        return this.roles.indexOf(role) > -1;
    },

    sendRoles: function () {
        this.sendToAll('roles', this.roles);
        this.sendToServer('roles', this.roles);
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
        if (conn) {
            conn.close();
            XDmvc.removeConnection(conn);
        }

    },


    changeRoleForPeer: function (role, isAdd, peer) {
        var conn = XDmvc.getConnection(peer);
        conn.send({type: "role",  operation: isAdd ? "add" : "remove", role: role});
    },

    changeDeviceId: function (newId){
        if (newId !== this.deviceId) {
            this.deviceId = newId;
            localStorage.deviceId = newId;
            this.device.id = this.deviceId;
            // If connected, disconnect and reconnect
            if (this.peer) {
                this.peer.destroy();
                this.cleanUpConnections();
                this.peer = null;
                this.connectToServer();
            }
        }
    },

    sendDevice: function () {
        this.sendToAll('device', this.device);
        this.sendToServer('device', this.device);
    },

    changeName: function(newName){
        if (newName !== this.device.name) {
            this.device.name = newName;
            localStorage.deviceName = newName;
            this.sendDevice();
        }
    },

    detectDevice: function(){
        // TODO this is not optimal. Would be nice to detect physical size. But also type, such as tablet, TV etc.
        var width = document.documentElement.clientWidth;
        var height = document.documentElement.clientHeight;
        var smaller = Math.min(width, height);
        this.device.width = width;
        this.device.height = height;
        this.device.id = this.deviceId;
        if (smaller <= 500 ) {
            this.device.type = "small";
        } else if (smaller > 500 && smaller <= 800) {
            this.device.type = "medium";
        } else {
            this.device.type = "large";
        }

        var name = localStorage.getItem("deviceName");
        this.device.name = name? name : this.deviceId;
        localStorage.setItem("deviceName", this.device.name);
    }

};
