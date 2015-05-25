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
        xdServer.emit("connected", id);

        socket.on('disconnect', function(){
            //TODO: handle disconnect
            //console.log('user disconnected ' + socket.id);
            var deviceId;
            var connPeers;

            //There should be exactly one object in peers with socketioId === socket.id
            for(var peer in xdServer.peers)
                if (xdServer.peers[peer] && xdServer.peers[peer].socketioId === socket.id){
                    deviceId = peer;
                    connPeers =xdServer.peers[deviceId].connectedPeers;
                }
            
            delete xdServer.peers[deviceId]; //delete peer that disconnected

            if(deviceId) {
                var arrayLength = connPeers.length;
                var msg = {sender:deviceId, eventTag:'close'};
                for (var i = 0; i < arrayLength; i++) {
                    var peerObject= xdServer.peers[connPeers[i]]
                    if(peerObject){// otherwise the other one disconnected nearly simultaneously or was connected to himself
                        io.sockets.connected[peerObject.socketioId].emit('wrapMsg', msg); //send message only to interestedDevice
                        var removeDeviceId = peerObject.connectedPeers.filter(
                            function(thisDevice){ return thisDevice !== deviceId;}
                        ); // splice the array at index of deviceId
                        peerObject.connectedPeers = removeDeviceId;
                    }

                }

            } else
                console.log('peer was not in peers --> TODO:check logic');

            console.log('user '+ deviceId + ' disconnected --> server sent close event to connected peers: ' + connPeers);
        });

        socket.on('connectTo', function(msg) {

            var receiver = msg.receiver;
            if(xdServer.peers[receiver] !== undefined) {
                var socketId = xdServer.peers[receiver].socketioId;
                console.log(msg.sender + ' tries to connect to ' + receiver);
                io.sockets.connected[socketId].emit('connectTo', msg);
            } else {
                var err = {
                        eventTag : 'error',
                        sender : msg.receiver,
                        type : "peer-unavailable",
                        message : "the peer you wanted to connect to is not available"
                };
                io.sockets.connected[this.id].emit('wrapMsg', err);
                console.log(msg.myId + ' tries to connect to ' + msg.partnerId + ' : failed ! (peer not available)');
            }



        });

        socket.on('readyForOpen', function(msg) {
            // store the id's in peers.connectedPeers
            xdServer.peers[msg.recA].connectedPeers.push(msg.recB);
            xdServer.peers[msg.recB].connectedPeers.push(msg.recA);

            //one of both is identical to this.id
            var socketidA = xdServer.peers[msg.recA].socketioId;
            var socketidB = xdServer.peers[msg.recB].socketioId;
            // send open Event to both peers
            var msgA = {sender:msg.recB, eventTag:'open'};
            var msgB = {sender:msg.recA, eventTag:'open'};
            //TODO:maybe check if really connected
            io.sockets.connected[socketidA].emit('wrapMsg', msgA);
            io.sockets.connected[socketidB].emit('wrapMsg', msgB);

            console.log('--> connection established !');
        });

        socket.on('error', function(err){
            console.log('socket Error: ' + err);
        });

        socket.on('wrapMsg', function(msg){
            console.log('message: ' + msg + ' for ' + msg.receiver);
            var connRec = xdServer.peers[msg.receiver];
            if(connRec !== undefined)
                io.sockets.connected[connRec.socketioId].emit('wrapMsg', msg); //send message only to interestedDevice
            else {
                var err = {
                    eventTag : 'error',
                    sender : msg.receiver,
                    type : "peer-unavailable",
                    message : "the peer you wanted to connect to is not available"
                };
                //Could also send close...
                io.sockets.connected[this.id].emit('wrapMsg', err);
                console.log(msg.sender + ' tried to send a message to ' + msg.receiver + ' which is not connected -> error');
            }
        });


        socket.on('id', function(msg){
            console.log('match deviceId ' + msg  + ' to socketioId ' + id);
            xdServer.peers[msg] = {
                'id': msg,
                'socketioId': this.id,
                'name': undefined,
                'role': undefined,
                'roles': [],
                'session': undefined,
                'connectedPeers' : []
            };
        });




    });



};



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