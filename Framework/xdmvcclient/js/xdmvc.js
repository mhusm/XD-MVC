/*global console, CustomEvent, Peer, Event */
'use strict';
/*jslint plusplus: true */
var XDmvc = {
	peer : null,
    defaultRole : "sync-all",
	connectedDevices : [], // TODO maybe rename?
    attemptedConnections : [],
	deviceId : undefined,
    device: {},
    othersDevices: {small:0, medium:0, large:0}, //TODO deviceTypes
	syncData : {},
	lastSyncId : 0,
	storedPeers: [],
	reconnect: false,
	myPosition: {value: -1},
    roles: [], // roles that this peer has
    othersRoles: {}, // roles that other peers have
    configuredRoles: {}, // roles that have been configured in the system
    availableDevices: [],
    server : null,
    /*
    --------------------
    Server communication
    --------------------
     */

	connectToServer : function (host, port, ajaxPort, iceServers) {
        if (!this.server) {
            this.server = new XDmvcServer(host, port, ajaxPort, iceServers);
        }
        this.server.connect();
 	},

    sendToServer: function(type, data, callback){
        if (this.server) {
            this.server.send(type, data, callback);
        } else {
            console.warn("Send to server failed. Not connected to server");
        }
    },

    /*
    ------------
    Stored Peers
    ------------
     */
	
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

    /*
    ----------------------------
    Connection Management
    ----------------------------
     */
	cleanUpConnections : function () {
		var closed = XDmvc.connectedDevices.filter(function (c) {
			return !c.connection.open;
		});
		
		var len = closed.length,
            i;
		for (i = 0; i < len; i++) {
			XDmvc.removeConnection(closed[i]);
		}
	},

	removeConnection: function (connection) {
		var index = XDmvc.connectedDevices.indexOf(connection);
		if (index > -1) {
			XDmvc.connectedDevices.splice(index, 1);
			XDmvc.sortConnections(XDmvc.compareConnections);
            XDmvc.updateOthersRoles(connection.roles, []);

            if (connection.device) {
                XDmvc.othersDevices[connection.device.type] -=1;
            }
		}

        index = XDmvc.attemptedConnections.indexOf(connection);
        if (index > -1) {
            XDmvc.attemptedConnections.splice(index, 1);
        }

	},


	connectTo : function (deviceId) {
		XDmvc.server.connectToDevice(deviceId);
	},

    disconnect: function disconnect(peerId) {
        var conn = XDmvc.getConnectedDevice(peerId);
        if (conn) {
            conn.disconnect();
        }
    },

    disconnectAll: function disconnectAll() {
        XDmvc.connectedDevices.forEach(function(device){
            device.disconnect();
        });
    },




    getConnectedDevice: function (peerId) {
        return XDmvc.connectedDevices.find(function (c) {return c.id === peerId; });
    },

    addConnectedDevice: function(connection){
        var conDev =  XDmvc.connectedDevices.find(function (c) {return c.connection === connection; });
        if (!conDev){
            conDev = new ConnectedDevice(connection, connection.peer);
            XDmvc.connectedDevices.push(conDev);
            XDmvc.sortConnections(XDmvc.compareConnections);
            var index = XDmvc.attemptedConnections.findIndex(function(element){ return conDev.id === connection.peer});
            if (index > -1) {
                XDmvc.attemptedConnections.splice(index, 1);
            }
        }
        return conDev;
    },

    getAttemptedConnection: function (peerId) {
        return XDmvc.attemptedConnections.find(function (c) {
            return c.id === peerId;
        });
    },

    // TODO maybe the developer/user should be able to specify an order.
    // Order is not enough for some cases, take into account device roles?
    compareConnections: function (connection1, connection2) {
        if (connection1.id > connection2.id) {
            return 1;
        }
        if (connection1.id < connection2.id) {
            return -1;
        }
        return 0;
    },

    sortConnections: function (compareFunc) {

        XDmvc.connectedDevices.sort(compareFunc);
        var thisConn = {peer: XDmvc.deviceId};
        var idx = XDmvc.connectedDevices.findIndex(function (element) {
            return compareFunc(thisConn, element) < 0;
        });
        XDmvc.myPosition.value = idx > -1 ? idx : XDmvc.connectedDevices.length;
    },


    sendToAll : function (msgType, data) {
		var len = XDmvc.connectedDevices.length,
            i;
		for (i = 0; i < len; i++) {
			XDmvc.connectedDevices[i].send(msgType, data);
		}
	},

    /*
    --------------------
    Data Synchronisation
    --------------------
     */
	
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
		var len = XDmvc.connectedDevices.length,
            i;
		for (i = 0; i < len; i++) {
            var conDev = XDmvc.connectedDevices[i];
			var con = conDev.connection;
 			if (con.open &&  conDev.isInterested(id)){
 				con.send(msg);
			}
		}

        if (XDmvc.syncData[id].updateServer) {
            XDmvc.sendToServer("sync", msg);
        }
        var event = new CustomEvent('XDSyncData', {'detail' : id});
        document.dispatchEvent(event);

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
            XDmvc.syncData[id].observer = new ObjectObserver(data);
            XDmvc.syncData[id].observer.open(sync);
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

    forceUpdate: function(objectId){
        XDmvc.sendSyncToAll(null, objectId);
    },

    discardChanges: function(id){
        XDmvc.syncData[id].observer.discardChanges();
    },


    /*
    -----------
    Roles
    -----------
     */

    /*
    Configurations should contain either strings or objects:
    ["albums", "images"] or [{"albums": albumCallback}]
     */
    configureRole: function(role, configurations){
        this.configuredRoles[role] = {};
        configurations.forEach(function(config){
            if (typeof config == 'string' || config instanceof String) {
                this.configuredRoles[role][config] = null;
            } else {
                var keys  = Object.keys(config);
                this.configuredRoles[role][keys[0]] =config[keys[0]];
            }
        }, this);

        this.sendToAll("roleConfigurations", {role: role, configurations : configurations});
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
        var haveRoles = this.connectedDevices.filter(function (conn) {
            return conn.roles ? conn.roles.indexOf(role) > -1 : false;
        }).map(function (conn) {
            return conn.peer;
        });
        return haveRoles;
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

    changeRoleForPeer: function (role, isAdd, peer) {
        var conn = XDmvc.getConnectedDevice(peer);
        conn.send({type: "role",  operation: isAdd ? "add" : "remove", role: role});
    },


   getRoleCallbacks : function (dataId) {
       var result = [];
       XDmvc.roles.filter(function (r) {
           return r !== XDmvc.defaultRole
       }).forEach(function (role) {
           if (XDmvc.configuredRoles[role] && XDmvc.configuredRoles[role][dataId]) {
               result.push(XDmvc.configuredRoles[role][dataId]);
           }
       });
       return result;
   },




/*
--------------------------------
Initialisation and configuration
--------------------------------
 */

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

        // default role
        this.addRole(XDmvc.defaultRole);
    },



    changeDeviceId: function (newId){
        if (newId !== this.deviceId) {
            XDmvc.deviceId = newId;
            localStorage.deviceId = newId;
            XDmvc.device.id = XDmvc.deviceId;
            // If connected, disconnect and reconnect
            if (XDmvc.server) {
                XDmvc.server.disconnect();
                XDmvc.server = null;
                XDmvc.disconnectAll();
                XDmvc.connectToServer();
                // TODO reconnect previous connections?
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

/*
 Server (Peer and Ajax)
 ---------------------
 */
function XDmvcServer(host, port, ajaxPort, iceServers){
    this.ajaxPort = ajaxPort ? ajaxPort: 9001;
    this.port = port? port: 9000;
    this.host = host? host: document.location.hostname;
    this.peer = null;
    this.iceServers =  [
        {url: 'stun:stun.l.google.com:19302'},
        {url: 'stun:stun1.l.google.com:19302'},
        {url: 'stun:stun2.l.google.com:19302'},
        {url: 'stun:stun3.l.google.com:19302'},
        {url: 'stun:stun4.l.google.com:19302'}
    ];
}

XDmvcServer.prototype.connect = function connect (){
    // If not connected already
    var server = this;
    if (!this.peer) {
        this.peer = new Peer(XDmvc.deviceId, {
            host: this.host,
            port: this.port,
//                           debug: 3,
            config: {
                'iceServers': this.iceServers
            }
        });
        this.peer.on('connection', function(conn){server.handleConnection(conn);});
        this.peer.on('error', function(err){server.handleError(err);});
        if (XDmvc.reconnect) {
            XDmvc.connectToStoredPeers();
        }

        // Check periodically who is connected.
        this.requestAvailableDevices();
        window.setInterval(function(){
            server.requestAvailableDevices();}, 5000);

        this.send('device', this.device);
        this.send('roles', this.roles);
    } else{
        console.warn("Already connected.")
    }
};

XDmvcServer.prototype.send = function send (type, data, callback){
    var url = window.location.protocol +"//" +this.host +":" +this.ajaxPort;
    ajax.postJSON(url, {type: type, data:data, id: XDmvc.deviceId},
        function(reply){
            if (callback){
                callback(reply);
            }
        },
        true
    );
};

XDmvcServer.prototype.requestAvailableDevices = function requestAvailableDevices (){
    this.send("listAllPeers", null, function(msg){
        var peers = JSON.parse(msg).peers;
        XDmvc.availableDevices.length = 0;
        // Filter out self and peers that we are connected to already
        peers.filter(function (p) {
            return p.id !== XDmvc.deviceId && !XDmvc.connectedDevices.some(function (el) {return el.id === p.id; });
        })
        .forEach(function (peer) {
            XDmvc.availableDevices.push(peer);
        });
    });
};

XDmvcServer.prototype.connectToDevice = function connectToDevice (deviceId) {
    // Check if connection exists already
    if (!XDmvc.connectedDevices.concat(XDmvc.attemptedConnections)
            .some(function (el) {return el.id === deviceId; })) {
        var conn = this.peer.connect(deviceId, {serialization : 'binary', reliable: true});
        var connDev = XDmvc.addConnectedDevice(conn);
        connDev.installHandlers(conn);
        XDmvc.attemptedConnections.push(connDev);
    } else {
        console.warn("already connected");
    }
};

XDmvcServer.prototype.handleError = function handleError (err){
    XDmvc.cleanUpConnections();
    var event = new CustomEvent('XDerror');
    document.dispatchEvent(event);

    if (err.type === "peer-unavailable") {
        var peerError = "Could not connect to peer ";
        var peer = err.message.substring(peerError.length);
        var conn = XDmvc.getAttemptedConnection(peer);
        var index = XDmvc.attemptedConnections.indexOf(conn);
        if (index > -1) {
            XDmvc.attemptedConnections.splice(index, 1);
        }
        console.info(err.message);
    } else {
        console.warn(err);
    }
};

XDmvcServer.prototype.handleConnection = function handleConnection (connection){
    var conDev = XDmvc.addConnectedDevice(connection);
    conDev.installHandlers(connection);
    XDmvc.attemptedConnections.push(conDev);

    // Flag that this peer should receive state on open
    conDev.sendSync = true;

};

XDmvcServer.prototype.disconnect = function disconnect (){
    this.peer.destroy();
    this.peer = null;
};

/*
Connected Devices
-----------------
 */
function ConnectedDevice(connection, id){
    this.connection = connection;
    this.id = id;
    this.roles = [];
    this.device = {};
    this.latestData = {};
}

ConnectedDevice.prototype.isInterested = function(dataId){
    return this.roles.indexOf(XDmvc.defaultRole) > -1 || this.roles.some(function(role){
            return XDmvc.configuredRoles[role] && typeof XDmvc.configuredRoles[role][dataId] !== "undefined" ;
        }) ;
};

ConnectedDevice.prototype.handleRoles = function(roles){
    var old = this.roles;
    this.roles = roles;
    XDmvc.updateOthersRoles(old, this.roles);
    // sends the current state, the first time it receives roles from another device
    // only sends them, if the other device was the one to request the connection
    // TODO maybe this needs to be configurable?
    if (this.sendSync) {
        Object.keys(XDmvc.syncData).forEach(function (element) {
            if (this.isInterested(element)){
                var msg = {type: 'sync', data: XDmvc.syncData[element].data, id: element};
                this.connection.send(msg);
            }
        }, this);
        this.sendSync = false;
    }
};


ConnectedDevice.prototype.handleData = function(msg){
    var old, event, ids;
    if (Object.prototype.toString.call(msg) === "[object Object]") {
        // Connect to the ones we are not connected to yet
        switch (msg.type) {
            case 'connections':
                ids = XDmvc.connectedDevices.map(function (el) {return el.id; });
                msg.data.filter(function (el) { return ids.indexOf(el) < 0; }).forEach(function (el) {
                    XDmvc.connectTo(el);
                });
                break;
            case 'data':
                event = new CustomEvent('XDdata', {'detail': msg.data});
                document.dispatchEvent(event);
                break;
            case 'roles':
                this.handleRoles(msg.data);
                break;
            case 'device':
                // Device type changed (due to window resize usually)
                if (this.device && this.device.type) {
                    XDmvc.othersDevices[this.device.type] -=1;
                }
                this.device = msg.data;
                XDmvc.othersDevices[msg.data.type] +=1;
                event = new CustomEvent('XDdevice', {'detail': msg.data});
                document.dispatchEvent(event);
                break;
            case 'sync':
                // First all role specific callbacks
                var callbacks = XDmvc.getRoleCallbacks(msg.id);
                if (callbacks.length > 0) {
                    callbacks.forEach(function(callback){
                        callback.apply(undefined, [msg.id, msg.data, this.id]);
                    }, this);
                }
                // Else object specific callbacks
                else if (XDmvc.syncData[msg.id].callback) {
                    XDmvc.syncData[msg.id].callback.apply(undefined, [msg.id, msg.data, this.id]);
                // Else default merge behaviour
                } else {
                    XDmvc.update(msg.data, msg.id, msg.arrayDelta);
                }
                this.latestData[msg.id] = msg.data; //TODO maybe handle array deltas?
                event = new CustomEvent('XDsync', {'detail': {data: msg.data, sender: this.id}});
                document.dispatchEvent(event);
                break;
            case 'role':
                if (msg.operation === "add") {
                    XDmvc.addRole(msg.role);
                } else {
                    XDmvc.removeRole(msg.role);
                }
                break;
            default :
                console.warn("received unhandled msg type");
                console.warn(msg);
        }
    }

};

ConnectedDevice.prototype.handleError = function handleError (err, connection){
    console.warn("Error in PeerConnection:" +connection.id );
    console.warn(err);
    XDmvc.cleanUpConnections();
    var event = new CustomEvent('XDerror', {"detail": err});
    document.dispatchEvent(event);
};

ConnectedDevice.prototype.handleOpen = function handleOpen (){
    if (XDmvc.storedPeers.indexOf(this.id) === -1) {
        XDmvc.storedPeers.push(this.id);
        XDmvc.storePeers();
    }
    var thisDevice = this;
    var others = XDmvc.connectedDevices.filter(function (el) {return el.id !== thisDevice.id; })
        .map(function (el) {return el.id; });
    this.send('connections', others);

    this.send("roles", XDmvc.roles);
    this.send("device", XDmvc.device);
};

ConnectedDevice.prototype.handleClose = function handleClose (){
    XDmvc.removeConnection(this);
};

ConnectedDevice.prototype.send = function send (msgType, data){
    if (this.connection && this.connection.open) {
        this.connection.send({type: msgType, data: data });
    } else {
        console.warn("Can not send message to device. Not connected to " +this.id );
    }
};

ConnectedDevice.prototype.disconnect = function disconnect (){
    this.connection.close();
    XDmvc.removeConnection(this);

};

ConnectedDevice.prototype.installHandlers = function installHandlers(conn){
    var that = this;
    conn.on('error', function (err) { that.handleError(err)});
    conn.on('open', function () { that.handleOpen()});
    conn.on('data', function (msg) { that.handleData(msg)});
    conn.on('close', function () { that.handleClose()});
}
