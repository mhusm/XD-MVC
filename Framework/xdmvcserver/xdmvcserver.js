var util         = require("util");
var EventEmitter = require("events").EventEmitter;
var PeerServer = require('peer').PeerServer;
var connect = require('connect'),
    http = require('http'),
    bodyParser = require('body-parser'),
    url = require('url');


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
}
util.inherits(XDmvcServer, EventEmitter);

XDmvcServer.prototype.startPeerSever = function(port){
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