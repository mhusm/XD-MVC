var XDmvcServer = require('xd-mvc/xdmvcserver.js');
var xdmvc = new XDmvcServer();

var connect = require('connect'),
    http = require('http'),
	serveStatic = require('serve-static');
var app = connect().use(serveStatic(__dirname + '/public'));
var server = http.createServer(app);

console.log('starting server');
xdmvc.start(7001, 3001, 9001);
server.listen(8081);


