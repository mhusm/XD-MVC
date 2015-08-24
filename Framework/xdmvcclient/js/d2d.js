/*
 Server (Peer and Ajax)
 ---------------------
 */
function XDd2d(deviceId, host, portPeer, portSocketIo, ajaxPort, iceServers){
    XDEmitter.call(this);

    this.connectedDevices = []; // TODO maybe rename?
    this.attemptedConnections = [];
    this.deviceId = deviceId;
    this.availableDevices = [];
    this.server = null;

    /*
     ---------
     Constants
     ---------
     */
    this.peerToPeer = 'peer-to-peer';
    this.clientServer = 'client-server';
    this.hybrid = 'hybrid';
    this.defaultPeerPort = 9000;
    this.defaultAjaxPort = 9001;
    this.defaultSocketIoPort = 3000;

    /*
     --------------------
     Network Architecture
     --------------------
     */
    this.network_architecture = 'hybrid';

    this.ajaxPort = ajaxPort ? ajaxPort: this.defaultAjaxPort;
    this.portPeer = portPeer? portPeer: this.defaultPeerPort;
    this.portSocketio = portSocketIo ? portSocketIo : this.defaultSocketIoPort;
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

XDd2d.prototype = Object.create(XDEmitter.prototype);
XDd2d.prototype.constructor = XDd2d;

XDd2d.prototype.setClientServer = function() { this.network_architecture = this.clientServer; };

XDd2d.prototype.setPeerToPeer = function() { this.network_architecture = this.peerToPeer; };
XDd2d.prototype.setHybrid = function() { this.network_architecture = this.hybrid};
XDd2d.prototype.isClientServer = function() { return this.network_architecture === this.clientServer; };
XDd2d.prototype.isPeerToPeer = function() { return this.network_architecture === this.peerToPeer; };
XDd2d.prototype.isHybrid = function() { return this.network_architecture === this.hybrid};

/*
 function to determine whether a peerJS or a SocketIo connection should be used to connect
 to the remoteId device. Logic might be extended. Currently the decision is made based on
 the availability of WebRTC and whether the remote has connected to the server with peerJS
 */
XDd2d.prototype.usePeerToPeer = function usePeerToPeer(remoteId) {
    var device = this.availableDevices.find(function(avDev){return avDev.id === remoteId; });

    if(! this.supportsPeerJS()) //if this device does not support WebRTC (maybe a check via peerJS is possible)
        return false;

    if(device && !device.usesPeerJs)
        return false; // one of both devices does not support WebRTC

    return true; // both devices support WebRTC or the remote does not show up in the list
};

XDd2d.prototype.supportsPeerJS = function() {
    return DetectRTC.isWebRTCSupported && !DetectRTC.browser.isFirefox;
};

XDd2d.prototype.connect = function connect () {
    var XDd2d = this;
    this.send("id", undefined, function(msg){
        var result = JSON.parse(msg);
        if (result.error) {
            console.error("Could not connect to server. ID is already taken: " +this.deviceId);
        } else {
            this.deviceId = result.id;

            // For the PeerJS connection
            if (this.isHybrid()  || this.isPeerToPeer() ) {
                if(this.isPeerToPeer() || this.supportsPeerJS()) {
                    if (!this.peer) {
                        this.peer = new Peer({
                            host: this.host,
                            port: this.portPeer,
                            //                           debug: 3,
                            config: {
                                'iceServers': this.iceServers
                            }
                        });
                        this.peer.on('connection', function (conn) {
                            XDd2d.handleConnection(conn);
                        });
                        this.peer.on('error', function (err) {
                            XDd2d.handleError(err);
                        });

                        this.peer.on('open', function(id) {
                            XDd2d.send('deviceId', {peerId: id});
                        });
                    } else {
                        console.warn("Already connected to PeerJS");
                    }
                } else {
                    console.log("PeerJS not supported");
                }
            }
            // For the SocketIO connection
            if(this.isHybrid() || this.isClientServer()) {
                if (!this.serverSocket) {
                    var socket = io.connect(this.socketIoAddress, {'forceNew': true}); //TODO:make port editable

                    this.serverSocket = socket;
                    socket.on('connect', function () {
                        socket.emit('id', XDd2d.deviceId);
                    });

                    // another Peer called virtualConnect(...)
                    socket.on('connectTo', function (msg) {
                        var conn = new VirtualConnection(this, msg.sender, XDd2d);
                        XDd2d.handleConnection(conn);
                        //send readyForOpen
                        socket.emit('readyForOpen', {recA: XDd2d.deviceId, recB: msg.sender});
                    });

                    socket.on('wrapMsg', function (msg) {
                        var sender = XDd2d.getConnectedDevice(msg.sender);
                        if (!sender) {
                            sender = XDd2d.getAttemptedConnection(msg.sender);
                        }
                        if (sender) {
                            sender.connection.handleEvent(msg.eventTag, msg);
                        }
                    });

                    socket.on('error', function (err) {
                        console.warn(err);
                    });

                } else {
                    console.warn("Already connected.")
                }
            }
            if (this.reconnect) {
                this.connectToStoredPeers();
            }

            // Check periodically who is connected.
            // TODO could use socket.io connection for this?
            this.requestAvailableDevices();
            window.setInterval(function(){
                XDd2d.requestAvailableDevices();}, 5000);

            this.emit('XDserver');

            // TODO the server may not have the peer yet. This should be sent a bit later

            //TODO do this in other module
            /*
             this.send('device', XDmvc.device);
             this.send('roles', XDmvc.roles);
             */

        }

    }.bind(this));
};

XDd2d.prototype.send = function send (type, data, callback){
    var url = window.location.protocol +"//" +this.host +":" +this.ajaxPort;
    ajax.postJSON(url, {type: type, data:data, id: this.deviceId},
        function(reply){
            if (callback){
                callback(reply);
            }
        },
        true
    );
};

XDd2d.prototype.requestAvailableDevices = function requestAvailableDevices (callback){
    var XDd2d = this;
    this.send("listAllPeers", null, function(msg){
        var peers = JSON.parse(msg).peers;
        XDd2d.availableDevices.length = 0;
        // Filter out self and peers that we are connected to already
        peers.filter(function (p) {
            return p.id !== XDd2d.deviceId && !XDd2d.connectedDevices.some(function (el) {return el.id === p.id; });
        })
        .forEach(function (peer) {
            XDd2d.availableDevices.push(peer);
        });
        if (callback) {
            callback();
        }
    }.bind(this));
};

XDd2d.prototype.connectTo = function connectTo (deviceId) {
    // Check if connection exists already
    var internalConnect = function(device) {
        var usePeerJS = this.usePeerToPeer(deviceId); //check which technology/architecture to use
        if(this.isPeerToPeer() || (this.isHybrid() && usePeerJS)){
            conn = this.peer.connect(device.peerId, {serialization : 'binary', reliable: true});
            console.info('using peerJS to connect to ' + deviceId);
        }else if(this.isClientServer() || (this.isHybrid() && !usePeerJS)){
            conn = new VirtualConnection(this.serverSocket, deviceId, this);
            conn.virtualConnect(deviceId);
            console.info('using socketIO to connect to ' + deviceId);
        }

//        var connDev = this.addConnectedDevice(conn);
        var connDev = this.createConnectedDevice(conn, deviceId);
        connDev.installHandlers(conn);
        this.attemptedConnections.push(connDev);

    }.bind(this);


    if (!this.connectedDevices.concat(this.attemptedConnections)
            .some(function (el) {return el.id === deviceId; })) {
        var conn = null;
        var device = this.availableDevices.find(function(avDev){return avDev.id === deviceId; });
        // If the device is not in the list or appears to be not ready yet, update the list and then try to connect.
        if (!device || (!device.usesPeerJS && !device.usesSocketIo)) {
            this.requestAvailableDevices(
                function(){
                    var device = this.availableDevices.find(function(avDev){return avDev.id === deviceId; });
                    if (device) {
                        internalConnect(device);
                    } else {
                        console.warn("Could not connect. Device is not available. Device ID: " +deviceId);
                    }
                }.bind(this)
            );
        } else {
            internalConnect(device);
            /*
            var usePeerJS = this.usePeerToPeer(deviceId); //check which technology/architecture to use
            if(this.isPeerToPeer() || (this.isHybrid() && usePeerJS)){
                conn = this.peer.connect(device.peerId, {serialization : 'binary', reliable: true});
                console.log('use peerJS to connect to ' + deviceId);
            }else if(this.isClientServer() || (this.isHybrid() && !usePeerJS)){
                conn = new VirtualConnection(this.serverSocket, deviceId);
                conn.virtualConnect(deviceId);
                console.log('use socketIO to connect to ' + deviceId);
            }

            var connDev = this.addConnectedDevice(conn);
            connDev.installHandlers(conn);
            this.attemptedConnections.push(connDev);
            */
     /*
            if(conn instanceof VirtualConnection) //just for socketIO
                conn.virtualConnect(deviceId);
      */
        }
    } else {
        console.warn("already connected to " +deviceId);
    }
};

//TODO: not used by ClientServer yet
XDd2d.prototype.handleError = function handleError (err){
    this.cleanUpConnections();

    if (err.type === "peer-unavailable") {
        var peerError = "Could not connect to peer ";
        var peer = err.message.substring(peerError.length);
        var conn = this.attemptedConnections.find(function (c) {return c.connection.peer === peer; });
        var index = this.attemptedConnections.indexOf(conn);
        if (index > -1) {
            this.attemptedConnections.splice(index, 1);
        }
        console.info(err.message);
    } else {
        console.warn(err);
    }

    this.emit('XDerror');
};

XDd2d.prototype.handleConnection = function handleConnection (connection){
//    var conDev = this.addConnectedDevice(connection);
    var id;
    if (connection instanceof VirtualConnection) {
        id = connection.peer;
    }

    var conDev = this.createConnectedDevice(connection, id);
    conDev.installHandlers(connection);
    conDev.initiator = false;
    this.attemptedConnections.push(conDev);

    //TODO do this in other module
/*
    Object.keys(XDmvc.syncData).forEach(function(key) {
        conDev.initial[key] = true;
    });
    */
};

XDd2d.prototype.disconnect = function disconnect (){
    //for PeerJS
    if(this.isPeerToPeer() || (this.isHybrid() && this.supportsPeerJS()) ) {
        this.peer.destroy();
        this.peer = null;
    }
    //for SocketIO
    if(this.isClientServer() || this.isHybrid()) {
        this.serverSocket.disconnect();
        this.serverSocket = null;
    }
};

/*
 ----------------------------
 Connection Management
 ----------------------------
 */
XDd2d.prototype.cleanUpConnections = function () {
    var closed = this.connectedDevices.filter(function (c) {
        return !c.connection.open;
    });

    var len = closed.length,
        i;
    for (i = 0; i < len; i++) {
        this.removeConnection(closed[i]);
    }
};

XDd2d.prototype.removeConnection = function (connection) {
    var index = this.connectedDevices.indexOf(connection);
    if (index > -1) {
        this.connectedDevices.splice(index, 1);
        this.updateOthersRoles(connection.roles, []);

        if (connection.device) {
            this.othersDevices[connection.device.type] -= 1;
        }
    }

    index = this.attemptedConnections.indexOf(connection);
    if (index > -1) {
        this.attemptedConnections.splice(index, 1);
    }

    this.emit('XDdisconnection', {'detail': connection});
};



XDd2d.prototype.disconnect = function disconnect(peerId) {
    var conn = this.getConnectedDevice(peerId);
    if (conn) {
        conn.disconnect();
    }
};

XDd2d.prototype.disconnectAll = function disconnectAll() {
    this.connectedDevices.forEach(function(device){
        device.disconnect();
    });
};

XDd2d.prototype.getConnectedDevice = function (peerId) {
    return this.connectedDevices.find(function (c) {return c.id === peerId; });
};


XDd2d.prototype.addConnectedDevice = function(conDev){
    this.connectedDevices.push(conDev);
    //TODO test this
    var index = this.attemptedConnections.findIndex(function(element){ return element.connection === conDev.connection});
    if (index > -1) {
        this.attemptedConnections.splice(index, 1);
    }
};

/*
XDd2d.prototype.addConnectedDevice = function(connection){
    var conDev =  this.connectedDevices.find(function (c) {return c.connection === connection; });
    if (!conDev){
        conDev = new ConnectedDevice(connection, connection.peer, this);
        this.connectedDevices.push(conDev);
        //TODO test this
        var index = this.attemptedConnections.findIndex(function(element){ return element.id === connection.peer});
        if (index > -1) {
            this.attemptedConnections.splice(index, 1);
        }
    }
    return conDev;
};
*/

XDd2d.prototype.createConnectedDevice = function(connection, deviceId){
    var conDev =  this.connectedDevices.concat(this.attemptedConnections).find(function (c) {return c.connection === connection; });
    if (!conDev){
        conDev = new ConnectedDevice(connection, deviceId, this);
    }
    return conDev;
};

XDd2d.prototype.getAttemptedConnection = function (peerId) {
    return this.attemptedConnections.find(function (c) {
        return c.id === peerId;
    });
};


XDd2d.prototype.sendToAll = function (msgType, data) {
    var len = this.connectedDevices.length,
        i;
    for (i = 0; i < len; i++) {
        this.connectedDevices[i].send(msgType, data);
    }
};


/*
 Virtual Connection for Client-Server Architecture
 ------------------------------------------------
 */

function VirtualConnection(serverSocket, peerId, XDd2d) {
    this.server = serverSocket;
    this.peer = peerId;
    this.callbackMap = {};
    this.open = false;
    this.XDd2d = XDd2d;
}


VirtualConnection.prototype.send = function send(msg) {
    this.virtualSend(msg,'data');
};

VirtualConnection.prototype.virtualSend = function virtualSend( originalMsg, eventTag) {
    originalMsg.receiver = this.peer;
    originalMsg.sender = this.XDd2d.deviceId;
    originalMsg.eventTag = eventTag;
    this.server.emit('wrapMsg', originalMsg);
};

// connect to another peer by sending an open to the other peer, via the server
VirtualConnection.prototype.virtualConnect = function virtualConnect(remoteDeviceId) {
    this.server.emit('connectTo', {receiver:remoteDeviceId, sender: this.XDd2d.deviceId});
  //  this.open = true;
};


VirtualConnection.prototype.on = function on(eventTag, callback){
    this.callbackMap[eventTag] = callback;
};

VirtualConnection.prototype.handleEvent = function(tag, msg) {
    if (tag  === 'open') {
        this.open = true;
    }
    this.callbackMap[tag](msg); //call the handler that was set in the on(...) method
};

VirtualConnection.prototype.close = function() {
    this.virtualSend({}, 'close');
};

/*
 Connected Devices
 -----------------
 */
function ConnectedDevice(connection, id, XDd2d){
    this.connection = connection;
    this.id = id;
    this.roles = [];
    this.device = {};
    this.latestData = {};
    this.initial = [];
    this.initiator = true; // Indicates if this device initiated the connection
    this.XDd2d = XDd2d;
}
// TODO do this in another module
/*
ConnectedDevice.prototype.isInterested = function(dataId){
    return this.roles.indexOf(XDmvc.defaultRole) > -1 || this.roles.some(function(role){
            return XDmvc.configuredRoles[role] && typeof XDmvc.configuredRoles[role][dataId] !== "undefined" ;
        }) ;
};
*/
ConnectedDevice.prototype.usesPeerJS = function() {
    return ! this.connection instanceof VirtualConnection;
};
// TODO do this in another module
/*
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

*/

ConnectedDevice.prototype.handleData = function(msg){
    var ids;
    console.log(msg);
    if (Object.prototype.toString.call(msg) === "[object Object]") {
        // Connect to the ones we are not connected to yet
        switch (msg.type) {
            case 'connections':
                ids = this.XDd2d.connectedDevices.map(function (el) {
                    return el.id;
                });
                msg.data.filter(function (el) {
                    return ids.indexOf(el) < 0;
                }).forEach(function (el) {
                    this.XDd2d.connectTo(el);
                }, this);
                break;
            case 'id':
                this.handleId(msg.data);
                break;
            default :
                console.warn("received unhandled msg type");
                console.warn(msg);
        }
    }

            /*
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
    */

};


//TODO: make nicer e.g with different err.type
ConnectedDevice.prototype.handleError = function handleError (err){
    if(this.usesPeerJS()) {
        console.warn("Error in PeerConnection:");
        console.warn(err);
        this.XDd2d.cleanUpConnections();
    } else {
        console.warn("Error in Socketio Connection:" + err.message );
        console.warn(err);
        if(err.type === 'peer-unavailable') {
            this.XDd2d.removeConnection(this);
        }
    }
    this.XDd2d.emit('XDerror', {"detail": err})
};

ConnectedDevice.prototype.handleOpen = function handleOpen (){
 //   this.XDd2d.emit("XDopen", this);
//    this.XDd2d.addConnectedDevice(this);
    this.send("id", this.XDd2d.deviceId);
    // TODO do this in another module
/*
    if (XDmvc.storedPeers.indexOf(this.id) === -1) {
        XDmvc.storedPeers.push(this.id);
        XDmvc.storePeers();
    }
    */


    // TODO do this in another module
    /*
    this.send("roles", XDmvc.roles);
    this.send("device", XDmvc.device);
    */
};
ConnectedDevice.prototype.handleId = function handleId (id){
    this.id = id;
    this.XDd2d.addConnectedDevice(this);
    // TODO do this in another module
    /*
     if (XDmvc.storedPeers.indexOf(this.id) === -1) {
     XDmvc.storedPeers.push(this.id);
     XDmvc.storePeers();
     }
     */

    var thisDevice = this;
    var others = this.XDd2d.connectedDevices.filter(function (el) {return el.id !== thisDevice.id; })
        .map(function (el) {return el.id; });
    this.send('connections', others);

    // TODO do this in another module
    /*
     this.send("roles", XDmvc.roles);
     this.send("device", XDmvc.device);
     */
    console.info("Connection established to " +id);
    this.XDd2d.emit("XDopen", this);
};

ConnectedDevice.prototype.handleClose = function handleClose (){
    this.XDd2d.removeConnection(this);
    this.XDd2d.emit('XDdisconnect', {'detail' : this.id});
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
    this.XDd2d.removeConnection(this);
};

ConnectedDevice.prototype.installHandlers = function installHandlers(conn){
    conn.on('error', this.handleError.bind(this));
    conn.on('open', this.handleOpen.bind(this));
    conn.on('data', this.handleData.bind(this));
    conn.on('close', this.handleClose.bind(this));

    this.XDd2d.emit('XDconnection', {'detail' : this});
};


