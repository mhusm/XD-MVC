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
    othersDevices: {small:0, medium:0, large:0, xlarge:0}, //TODO deviceTypes
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
    defaultPeerPort: 9000,
    defaultAjaxPort: 9001,
    defaultSocketIoPort: 3000,

    /*
    ---------
    Constants
    ---------
     */
    peerToPeer : 'peer-to-peer',
    clientServer : 'client-server',

    /*
    --------------------
    Network Architecture
    --------------------
     */
    network_architecture : 'peer-to-peer', //default peerToPeer

    setClientServer : function() { this.network_architecture = this.clientServer; },
    setPeerToPeer : function() { this.network_architecture = this.peerToPeer; },

    isClientServer : function() { return this.network_architecture === this.clientServer; },
    isPeerToPeer : function() { return this.network_architecture === this.peerToPeer; },


    /*
     --------------------
     Server communication
     --------------------
     */

    connectToServer : function (host, portPeer, portSocketIo, ajaxPort, iceServers) {

        if (!this.server) {
            this.server = new XDmvcServer(host, portPeer, portSocketIo, ajaxPort, iceServers);
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
        var objectDelta = [];
        var data;

        if (!changes) {
            // No changes specified. Send whole object
            data = XDmvc.syncData[id]
        } else {
            if (Array.isArray(XDmvc.syncData[id].data)){
                var splices = changes[0];
                splices.forEach(function(splice) {
                    var spliceArgs = [splice.index, splice.removed.length];
                    var addIndex = splice.index;
                    while (addIndex < splice.index + splice.addedCount) {
                        spliceArgs.push(XDmvc.syncData[id].data[addIndex]);
                        addIndex++;
                    }
                    arrayDelta.push(spliceArgs);
                });
                data = arrayDelta;
            } else {
                objectDelta=Array.prototype.slice.call(changes, 0 ,3);
                data = objectDelta;
            }
        }

        // Send delta for array, otherwise new copy of object
   //     var msg = {type: 'sync', data: arrayDelta.length > 0? arrayDelta: XDmvc.syncData[id].data, id: id, arrayDelta: arrayDelta.length>0};
        var msg = {type: 'sync', data: data, id: id, arrayDelta: arrayDelta.length>0, objectDelta: objectDelta.length >0};
        var len = XDmvc.connectedDevices.length,
            i;

        for (i = 0; i < len; i++) {
            var conDev = XDmvc.connectedDevices[i];
            var con = conDev.connection;
            if (con.open &&  conDev.isInterested(id)){
                console.log("send sync to interested id: " + conDev.id);
                con.send(msg);
            }
        }

        if (XDmvc.syncData[id].updateServer) {
            XDmvc.sendToServer("sync", msg);
        }
        var event = new CustomEvent('XDSyncData', {'detail' : id});
        document.dispatchEvent(event);

    },

    synchronize : function (data, callback, id, updateServer, updateObjectFunction, updateArrayFunction) {
        // if no id given, generate one. Though this may not always work. It could be better to enforce IDs.
        id = typeof id !== 'undefined' ? id : 'sync' + (XDmvc.lastSyncId++);
        var sync = function (data) {return XDmvc.sendSyncToAll(arguments, id); };
        var updateObject = updateObjectFunction?  updateObjectFunction : function(id, key, value){ XDmvc.syncData[id].data[key] = value};
        var updateArray = updateArrayFunction?  updateArrayFunction : function(id, splices){
            splices.forEach(function(spliceArgs){
                Array.prototype.splice.apply(XDmvc.syncData[id].data, spliceArgs);
            });
        };
        XDmvc.syncData[id] = {data: data,
            callback: callback,
            syncFunction: sync,
            updateServer: updateServer,
            updateObjectFunction: updateObject,
            updateArrayFunction: updateArray
        };
        if (Array.isArray(data)){
            XDmvc.syncData[id].observer = new ArrayObserver(data);
            XDmvc.syncData[id].observer.open(sync);
        } else {
            // TODO this only observes one level. should observe nested objects as well?
            XDmvc.syncData[id].observer = new ObjectObserver(data);
            XDmvc.syncData[id].observer.open(sync);
        }
    },

	update : function (data, id, arrayDelta, objectDelta, keepChanges) {
        var observed =  XDmvc.syncData[id];
        var changedOrAdded;
        var removed;
        var added = {};
        var key;
        var splices;
        if (Array.isArray(observed.data)) {
            if (arrayDelta) {
                splices = data;
            } else {
                // No delta, replace old with new
                var args= [0, observed.data.length].concat(data)
                splices = [args];
            }

            observed.updateArrayFunction(id, splices);
            /*
            splices.forEach(function(spliceArgs){
                Array.prototype.splice.apply(observed.data, spliceArgs);
            });
*/
        } else {
            if (objectDelta) {
                added = data[0];
                removed = data[1];
                var chagned = data[2];
                changedOrAdded = chagned;
            }
            else{
                var delta = XDmvc.getDelta(observed.data, data);
                removed = delta[0];
                changedOrAdded = delta[1];

            }

            // Deleted properties
            for (key in removed) {
                observed.updateObjectFunction(id, key, undefined); // TODO this is not exactly the same as delete
            }
            // New and changed properties
            for (key in changedOrAdded) {
                observed.updateObjectFunction(id, key, changedOrAdded[key]);
            }
            for (key in added) {
                observed.updateObjectFunction(id, key, added[key]);
            }
        }
        // Discard changes that were caused by the update
        if (!keepChanges) {
            observed.observer.discardChanges();
        }

        var event = new CustomEvent('XDupdate', {'detail': {dataId: id, data: observed.data}});
        document.dispatchEvent(event);
    },

    getDelta(oldObj, newObj){
        var addedOrChanged = {};
        var removed = {};
        var key;
        // No delta, replace all old with new properties
        // Deleted properties
        for (key in oldObj) {
            if (oldObj.hasOwnProperty(key) && !newObj.hasOwnProperty(key)) {
                removed[key] = true;
            }
        }
        // New and changed properties
        for (key in newObj) {
            if (newObj.hasOwnProperty(key)) {
                addedOrChanged[key] = newObj[key];
            }
        }
        return [removed, addedOrChanged];

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
                this.configuredRoles[role][keys[0]] = config[keys[0]];
            }
        }, this);

        var configs = this.configuredRoles;

        if(this.server.serverSocket)
            this.server.serverSocket.emit('roleConfigs', {roles : configs });

        console.log(JSON.stringify(configs));
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

