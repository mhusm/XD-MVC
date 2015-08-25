/*global console, Peer, Event */
'use strict';
/*jslint plusplus: true */


function XDMVC () {
    XDEmitter.call(this);
    this.peer = null;
    this.defaultRole = "sync-all";
    this.connectedDevices = []; // TODO maybe rename?
    this.attemptedConnections = [];
    this.deviceId = undefined;
    this.device = {};
    this.othersDevices = {small: 0, medium: 0, large: 0, xlarge: 0}; //TODO deviceTypes
    this.syncData = {};
    this.lastSyncId = 0;
    this.storedPeers = [];
    this.reconnect = false;
    this.myPosition = {value: -1};
    this.roles = []; // roles that this peer has
    this.othersRoles = {}; // roles that other peers have
    this.configuredRoles = {}; // roles that have been configured in the system
    this.availableDevices = [];
    this.server = null;
    this.defaultPeerPort = 9000;
    this.defaultAjaxPort = 9001;
    this.defaultSocketIoPort = 3000;
    /*
     ---------
     Constants
     ---------
     */
    this.peerToPeer = 'peer-to-peer';
    this.clientServer = 'client-server';
    this.hybrid = 'hybrid';

    /*
     --------------------
     Network Architecture
     --------------------
     */
    this.network_architecture = 'hybrid';
}


XDMVC.prototype = Object.create(XDEmitter.prototype);
XDMVC.prototype.constructor = XDMVC;

XDMVC.prototype.setClientServer = function() { this.network_architecture = this.clientServer; };

XDMVC.prototype.setPeerToPeer = function() { this.network_architecture = this.peerToPeer; };
XDMVC.prototype.setHybrid = function() { this.network_architecture = this.hybrid};
XDMVC.prototype.isClientServer = function() { return this.network_architecture === this.clientServer; };
XDMVC.prototype.isPeerToPeer = function() { return this.network_architecture === this.peerToPeer; };
XDMVC.prototype.isHybrid = function() { return this.network_architecture === this.hybrid};

    /*
     --------------------
     Server communication
     --------------------
     */

XDMVC.prototype.connectToServer = function (host, portPeer, portSocketIo, ajaxPort, iceServers) {

    if (!this.server) {
        this.server = new XDmvcServer(host, portPeer, portSocketIo, ajaxPort, iceServers);
    }
    this.server.connect();
};

XDMVC.prototype.sendToServer = function(type, data, callback){
    if (this.server) {
        this.server.send(type, data, callback);
    } else {
        console.warn("Send to server failed. Not connected to server");
    }
};

    /*
     ------------
     Stored Peers
     ------------
     */

XDMVC.prototype.connectToStoredPeers = function () {
    this.storedPeers.forEach(this.connectTo.bind(this));
};

XDMVC.prototype.storePeers = function () {
    localStorage.peers = JSON.stringify(this.storedPeers);
};

XDMVC.prototype.removeStoredPeer = function (peerId) {
    var index = this.storedPeers.indexOf(peerId);
    if (index > -1) {
        this.storedPeers.splice(index, 1);
        this.storePeers();
    }
};

XDMVC.prototype.loadPeers = function () {
    if (localStorage.peers) {
        this.storedPeers.length = 0;
        var peers = JSON.parse(localStorage.peers);
        Array.prototype.push.apply(this.storedPeers, peers);
    }
};

    /*
     ----------------------------
     Connection Management
     ----------------------------
     */
XDMVC.prototype.cleanUpConnections = function () {
        var closed = this.connectedDevices.filter(function (c) {
            return !c.connection.open;
        });

        var len = closed.length,
            i;
        for (i = 0; i < len; i++) {
            this.removeConnection(closed[i]);
        }
    };

