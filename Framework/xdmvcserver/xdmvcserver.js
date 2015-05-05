var util         = require("util");
var EventEmitter = require("events").EventEmitter;
var PeerServer = require('peer').PeerServer;
var connect = require('connect'),
    http = require('http'),
    bodyParser = require('body-parser'),
    url = require('url');
    io =  require('socket.io')();

//Silvan
var app = require('express')();
var server  = require('http').createServer(app);
var io      = require('socket.io').listen(server);

//Silvan


//CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.setHeader ('Access-Control-Allow-Origin', "*");
    res.setHeader ('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.setHeader ('Access-Control-Allow-Headers', 'Content-Type');
    next();
};

function XDmvcServer() {
    EventEmitter.call(this);
    this.peers = {};
    this.sessions = {};
    this.mapping = {};
    this.configuredRoles = {};
}
util.inherits(XDmvcServer, EventEmitter);

XDmvcServer.prototype.startPeerSever = function(port){
    //Silvan

    server.listen(3000);

    var xdServer = this;

    io.on('connection', function(socket){
        var id = socket.id;

        console.log('user connected ' + socket.id);
        that.emit("connected", id);

        socket.on('disconnect', function(){
            //TODO: handle disconnect
            console.log('user disconnected ' + socket.id);
        });

        socket.on('connectTo', function(msg) {
            // store the id's in peers.connectedPeers


            if(xdServer.peers[msg.partnerId] !== undefined) {
                xdServer.peers[msg.myId].connectedPeers.push(msg.partnerId);
                xdServer.peers[msg.partnerId].connectedPeers.push(msg.myId);
            } else {
                //TODO: send back error
            }



        });


        socket.on('message', function(msg){

            // VERSION 1
            //console.log('message: ' + msg + ' for ' + msg.interestedDevices);

            msg.interestedDevices.forEach(function(peerId) {
                var socketId = xdServer.mapping[peerId];
                io.sockets.connected[socketId].emit('message', msg); //send message only to interestedDevice
            });


            //VERSION 2
            for(peer in xdServer.peers) { //TODO: correct usage ???
                if(xdServer.isInterested(peer, msg.id)){
                    console.log(peer + ' is interested on ' + msg.id);
                    var socketId = xdServer.mapping[peer];
                    if(socketId !== this.id) {
                        console.log('sending update to: ' + socketId);
                        io.sockets.connected[socketId].emit('message', msg); //send message only to interestedDevice
                    }

                }
            };

        });

        socket.on('id', function(msg){
            console.log('match deviceId ' + msg  + ' to socketioId ' + id);
            xdServer.peers[msg] = {
                'id': msg,
                'name': undefined,
                'role': undefined,
                'roles': [],
                'session': undefined,
                'connectedPeers' : []
            };
            xdServer.mapping[msg] = id;
        });

        socket.on('roleConfigs', function(msg) {
            console.log('configuredRoles: ' + JSON.stringify(msg.roles));
            xdServer.configuredRoles = msg.roles;
        });


    });



};



//Silvan
XDmvcServer.prototype.isInterested = function isInterested(receiver, dataId){
    var roles = this.configuredRoles;
    return this.peers[receiver].roles.some(function(role){
            return roles[role] && typeof roles[role][dataId] !== "undefined" ;
        }) ;
};
//Silvan

XDmvcServer.prototype.startAjaxServer = function(port){
    var that = this;
    var ajax = function(req, res, next){
        return that.handleAjaxRequest(req,res,next, that);
    };
    var app = connect().use(bodyParser.json({limit: '50mb'})).use(allowCrossDomain).use(ajax);
    var server = http.createServer(app);
    server.listen(port);
};