//        XDmvc.setClientServer()
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
                var oldServer = XDmvc.server;
                XDmvc.server = null;
                XDmvc.disconnectAll();
                XDmvc.connectToServer(oldServer.host, oldServer.port, oldServer.ajaxPort, oldServer.iceServers);
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
        /* Device detection by Marko Zivkovic

        Distinguishes between
        Small => smartphones, medium => tablets, large => laptops, xlarge => desktop pcs
        And it also works for accordingly sized browser windows.
        see http://www.quirksmode.org/blog/archives/2012/07/more_about_devi.html
         */

        var MAX_SMALL_DIAM = 500;
        var MAX_MEDIUM_DIAM = 1150;
        var MAX_LARGE_DIAM = 1800;

        var parser = new UAParser();
        var scale = 1;
        if (parser.getOS() !== 'Mac OS' && parser.getOS() !== 'iOS'){
            window.devicePixelRatio = window.devicePixelRatio ||
                window.screen.deviceXDPI / window.screen.logicalXDPI;
            scale = window.devicePixelRatio;
        }

        var width = window.innerWidth / scale;
        var height = window.innerHeight / scale;

        var diameter = Math.sqrt(width*width + height*height);

        this.device.width = width;
        this.device.height = height;
        this.device.diam = diameter;
        this.device.id = this.deviceId;

        if (diameter > MAX_LARGE_DIAM){
            this.device.type = "xlarge";
        } else if (diameter > MAX_MEDIUM_DIAM){
            this.device.type = "large";
        } else if (diameter > MAX_SMALL_DIAM){
            this.device.type = "medium";
        } else {
            this.device.type = "small";
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
function XDmvcServer(host, portPeer, portSocketIo, ajaxPort, iceServers){
    this.ajaxPort = ajaxPort ? ajaxPort: XDmvc.defaultAjaxPort;
    this.portPeer = portPeer? portPeer: XDmvc.defaultPeerPort;
    this.portSocketio = portSocketIo ? portSocketIo : XDmvc.defaultSocketIoPort;
    this.host = host? host: document.location.hostname;
    this.peer = null;

    this.iceServers = iceServers ? iceServers :  [
        {url: 'stun:stun.l.google.com:19302'},
        {url: 'stun:stun1.l.google.com:19302'},
        {url: 'stun:stun2.l.google.com:19302'},
        {url: 'stun:stun3.l.google.com:19302'},
        {url: 'stun:stun4.l.google.com:19302'},
        {url:'stun:stun01.sipphone.com'},
        {url:'stun:stun.ekiga.net'},
        {url:'stun:stun.fwdnet.net'},
        {url:'stun:stun.ideasip.com'},
        {url:'stun:stun.iptel.org'},
        {url:'stun:stun.rixtelecom.se'},
        {url:'stun:stun.schlund.de'}
    ];

    // for Client-Server
    this.socketIoAddress = this.host + ':' + this.portSocketio;
    this.serverSocket = null;
}

XDmvcServer.prototype.connect = function connect () {
    if(XDmvc.isPeerToPeer()) {
        // If not connected already
        var server = this;
        if (!this.peer) {
            this.peer = new Peer(XDmvc.deviceId, {
                host: this.host,
                port: this.portPeer,
//                           debug: 3,
                config: {
                    'iceServers': this.iceServers
                }
            });
            this.peer.on('connection', function(conn){server.handleConnection(conn);});
            this.peer.on('error', function(err){server.handleError(err);});

        } else{
            console.warn("Already connected.")
        }
    } else if(XDmvc.isClientServer()) {
        if(!this.serverSocket) {
            var socket = io.connect(this.socketIoAddress); //TODO:make port editable

            this.serverSocket = socket;
           socket.on('connect', function() {
                socket.emit('id', XDmvc.deviceId);
            });

            var server = this;
            // another Peer called virtualConnect(...)
            socket.on('connectTo', function (msg) {
                var conn = new VirtualConnection(this, msg.sender);
                server.handleConnection(conn);
                //send readyForOpen
                socket.emit('readyForOpen', {recA: XDmvc.deviceId, recB: msg.sender});
            });

            socket.on('error', function(err) {
                console.warn(err);
            });

        } else{
            console.warn("Already connected.")
        }
    }

    if (XDmvc.reconnect) {
        XDmvc.connectToStoredPeers();
    }

    // Check periodically who is connected.
    this.requestAvailableDevices();
    window.setInterval(function(){
        server.requestAvailableDevices();}, 5000);

    var event = new CustomEvent('XDServer');
    document.dispatchEvent(event);

    // TODO the server may not have the peer yet. This should be sent a bit later
    this.send('device', XDmvc.device);
    this.send('roles', XDmvc.roles);
}

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
        var conn = null;
        if(XDmvc.isPeerToPeer())
            conn = this.peer.connect(deviceId, {serialization : 'binary', reliable: true});
        else if(XDmvc.isClientServer())
            conn = new VirtualConnection(this.serverSocket, deviceId);

        var connDev = XDmvc.addConnectedDevice(conn);
        connDev.installHandlers(conn);
        XDmvc.attemptedConnections.push(connDev);
        if(XDmvc.isClientServer())
          conn.virtualConnect(deviceId);
    } else {
        console.warn("already connected");
    }
};