XDMVC.prototype.removeConnection = function (connection) {
    var index = this.connectedDevices.indexOf(connection);
    if (index > -1) {
        this.connectedDevices.splice(index, 1);
        this.sortConnections(XDmvc.compareConnections.bind(this));
        this.updateOthersRoles(connection.roles, []);

        if (connection.device) {
            this.othersDevices[connection.device.type] -= 1;
        }
    }

    index = this.attemptedConnections.indexOf(connection);
    if (index > -1) {
        this.attemptedConnections.splice(index, 1);
    }

    this.emit('XDconnection', {'detail': connection});
};


XDMVC.prototype.connectTo = function (deviceId) {
        this.server.connectToDevice(deviceId);
};

XDMVC.prototype.disconnect = function disconnect(peerId) {
        var conn = this.getConnectedDevice(peerId);
        if (conn) {
            conn.disconnect();
        }
};

XDMVC.prototype.disconnectAll = function disconnectAll() {
        this.connectedDevices.forEach(function(device){
            device.disconnect();
        });
};

XDMVC.prototype.getConnectedDevice = function (peerId) {
        return this.connectedDevices.find(function (c) {return c.id === peerId; });
};

XDMVC.prototype.addConnectedDevice = function(connection){
        var conDev =  this.connectedDevices.find(function (c) {return c.connection === connection; });
        if (!conDev){
            conDev = new ConnectedDevice(connection, connection.peer);
            this.connectedDevices.push(conDev);
            this.sortConnections(this.compareConnections.bind(this));
            //TODO test this
            var index = this.attemptedConnections.findIndex(function(element){ return element.id === connection.peer});
            if (index > -1) {
                this.attemptedConnections.splice(index, 1);
            }
        }
        return conDev;
};

XDMVC.prototype.getAttemptedConnection = function (peerId) {
        return this.attemptedConnections.find(function (c) {
            return c.id === peerId;
        });
};

    // TODO maybe the developer/user should be able to specify an order.
    // Order is not enough for some cases, take into account device roles?
XDMVC.prototype.compareConnections = function (connection1, connection2) {
        if (connection1.id > connection2.id) {
            return 1;
        }
        if (connection1.id < connection2.id) {
            return -1;
        }
        return 0;
};

XDMVC.prototype.sortConnections = function (compareFunc) {

        this.connectedDevices.sort(compareFunc);
        var thisConn = {peer: this.deviceId};
        var idx = this.connectedDevices.findIndex(function (element) {
            return compareFunc(thisConn, element) < 0;
        });
        this.myPosition.value = idx > -1 ? idx : this.connectedDevices.length;
};


XDMVC.prototype.sendToAll = function (msgType, data) {
        var len = this.connectedDevices.length,
            i;
        for (i = 0; i < len; i++) {
            this.connectedDevices[i].send(msgType, data);
        }
};

    /*
     --------------------
     Data Synchronisation
     --------------------
     */

XDMVC.prototype.sendSyncToAll = function (changes, id) {
        var arrayDelta = [];
        var objectDelta = [];
        var data;
        if (!changes) {
            // No changes specified. Send whole object
            data = this.syncData[id].data;
        } else {
            if (Array.isArray(this.syncData[id].data)){
                var splices = changes[0];
                splices.forEach(function(splice) {
                    var spliceArgs = [splice.index, splice.removed.length];
                    var addIndex = splice.index;
                    while (addIndex < splice.index + splice.addedCount) {
                        spliceArgs.push(this.syncData[id].data[addIndex]);
                        addIndex++;
                    }
                    arrayDelta.push(spliceArgs);
                }.bind(this));
                data = arrayDelta;
            } else {
                objectDelta=Array.prototype.slice.call(changes, 0 ,3);
                data = objectDelta;
            }
        }

        var msg = {type: 'sync', data: data, id: id, arrayDelta: arrayDelta.length>0, objectDelta: objectDelta.length >0};
        var len = this.connectedDevices.length,
            i;

        for (i = 0; i < len; i++) {
            var conDev = this.connectedDevices[i];
            var con = conDev.connection;
            if (con.open &&  conDev.isInterested(id)){
                con.send(msg);
            }
        }

        if (this.syncData[id].updateServer) {
            this.sendToServer("sync", {type: 'sync', data: this.syncData[id].data});
        }
        this.emit('XDsyncData', {'detail' : id});
};

