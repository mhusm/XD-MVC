/*
 * XD-MVC -- A framework for cross-device applications
 * Copyright (C) 2014-2015 Maria Husmann. All rights reserved.
 *
 * XD-MVC is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * XD-MVC is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with XD-MVC. If not, see <http://www.gnu.org/licenses/>.
 *
 * See the README and LICENSE files for further information.
 *
 */


/*
 Server (Peer and Ajax)
 ---------------------
 */
function XDd2d(deviceId, host, portPeer, portSocketIo, ajaxPort, iceServers){
    XDEmitter.call(this);

    this.connectedDevices = [];
    this.attemptedConnections = [];
    this.deviceId = deviceId;
    this.availableDevices = [];
    this.server = null;
    this.serverReady = false;

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
    this.serverSocket = null;
    this.socketIoAddress = this.host + ':' + this.portSocketio;

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

XDd2d.prototype.configure = function configure (deviceId, host, portPeer, portSocketIo, ajaxPort, iceServers) {
    this.deviceId = deviceId? deviceId : this.deviceId;
    this.ajaxPort = ajaxPort ? ajaxPort: this.ajaxPort;
    this.portPeer = portPeer? portPeer: this.portPeer;
    this.portSocketio = portSocketIo ? portSocketIo : this.portSocketio;
    this.host = host? host: this.host;
    this.iceServers = iceServers ? iceServers : this.iceServers;
    this.socketIoAddress = this.host + ':' + this.portSocketio;

};

XDd2d.prototype.connect = function connect () {
    var XDd2d = this;
    this.sendToServer("id", undefined, function(msg){
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
                            XDd2d.sendToServer('deviceId', {peerId: id});
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
                    var socket = io.connect(this.socketIoAddress, {'forceNew': true});

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

            // Check periodically who is connected.
            // TODO could use socket.io connection for this?
            this.requestAvailableDevices();
            window.setInterval(function(){
                XDd2d.requestAvailableDevices();}, 5000);

            this.emit('XDserverReady');
            this.serverReady = true;
        }

    }.bind(this));

    window.addEventListener("unload", function(){
        this.disconnect();
    }.bind(this));

};

XDd2d.prototype.sendToServer = function send (type, data, callback){
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
    this.sendToServer("listAllPeers", null, function(msg){
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
        if (!this.connectedDevices.concat(this.attemptedConnections)
                .some(function (el) {
                    return el.id === device.id;
                })) {

                var usePeerJS = this.usePeerToPeer(deviceId);
             //check which technology/architecture to use
            if (this.isPeerToPeer() || (this.isHybrid() && usePeerJS)) {
                conn = this.peer.connect(device.peerId, {serialization: 'binary', reliable: true});
                console.info('using peerJS to connect to ' + deviceId);
            } else if (this.isClientServer() || (this.isHybrid() && !usePeerJS)) {
                conn = new VirtualConnection(this.serverSocket, deviceId, this);
                conn.virtualConnect(deviceId);
                console.info('using socketIO to connect to ' + deviceId);
            }

    //        var connDev = this.addConnectedDevice(conn);
            var connDev = this.createConnectedDevice(conn, deviceId);
            connDev.installHandlers(conn);
            this.attemptedConnections.push(connDev);
        } else {
          console.warn("already connected to " +deviceId);
        }
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

    this.emit('XDerror', err);
};

XDd2d.prototype.handleConnection = function handleConnection (connection){
    var id;
    if (connection instanceof VirtualConnection) {
        id = connection.peer;
    }

    var conDev = this.createConnectedDevice(connection, id);
    conDev.installHandlers(connection);
    conDev.initiator = true;
    this.attemptedConnections.push(conDev);

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
    this.serverReady = false;
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
        this.emit('XDdisconnection', connection);
    }

    index = this.attemptedConnections.indexOf(connection);
    if (index > -1) {
        this.attemptedConnections.splice(index, 1);
    }

};



XDd2d.prototype.disconnectDevice = function disconnectDevice(deviceId) {
    var conn = this.getConnectedDevice(deviceId);
    if (conn) {
        conn.disconnect();
    }
};

XDd2d.prototype.disconnectAll = function disconnectAll() {
    this.connectedDevices.forEach(function(device){
        device.disconnect();
    });
};

XDd2d.prototype.getConnectedDevice = function (deviceId) {
    return this.connectedDevices.find(function (c) {return c.id === deviceId; });
};


XDd2d.prototype.addConnectedDevice = function(conDev){
    this.connectedDevices.push(conDev);

    var index = this.attemptedConnections.findIndex(function(element){ return element.connection === conDev.connection});
    if (index > -1) {
        this.attemptedConnections.splice(index, 1);
    }
    index = this.availableDevices.findIndex(function(element){ return element.id === conDev.id});
    if (index > -1) {
        this.availableDevices.splice(index, 1);
    }
};

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

XDd2d.prototype._sendToAll = function (msgType, data) {
    var len = this.connectedDevices.length,
        i;
    for (i = 0; i < len; i++) {
        this.connectedDevices[i]._send(msgType, data);
    }
};

XDd2d.prototype.sendToAll = function (msgType, data) {
    var len = this.connectedDevices.length,
        i;
    for (i = 0; i < len; i++) {
        this.connectedDevices[i].send(msgType, data);
    }
};
XDd2d.prototype.sendTo = function (deviceId, msgType, data) {
    var device = this.getConnectedDevice(deviceId);
    if (device) {
        device.send(msgType, data);
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
    this.initiator = false; // Indicates if this device initiated the connection
    this.XDd2d = XDd2d;
}

ConnectedDevice.prototype.usesPeerJS = function() {
    return ! this.connection instanceof VirtualConnection;
};


ConnectedDevice.prototype.handleData = function(msg){
    var ids;
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
            case 'customMsg':
                this.XDd2d.emit(msg.data.label, msg.data.payload, this);
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
        this.XDd2d.cleanUpConnections();
    } else {
        console.warn("Error in Socketio Connection:" + err.message );
        console.warn(err);
        if(err.type === 'peer-unavailable') {
            this.XDd2d.removeConnection(this);
        }
    }
    this.XDd2d.emit('XDconnectionError',  err, this);
};

ConnectedDevice.prototype.handleOpen = function handleOpen (){
    this._send("id", this.XDd2d.deviceId);
};
ConnectedDevice.prototype.handleId = function handleId (id){
    this.id = id;
    this.XDd2d.addConnectedDevice(this);
    var thisDevice = this;
    var others = this.XDd2d.connectedDevices.filter(function (el) {return el.id !== thisDevice.id; })
        .map(function (el) {return el.id; });
    this._send('connections', others);

    console.info("Connection established to " +id);
    this.XDd2d.emit("XDopen", this);
};

ConnectedDevice.prototype.handleClose = function handleClose (){
    this.XDd2d.removeConnection(this);
};

ConnectedDevice.prototype._send = function _send (msgType, data){
    if (this.connection && this.connection.open) {
        this.connection.send({type: msgType, data: data });
    } else {
        console.warn("Can not send message to device. Not connected to " +this.id );
    }
};

ConnectedDevice.prototype.send = function send (label, data){
    this._send("customMsg", {label: label, payload: data});
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

 //   this.XDd2d.emit('XDconnectionReceived', this);
};


