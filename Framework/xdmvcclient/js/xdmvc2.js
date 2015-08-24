/**
 * Created by husmannm on 24.08.2015.
 */
/*global console, Peer, Event */
'use strict';
/*jslint plusplus: true */


function XDMVC () {
    XDEmitter.call(this);
    this.defaultRole = "sync-all";
    this.deviceId = undefined;
    this.device = {};
    this.othersDevices = {small: 0, medium: 0, large: 0, xlarge: 0}; //TODO deviceTypes
    this.syncData = {};
    this.lastSyncId = 0;
    this.storedPeers = [];
    this.reconnect = false;
    this.roles = []; // roles that this peer has
    this.othersRoles = {}; // roles that other peers have
    this.configuredRoles = {}; // roles that have been configured in the system
    this.server = null;
    this.XDd2d = null;
}


XDMVC.prototype = Object.create(XDEmitter.prototype);
XDMVC.prototype.constructor = XDMVC;


/*
 --------------------
 Server communication
 --------------------
 */
XDMVC.prototype.connectToServer = function connectToServer (host, portPeer, portSocketIo, ajaxPort, iceServers){
    this.XDd2d = new XDd2d(this.deviceId, host, portPeer, portSocketIo, ajaxPort, iceServers);
};


XDMVC.prototype.getAvailableDevices = function getAvailableDevices (){
    //TODO
};

XDMVC.prototype.getConnectedDevices = function getConnectedDevices (){
    //TODO
};

XDMVC.prototype.getDevices = function getDevices (){
    //TODO map the connections to the device information
};

/*
XDMVC.prototype.sendToServer = function(type, data, callback){
    if (this.server) {
        this.server.send(type, data, callback);
    } else {
        console.warn("Send to server failed. Not connected to server");
    }
};
*/
XDMVC.prototype.handleOpen = function(connectedDevice){
    connectedDevice.send("roles", this.roles);
    connectedDevice.send("device", this.device);

    if (this.storedPeers.indexOf(connectedDevice.id) === -1) {
        this.storedPeers.push(connectedDevice.id);
        this.storePeers();
    }
    //TODO emit an event. but not here, on device instead
};

XDMVC.prototype.handleDevice = function(connectedDevice){
    this.emit("XDdevice", connectedDevice.device);
    //TODO emit an event.
};

XDMVC.prototype.serverReady = function(){
    this.deviceId = this.XDd2d.deviceId;
    localStorage.setItem("deviceId", this.deviceId);

    this.XDd2d.send('device', this.device);
    this.XDd2d.send('roles', this.roles);

    if (this.reconnect) {
        this.connectToStoredPeers();
    }

};
/*
 ------------
 Stored Peers
 ------------
 */

XDMVC.prototype.connectToStoredPeers = function () {
    this.storedPeers.forEach(this.XDd2d.connectTo.bind(this.XDd2d));
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
        this.XDd2d.sendToServer("sync", {type: 'sync', data: this.syncData[id].data});
    }
    this.emit('XDsyncData', id);
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
            var args= [0, observed.data.length].concat(data);
            splices = [args];
        }

        observed.updateArrayFunction(id, splices);
    } else {
        if (objectDelta) {
            added = data[0];
            removed = data[1];
            changedOrAdded = data[2];
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

    this.emit('XDupdate', {dataId: id, data: observed.data});
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

    this.XDd2d.sendToAll("roleConfigurations", {role: role, configurations : configurations});
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
    this.XDd2d.sendToAll('roles', this.roles);
    this.XDd2d.sendToServer('roles', this.roles);
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
    var deviceId = localStorage.getItem("deviceId");

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


// TODO update and test
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
    this.XDd2d.sendToAll('device', this.device);
    this.XDd2d.sendToServer('device', this.device);
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

    // TODO device name is not really used at the moment
    var name = localStorage.getItem("deviceName");
    this.device.name = name? name : this.deviceId;
    localStorage.setItem("deviceName", this.device.name);
    Platform.performMicrotaskCheckpoint();
};


/* XDmv instance */
/* -------------- */
var XDmvc = new XDMVC();