XDMVC.prototype.synchronize = function (data, callback, id, updateServer, updateObjectFunction, updateArrayFunction) {
        // if no id given, generate one. Though this may not always work. It could be better to enforce IDs.
        id = typeof id !== 'undefined' ? id : 'sync' + (XDmvc.lastSyncId++);
        var sync = function (data) {return XDmvc.sendSyncToAll(arguments, id); };
        var updateObject = updateObjectFunction?  updateObjectFunction : function(id, key, value){ this.syncData[id].data[key] = value}.bind(this);
        var updateArray = updateArrayFunction?  updateArrayFunction : function(id, splices){
            splices.forEach(function(spliceArgs){
                Array.prototype.splice.apply(this.syncData[id].data, spliceArgs);
            }.bind(this));
        };
        this.syncData[id] = {data: data,
            callback: callback,
            syncFunction: sync,
            updateServer: updateServer,
            updateObjectFunction: updateObject,
            updateArrayFunction: updateArray
        };
        if (Array.isArray(data)){
            this.syncData[id].observer = new ArrayObserver(data);
            this.syncData[id].observer.open(sync);
        } else {
            // TODO this only observes one level. should observe nested objects as well?
            this.syncData[id].observer = new ObjectObserver(data);
            this.syncData[id].observer.open(sync);
        }
};

    // TODO there is some redundancy with the update function. This should be fixed
XDMVC.prototype.updateOld = function(old, data, arrayDelta, objectDelta){
        var changedOrAdded;
        var removed;
        var added = {};
        var key;
        var splices;
        if (Array.isArray(old)) {
            if (arrayDelta) {
                splices = data;
            } else {
                // No delta, replace old with new
                var args= [0, old.length].concat(data);
                splices = [args];
            }

             splices.forEach(function(spliceArgs){
                Array.prototype.splice.apply(old, spliceArgs);
             });
        } else {
            if (objectDelta) {
                added = data[0];
                removed = data[1];
                var changed = data[2];
                changedOrAdded = changed;
            }
            else{
                var delta = XDmvc.getDelta(old, data);
                removed = delta[0];
                changedOrAdded = delta[1];

            }

            // Deleted properties
            for (key in removed) {
                old[key] = undefined; // TODO this is not exactly the same as delete
            }
            // New and changed properties
            for (key in changedOrAdded) {
                old[key]= changedOrAdded[key];
            }
            for (key in added) {
                old[key]= changedOrAdded[key];
            }
        }
};