//TODO: not used by ClientServer yet
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
    if(XDmvc.isPeerToPeer()) {
        this.peer.destroy();
        this.peer = null;
    } else if(XDmvc.isClientServer()) {
        //ugly hack https://github.com/Automattic/socket.io-client/issues/251
        this.serverSocket.disconnect();
        delete io.sockets[this.socketIoAddress];
        io.j = [];

        this.serverSocket = null;
    }

};


/*
 Virtual Connection for Client-Server Architecture
 ------------------------------------------------
 */

function VirtualConnection(serverSocket, peerId) {
    var vConn = this;

    serverSocket.on('wrapMsg', function (msg) {
        var sender = XDmvc.getConnectedDevice(msg.sender);
        if(sender !== undefined)
            sender.connection.handleEvent(msg.eventTag, msg);
    });

    this.server = serverSocket;
    this.peer = peerId;
    this.callbackMap = {};
    this.open = false;
}


VirtualConnection.prototype.send = function send(msg) {
    this.virtualSend(msg,'data');
}

VirtualConnection.prototype.virtualSend = function virtualSend( originalMsg, eventTag) {
    originalMsg.receiver = this.peer;
    originalMsg.sender =XDmvc.deviceId;
    originalMsg.eventTag = eventTag;
    this.server.emit('wrapMsg', originalMsg);
}

// connect to another peer by sending an open to the other peer, via the server
VirtualConnection.prototype.virtualConnect = function virtualConnect(remoteDeviceId) {
    this.server.emit('connectTo', {receiver:remoteDeviceId, sender:XDmvc.deviceId});
    this.open = true;
}


VirtualConnection.prototype.on = function on(eventTag, callback){
    this.callbackMap[eventTag] = callback;
}

VirtualConnection.prototype.handleEvent = function(tag, msg) {
    if(tag !== 'data'){
        if(tag === 'open')
            this.open = true;
        else// close or error
            this.open = false;
    }
    this.callbackMap[tag].apply(undefined,[msg]); //call the handler that was set in the on(...) method
}

VirtualConnection.prototype.close = function() {
    this.virtualSend(null, 'close');
}

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
                //TODO data can now be a delta, this must be accounted for in the callbacks. maybe the last object should be cached
                //TODO also, initially, the complete object should always be sent. otherwise the connected device may not have all information.
                //TODO maybe on connection each device should already send all synchronised data to all the device?
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
                    XDmvc.update(msg.data, msg.id, msg.arrayDelta, msg.objectDelta);
                }
                //TODO find what the problem is with latest Data
//                this.latestData[msg.id] = msg.data; //TODO maybe handle array deltas?

                event = new CustomEvent('XDsync', {'detail': {dataId: msg.id, data: msg.data, sender: this.id}});
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


//TODO: make nicer e.g with different err.type
ConnectedDevice.prototype.handleError = function handleError (err){
    if(XDmvc.isPeerToPeer()) {
        console.warn("Error in PeerConnection:");
        console.warn(err);
        XDmvc.cleanUpConnections();
        var event = new CustomEvent('XDerror', {"detail": err});
        document.dispatchEvent(event);
    } else if(XDmvc.isClientServer) {
        console.warn("Error in Socketio Connection:" + err.message );
        console.warn(err);
        if(err.type === 'peer-unavailable')
            XDmvc.removeConnection(this);

        var event = new CustomEvent('XDerror', {"detail": err});
        document.dispatchEvent(event);
    }

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
