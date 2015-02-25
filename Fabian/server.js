var http = require('http');
var path = require('path');
var url = require('url');
var fs = require('fs');
var peer = require('peer');
var request = require('request');
var storageModule = require('./storage.js');

// FILESERVER
var static = require('node-static');
var file = new static.Server('./public');

http.createServer(function (request, response) {
    parameters = url.parse(request.url);

    fs.exists(__dirname + '/public' + parameters.pathname, function (exists) {
        if (exists) {
            request.addListener('end', function () {
                file.serve(request, response);
            }).resume();
        } else {
            response.setHeader("Content-Type", "text/html");
            response.write('<h1>404 - File not found</h1>');
            response.write(__dirname + '/public' + parameters.pathname);
            response.end();
        }
    });
}).listen(8081);


// PEERSERVER
var PeerServer = peer.PeerServer;
var pserver = new PeerServer({
    port: 9000,
    allow_discovery: true
});

pserver.on('connection', function (id) {
    console.info(id + " connected");
    peers[id] = {
        'id': id,
        'name': undefined,
        'role': undefined,
        'session': undefined
    };
});

pserver.on('disconnect', function (id) {
    console.info(id + " disconnected");

    if (peers[id].session !== undefined) {
        sessions[peers[id].session].peers.pop(id);
        if (sessions[peers[id].session].peers.length === 0) {
            // session has no more users -> delete it
            delete sessions[peers[id].session];
        }
    }
    delete peers[id];
});


// RICH PEERSERVER
var peers = {};
var sessions = {};

var XDServer = http.createServer(function (request, response) {
    parameters = url.parse(request.url, true);

    response.setHeader("Content-Type", "text/html");
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.statusCode = 200;

    if (parameters.query.listAllPeers != null) {
        // return list of all peers
        response.write('{"peers": ' + JSON.stringify(peers) + ', "sessions": ' + JSON.stringify(sessions) + '}');
        response.end();

    } else if (parameters.query.changeName != null && parameters.query.id != null && parameters.query.name != null) {
        // change name of peer
        peers[parameters.query.id].name = parameters.query.name;
        response.end();
        console.info("Changed name of " + parameters.query.id + " to " + peers[parameters.query.id].name);

    } else if (parameters.query.changeRole != null && parameters.query.id != null && parameters.query.role != null) {
        // change role of peer
        peers[parameters.query.id].role = parameters.query.role;
        response.end();
        console.info("Changed role of " + parameters.query.id + " to " + peers[parameters.query.id].role);

    } else if (parameters.query.joinSession != null && parameters.query.id != null && parameters.query.session != null) {
        // Join Session
        if (sessions[parameters.query.session] === undefined) {
            // New Session must be created
            sessions[parameters.query.session] = {
                'id': parameters.query.session,
                'peers': []
            };
            console.info('Session ' + parameters.query.session + ' created.');
        }

        if (sessions[parameters.query.session].peers.indexOf(parameters.query.id) === -1) {
            peers[parameters.query.id].session = parameters.query.session;
            sessions[parameters.query.session].peers.push(parameters.query.id);
            response.write('{"peers": ' + JSON.stringify(sessions[parameters.query.session]) + '}');
            console.info(parameters.query.id + ' joined Session ' + parameters.query.session + '.');
        }
        response.end();

        } else if (parameters.query.storeSession != null && parameters.query.id != null && parameters.query.sessionId != null && parameters.query.data != null) {
            // store session
            storageModule.storeSession(parameters.query.sessionId, parameters.query.id, parameters.query.role, parameters.query.name, parameters.query.data, response);

//            // Create sessionfile if not exists
//            fs.exists(__dirname + "/storage/" + parameters.query.sessionId + '.db', function (exists) {
//                if (!exists) {
//                    fs.writeFile(__dirname + "/storage/" + parameters.query.sessionId + '.db', '{}');
//                }
//
//                // Read out sessiondata
//                fs.readFile(__dirname + "/storage/" + parameters.query.sessionId + '.db', 'utf8', function (err, data) {
//                    if (err) {
//                        response.setHeader("Content-Type", "text/html");
//                        response.statusCode = 404;
//                        response.end();
//                        console.error("A storage error occurred.", err);
//                    } else {
//
//                        var file = {};
//                        if (data !== null && data !== undefined) {
//                            file = JSON.parse(data);
//                        }
//
//                        file[parameters.query.id] = {"role": parameters.query.role, "name": parameters.query.name, "data": JSON.parse(parameters.query.data)};
//
//                        // Write sessiondata back
//                        fs.writeFile(__dirname + "/storage/" + parameters.query.sessionId + '.db',
//                            JSON.stringify(file),
//                            function (err) {
//                                if (err) {
//                                    response.setHeader("Content-Type", "text/html");
//                                    response.statusCode = 404;
//                                    response.end();
//                                    console.error("A storage error occurred.", err);
//                                } else {
//                                    response.end();
//                                    console.info("Stored session " + parameters.query.sessionId + " of " + parameters.query.id + ".");
//                                }
//                            });
//                    }
//                });
//            });



    } else if (parameters.query.restoreSession != null && parameters.query.id != null && parameters.query.sessionId != null) {

//        // restore session
        storageModule.restoreSession(parameters.query.sessionId, parameters.query.id, response);
//        console.log('restore');
//        fs.readFile(__dirname + "/storage/" + parameters.query.sessionId + '.db', 'utf8', function (err, data) {
//            if (err) {
//                response.setHeader("Content-Type", "text/html");
//                response.statusCode = 404;
//                response.end();
//                console.error("A storage error occurred.", err);
//            }
//
//            var file = JSON.parse(data);
//            response.write(JSON.stringify({"peers": Object.keys(file), "data": file[parameters.query.id]}));
//            response.end();
//
//            console.info('Restored session ' + parameters.query.sessionId + ' for user ' + parameters.query.id + '.');
//
//        });
    } else {
        // someone tried to call a not supported method
        // answer with 404
        response.setHeader("Content-Type", "text/html");
        response.statusCode = 404;
        response.write('<h1>404 - File not found</h1>');
        response.write(__dirname + '/public' + parameters.pathname);
        response.end();
    }
});

XDServer.listen(9001);