XDmvcServer.prototype.handleAjaxRequest = function(req, res, next, xdmvcServer){
    var parameters = url.parse(req.url, true);
    var query = parameters.query;

    res.statusCode = 200;

    if (req.method == "POST") {
        query = req.body;
    } else if (req.method == "OPTIONS"){
        res.end();
        return;
    }
    res.setHeader("Content-Type", "text/json");

    switch (query.type){
        case 'listAllPeers':
            // return list of all peers
            var peersArray = Object.keys(xdmvcServer.peers).map(function (key) {return xdmvcServer.peers[key]});
            res.write('{"peers": ' + JSON.stringify(peersArray) + ', "sessions": ' + JSON.stringify(xdmvcServer.sessions) + '}');
            res.end();
            break;

        case 'sync':
             xdmvcServer.emit("objectChanged", query.data);
             res.end();
             break;
        case 'roles':
            // only store role information, if the peer is already connected
            if (xdmvcServer.peers[query.id]){
                xdmvcServer.peers[query.id].roles = query.data;
            }
            res.end();
            break;
        case 'device':
            // only store device information, if the peer is already connected
            if (xdmvcServer.peers[query.id]){
                xdmvcServer.peers[query.id].device = query.data;
            }
            res.end();
            break;
        default :
            // someone tried to call a not supported method
            // answer with 404
            console.log("not found");
            res.setHeader("Content-Type", "text/html");
            //      res.statusCode = 404;
            res.write('<h1>404 - File not found</h1>');
            res.write(parameters.pathname);
            res.end();
    }
/*
    if (query.type && query.type === "listAllPeers") {
        // return list of all peers
        var peersArray = Object.keys(xdmvcServer.peers).map(function (key) {return xdmvcServer.peers[key]});
        res.write('{"peers": ' + JSON.stringify(peersArray) + ', "sessions": ' + JSON.stringify(xdmvcServer.sessions) + '}');
        res.end();

    } else if (query.joinSession != null && query.id != null && query.session != null) {
        // Join Session
        if (xdmvcServer.sessions[query.session] === undefined) {
            // New Session must be created
            xdmvcServer.sessions[query.session] = {
                'id': query.session,
                'peers': []
            };
            console.info('Session ' + query.session + ' created.');
        }

        if (xdmvcServer.sessions[query.session].peers.indexOf(query.id) === -1) {
            xdmvcServer.peers[query.id].session = query.session;
            xdmvcServer.sessions[query.session].peers.push(query.id);
            res.write('{"peers": ' + JSON.stringify(xdmvcServer.sessions[query.session]) + '}');
            console.info(query.id + ' joined Session ' + query.session + '.');
        }
        res.end();

    } else if (query.storeSession != null && query.id != null && query.sessionId != null && query.data != null) {
        // store session
        //TODO handle event based instead
        xdmvcServer.emit("store", query.sessionId, query.id, query.role, query.name, query.data, res);
  //      storageModule.storeSession(query.sessionId, query.id, query.role, query.name, query.data, res);

    } else if (query.restoreSession != null && query.id != null && query.sessionId != null) {
        //TODO handle event based instead
//        // restore session
        xdmvcServer.emit("restore", query.sessionId, query.id, res);
 //       storageModule.restoreSession(query.sessionId, query.id, res);
    } else if (query.type && query.type === "sync") {
        xdmvcServer.emit("objectChanged", query.data);
        res.end();
    } else if (query.type && query.type === "roles") {
        // only store role information, if the peer is already connected
        if (xdmvcServer.peers[query.id]){
            xdmvcServer.peers[query.id].roles = query.data;
        }
        res.end();
    } else if (query.type && query.type === "device") {
        // only store device information, if the peer is already connected
        if (xdmvcServer.peers[query.id]){
            xdmvcServer.peers[query.id].device = query.data;
        }
        res.end();
    } else {
        // someone tried to call a not supported method
        // answer with 404
        console.log("not found");
        res.setHeader("Content-Type", "text/html");
  //      res.statusCode = 404;
        res.write('<h1>404 - File not found</h1>');
        res.write(parameters.pathname);
        res.end();
    }
    */
};

XDmvcServer.prototype.start = function(portPeer, portAjax) {
    portPeer = portPeer? portPeer : 9000;
    portAjax = portAjax? portAjax : 9001;

    this.startPeerSever(portPeer);
    this.startAjaxServer(portAjax);
};

module.exports = XDmvcServer;