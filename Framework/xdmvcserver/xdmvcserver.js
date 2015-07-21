var util         = require("util");
var EventEmitter = require("events").EventEmitter;
var PeerServer = require('peer').PeerServer;
var connect = require('connect'),
    http = require('http'),
    bodyParser = require('body-parser'),
    url = require('url');

//for socketIo
var io =  require('socket.io')();

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

    //Start the PeerJS Server
    var pserver = new PeerServer({
        port: port,
        allow_discovery: true
    });
    var that = this;

    pserver.on('connection', function(id) {
        that.peers[id] = {
            'id': id,
            'name': undefined,
            'role': undefined,
            'roles': [],
            'session': undefined
        };
        that.emit("connected", id);
    });

    pserver.on('disconnect', function(id) {
        if (that.peers[id].session !== undefined) {
            var ps = that.sessions[that.peers[id].session].peers;
            var index = ps.indexOf(id);
            if (index > -1) {
                ps.splice(index, 1);
            }

            if (ps.length === 0) {
                // session has no more users -> delete it
                delete that.sessions[that.peers[id].session];
            }
        }
        delete that.peers[id];
        that.emit("disconnected", id);
    });
};

XDmvcServer.prototype.startSocketIoServer = function startSocketIoServer(port) {

    //Start the Socketio Server
    io.listen(port);

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
                console.log('user '+ deviceId + ' disconnected --> server sent close event to connected peers: ' + connPeers);
            } else
                console.log('peer was not in peers --> TODO:check logic');

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
                console.log(msg.sender + ' tries to connect to ' + msg.receiver + ' : failed ! (peer not available)');
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
};

XDmvcServer.prototype.start = function(portPeer, portSocketIo, portAjax) {
    portPeer = portPeer? portPeer : 9000;
    portAjax = portAjax? portAjax : 9001;
    portSocketIo = portSocketIo? portSocketIo : 3000;

    this.startPeerSever(portPeer);
    this.startSocketIoServer(portSocketIo);
    this.startAjaxServer(portAjax);
};

module.exports = XDmvcServer;