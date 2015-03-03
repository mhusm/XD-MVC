var util         = require("util");
var EventEmitter = require("events").EventEmitter;
var PeerServer = require('peer').PeerServer;
var connect = require('connect'),
    http = require('http'),
    bodyParser = require('body-parser');


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
    var app = connect().use(bodyParser.json()).use(this.handleAjaxRequest);
    var server = http.createServer(app);
    server.listen(port);
};

XDmvcServer.prototype.handleAjaxRequest = function(req, res, next){
    var parameters = url.parse(req.url, true);
    var query = parameters.query;

    res.setHeader("Content-Type", "text/json");
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.statusCode = 200;

    if (query.listAllPeers != null) {
        // return list of all peers
        res.write('{"peers": ' + JSON.stringify(this.peers) + ', "sessions": ' + JSON.stringify(this.sessions) + '}');
        res.end();

    } else if (query.changeName != null && query.id != null && query.name != null) {
        // change name of peer
        this.peers[query.id].name = query.name;
        res.end();
        console.info("Changed name of " + query.id + " to " + this.peers[query.id].name);

    } else if (query.changeRole != null && query.id != null && query.role != null) {
        // change role of peer
        //TODO support multiple roles per peer
        this.peers[query.id].role = query.role;
        res.end();
        console.info("Changed role of " + query.id + " to " + this.peers[query.id].role);


    } else if (query.addRole != null && query.id != null && query.role != null) {
        // add role to peer
        if (this.peers[query.id].roles.indexOf(query.role) === -1) {
            this.peers[query.id].roles.push(query.role);
        }
        res.end();
        console.info("Added role to " + query.id + ", role: " + this.peers[query.id].role);
    } else if (query.addRole != null && query.id != null && query.role != null) {
        // remove role from peer
        var index = this.peers[query.id].roles.indexOf(query.role);
        if (index > 0) {
            this.peers[query.id].roles.slice(index, 1);
        }
        res.end();
        console.info("Removed role of " + query.id + ", role: " + this.peers[query.id].role);

    } else if (query.joinSession != null && query.id != null && query.session != null) {
        // Join Session
        if (this.sessions[query.session] === undefined) {
            // New Session must be created
            this.sessions[query.session] = {
                'id': query.session,
                'peers': []
            };
            console.info('Session ' + query.session + ' created.');
        }

        if (this.sessions[query.session].peers.indexOf(query.id) === -1) {
            this.peers[query.id].session = query.session;
            this.sessions[query.session].peers.push(query.id);
            res.write('{"peers": ' + JSON.stringify(this.sessions[query.session]) + '}');
            console.info(query.id + ' joined Session ' + query.session + '.');
        }
        res.end();

    } else if (query.storeSession != null && query.id != null && query.sessionId != null && query.data != null) {
        // store session
        //TODO handle event based instead
        this.emit("store", query.sessionId, query.id, query.role, query.name, query.data, res);
  //      storageModule.storeSession(query.sessionId, query.id, query.role, query.name, query.data, res);

    } else if (query.restoreSession != null && query.id != null && query.sessionId != null) {
        //TODO handle event based instead
//        // restore session
        this.emit("restore", query.sessionId, query.id, res);
 //       storageModule.restoreSession(query.sessionId, query.id, res);
    } else if (query.objectChanged != null) {
        //TODO implement
        // TODO or maybe also implement a post request for this to a specified server on the client side
        this.emit("objectChanged");
    } else {
        // someone tried to call a not supported method
        // answer with 404
        res.setHeader("Content-Type", "text/html");
        res.statusCode = 404;
        res.write('<h1>404 - File not found</h1>');
        res.write(parameters.pathname);
        res.end();
    }
};

XDmvcServer.prototype.start = function(portPeer, portAjax) {
    this.startPeerSever(portPeer);
    if (portAjax > 0) {
        this.startAjaxServer(portAjax);
    }
};

module.exports = XDmvcServer;