XDMVC.prototype.update = function (data, id, arrayDelta, objectDelta, keepChanges) {
        var observed =  this.syncData[id];
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
        } else {
            if (objectDelta) {
                added = data[0];
                removed = data[1];
                var chagned = data[2];
                changedOrAdded = chagned;
            }
            else{
                var delta = this.getDelta(observed.data, data);
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

        this.emit('XDupdate', {'detail': {dataId: id, data: observed.data}});
};

XDMVC.prototype.getDelta = function(oldObj, newObj){
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

};

XDMVC.prototype.forceUpdate = function(objectId){
        this.sendSyncToAll(null, objectId);
};

XDMVC.prototype.discardChanges = function(id){
        this.syncData[id].observer.discardChanges();
};


    /*
     -----------
     Roles
     -----------
     */

    /*
     Configurations should contain either strings or objects:
     ["albums", "images"] or [{"albums": albumCallback}]
     */
XDMVC.prototype.configureRole = function(role, configurations){
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

        this.sendToAll("roleConfigurations", {role: role, configurations : configurations});
};

XDMVC.prototype.addRole = function (role) {
        if (!this.hasRole(role)) {
            this.roles.push(role);
            this.sendRoles();
            Platform.performMicrotaskCheckpoint();
        }
};

XDMVC.prototype.removeRole = function (role) {
        var index = this.roles.indexOf(role);
        if (index > -1) {
            this.roles.splice(index, 1);
            this.sendRoles();
            Platform.performMicrotaskCheckpoint();
        }
};

XDMVC.prototype.hasRole = function (role) {
        return this.roles.indexOf(role) > -1;
};

XDMVC.prototype.sendRoles = function () {
        this.sendToAll('roles', this.roles);
        this.sendToServer('roles', this.roles);
};

    // Returns an array of connections that have a given role
XDMVC.prototype.otherHasRole = function (role) {
        var haveRoles = this.connectedDevices.filter(function (conn) {
            return conn.roles ? conn.roles.indexOf(role) > -1 : false;
        }).map(function (conn) {
            return conn.peer;
        });
        return haveRoles;
};

XDMVC.prototype.updateOthersRoles = function (oldRoles, newRoles) {
        var added = newRoles.filter(function (r) { return oldRoles ? oldRoles.indexOf(r) === -1 : true; });
        var removed = oldRoles ? oldRoles.filter(function (r) { return newRoles.indexOf(r) === -1; }) : [];
        var roles = this.othersRoles;
        var event;
        added.forEach(function (a) {
            roles[a] = roles[a] ? roles[a] + 1 : 1;
        });
        removed.forEach(function (r) {
            roles[r] = roles[r] && roles[r] > 0 ? roles[r] - 1 : 0;
        });

        // TODO check whether there really was a change? Report added and removed?
       this.emit('XDothersRolesChanged');
};

XDMVC.prototype.changeRoleForPeer = function (role, isAdd, peer) {
        var conn = this.getConnectedDevice(peer);
        conn.send({type: "role",  operation: isAdd ? "add" : "remove", role: role});
};


XDMVC.prototype.getRoleCallbacks = function (dataId) {
        var result = [];
        this.roles.filter(function (r) {
            return r !== this.defaultRole
        }.bind(this)).forEach(function (role) {
            if (this.configuredRoles[role] && this.configuredRoles[role][dataId]) {
                result.push(XDmvc.configuredRoles[role][dataId]);
            }
        }.bind(this));
        return result;
};


// subclass extends superclass
    /*
     --------------------------------
     Initialisation and configuration
     --------------------------------
     */

XDMVC.prototype.init = function () {
        // Check if there is an id, otherwise generate ones
        var id = localStorage.getItem("deviceId");
        this.deviceId = id? id:  "Id"+Date.now();
        localStorage.setItem("deviceId", this.deviceId);

//        XDmvc.setClientServer()
        this.loadPeers();
        this.detectDevice();
        this.host = document.location.hostname;
        window.addEventListener('resize', function(event){
            this.detectDevice();
            this.sendDevice();
        }.bind(this));

        // default role
        this.addRole(this.defaultRole);

        // disconnect server on unload (this could solve some PeerJS issues with IDs)
        window.addEventListener("unload", function(){
            if (this.server) {
                this.server.disconnect();
            }
        });
};



XDMVC.prototype.changeDeviceId = function (newId){
        if (newId !== this.deviceId) {
            this.deviceId = newId;
            localStorage.deviceId = newId;
            this.device.id = this.deviceId;
            // If connected, disconnect and reconnect
            if (this.server) {
                this.server.disconnect();
                var oldServer = this.server;
                this.server = null;
                this.disconnectAll();
                this.connectToServer(oldServer.host, oldServer.port, oldServer.portSocketio, oldServer.ajaxPort, oldServer.iceServers);
                // TODO reconnect previous connections?
            }
        }
};

XDMVC.prototype.sendDevice = function () {
        this.sendToAll('device', this.device);
        this.sendToServer('device', this.device);
};

XDMVC.prototype.changeName = function(newName){
        if (newName !== this.device.name) {
            this.device.name = newName;
            localStorage.deviceName = newName;
            this.sendDevice();
        }
};

XDMVC.prototype.detectDevice = function(){



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
        var pixelRatio;
        if (parser.getOS() !== 'Mac OS' && parser.getOS() !== 'iOS'){
            pixelRatio = window.devicePixelRatio ||
                window.screen.deviceXDPI / window.screen.logicalXDPI;
            scale = pixelRatio;
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
        Platform.performMicrotaskCheckpoint();
};

    /*
    function to determine whether a peerJS or a SocketIo connection should be used to connect
    to the remoteId device. Logic might be extended. Currently the decision is made based on
    the availability of WebRTC and whether the remote has connected to the server with peerJS
     */
XDMVC.prototype.usePeerToPeer = function usePeerToPeer(remoteId) {
        var device = this.availableDevices.find(function(avDev){return avDev.id === remoteId; });

        if(! this.supportsPeerJS()) //if this device does not support WebRTC (maybe a check via peerJS is possible)
            return false;

        if(device && !device.usesPeerJs)
            return false; // one of both devices does not support WebRTC

        return true; // both devices support WebRTC or the remote does not show up in the list
    };

XDMVC.prototype.supportsPeerJS = function() {
    return DetectRTC.isWebRTCSupported && !DetectRTC.browser.isFirefox;
};

/* XDmv instance */
/* -------------- */
var XDmvc = new XDMVC();
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

    // For the PeerJS connection
    if (XDmvc.isHybrid()  || XDmvc.isPeerToPeer() ) {
        if(XDmvc.isPeerToPeer() || XDmvc.supportsPeerJS()) {
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
                this.peer.on('connection', function (conn) {
                    server.handleConnection(conn);
                });
                this.peer.on('error', function (err) {
                    server.handleError(err);
                });

            } else {
                console.warn("Already connected.")
            }
        } else {
            console.log("PeerJS not supported");
        }
    }
    // For the SocketIO connection
    if(XDmvc.isHybrid() || XDmvc.isClientServer()) {
        if (!this.serverSocket) {
            var socket = io.connect(this.socketIoAddress, {'forceNew': true}); //TODO:make port editable

            this.serverSocket = socket;
            socket.on('connect', function () {
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

            socket.on('wrapMsg', function (msg) {
                var sender = XDmvc.getConnectedDevice(msg.sender);
                if (sender !== undefined)
                    sender.connection.handleEvent(msg.eventTag, msg);
            });

            socket.on('error', function (err) {
                console.warn(err);
            });

        } else {
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

    XDmvc.emit('XDserver');

    // TODO the server may not have the peer yet. This should be sent a bit later
    this.send('device', XDmvc.device);
    this.send('roles', XDmvc.roles);
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
        var conn = null;
        var usePeerJS = XDmvc.usePeerToPeer(deviceId); //check which technology/architecture to use
        if(XDmvc.isPeerToPeer() || (XDmvc.isHybrid() && usePeerJS)){
            conn = this.peer.connect(deviceId, {serialization : 'binary', reliable: true});
            console.log('use peerJS to connect to ' + deviceId);
        }else if(XDmvc.isClientServer() || (XDmvc.isHybrid() && !usePeerJS)){
            conn = new VirtualConnection(this.serverSocket, deviceId);
            console.log('use socketIO to connect to ' + deviceId);
        }

        var connDev = XDmvc.addConnectedDevice(conn);
        connDev.installHandlers(conn);
        XDmvc.attemptedConnections.push(connDev);
        if(conn instanceof VirtualConnection) //just for socketIO
            conn.virtualConnect(deviceId);
    } else {
        console.warn("already connected");
    }
};

//TODO: not used by ClientServer yet
XDmvcServer.prototype.handleError = function handleError (err){
    XDmvc.cleanUpConnections();

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

    XDmvc.emit('XDerror');
};

XDmvcServer.prototype.handleConnection = function handleConnection (connection){
    var conDev = XDmvc.addConnectedDevice(connection);
    conDev.installHandlers(connection);
    XDmvc.attemptedConnections.push(conDev);
    Object.keys(XDmvc.syncData).forEach(function(key) {
        conDev.initial[key] = true;
    });
};

XDmvcServer.prototype.disconnect = function disconnect (){
    //for PeerJS
    if(XDmvc.isPeerToPeer() || (XDmvc.isHybrid() && XDmvc.supportsPeerJS()) ) {
        this.peer.destroy();
        this.peer = null;
    }
    //for SocketIO
    if(XDmvc.isClientServer() || XDmvc.isHybrid()) {
        this.serverSocket.disconnect();
        this.serverSocket = null;
    }
};


/*
 Virtual Connection for Client-Server Architecture
 ------------------------------------------------
 */

function VirtualConnection(serverSocket, peerId) {
    var vConn = this;
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
    this.callbackMap[tag](msg); //call the handler that was set in the on(...) method
}

VirtualConnection.prototype.close = function() {
    this.virtualSend({}, 'close');
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
    this.initial = [];
}

ConnectedDevice.prototype.isInterested = function(dataId){
    return this.roles.indexOf(XDmvc.defaultRole) > -1 || this.roles.some(function(role){
            return XDmvc.configuredRoles[role] && typeof XDmvc.configuredRoles[role][dataId] !== "undefined" ;
        }) ;
};

ConnectedDevice.prototype.usesPeerJS = function() {
    return ! this.connection instanceof VirtualConnection;
};

ConnectedDevice.prototype.handleRoles = function(roles){
    var old = this.roles;
    this.roles = roles;
    XDmvc.updateOthersRoles(old, this.roles);
    // sends the current state, the every time it receives roles from another device
    Object.keys(XDmvc.syncData).forEach(function (element) {
        if (this.isInterested(element)){
            var msg = {type: 'sync', data: XDmvc.syncData[element].data, id: element};
            this.connection.send(msg);
        }
    }, this);
    Platform.performMicrotaskCheckpoint();

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
                XDmvc.emit('XDdata', {'detail': msg.data});
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
                XDmvc.emit('XDdevice', {'detail': msg.data});
                Platform.performMicrotaskCheckpoint();
                break;
            case 'sync':
                if (!this.latestData[msg.id])  {
                    this.latestData[msg.id] = msg.data;
                }  else {
                    XDmvc.updateOld(this.latestData[msg.id], msg.data, msg.arrayDelta, msg.objectDelta);
                }
                var data = this.latestData[msg.id];

                // Don't update when the device freshly connected and it initiated the connection
                if (!this.initial[msg.id]) {
                    // First all role specific callbacks
                    var callbacks = XDmvc.getRoleCallbacks(msg.id);
                    //TODO data can now be a delta, this must be accounted for in the callbacks. maybe the last object should be cached
                    //TODO also, initially, the complete object should always be sent. otherwise the connected device may not have all information.
                    //TODO maybe on connection each device should already send all synchronised data to all devices?
                    if (callbacks.length > 0) {
                        callbacks.forEach(function(callback){
                            callback(msg.id, data, this.id);
                        }, this);
                    }
                    // Else object specific callbacks
                    else if (XDmvc.syncData[msg.id].callback) {
                        XDmvc.syncData[msg.id].callback(msg.id, data, this.id);
                        // Else default merge behaviour
                    } else {
                        XDmvc.update(msg.data, msg.id, msg.arrayDelta, msg.objectDelta);
                    }

                    XDmvc.emit('XDsync', {'detail': {dataId: msg.id, data: msg.data, sender: this.id}});
                } else {
                    this.initial[msg.id] = false;
                }

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
    if(this.usesPeerJS()) {
        console.warn("Error in PeerConnection:");
        console.warn(err);
        XDmvc.cleanUpConnections();
    } else {
        console.warn("Error in Socketio Connection:" + err.message );
        console.warn(err);
        if(err.type === 'peer-unavailable') {
            XDmvc.removeConnection(this);
        }
    }
    XDmvc.emit('XDerror', {"detail": err})
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
    XDmvc.emit('XDdisconnect', {'detail' : this.id});
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
    conn.on('error', this.handleError.bind(this));
    conn.on('open', this.handleOpen.bind(this));
    conn.on('data', this.handleData.bind(this));
    conn.on('close', this.handleClose.bind(this));

    XDmvc.emit('XDconnection', {'detail' : conn});
};


