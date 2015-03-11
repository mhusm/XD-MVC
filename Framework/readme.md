# Cross-device MVC


## Instructions
Please look at the examples for more details on usage.

## Server

Add the XD-MVC server to your Node.js project.
```javascript
var XDmvcServer = require('xd-mvc/xdmvcserver.js');
var xdmvc = new XDmvcServer();
```

Start the server. You can specify two ports. The first is for the peerJS server, the second for an Ajax connection.
If no ports are specified, 9000 and 9001 are used as defaults.
```javascript
xdmvc.start(9000, 9001);
```

