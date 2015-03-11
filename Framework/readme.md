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

Optionally, you may listen to the `objectChanged` event, if you have configured the client to send changes to the server.
Warning: The format of the `msg` parameter is likely to change the in the future.

```javascript
xdmvc.on("objectChanged", function(msg){
    console.log(msg);
    albums[msg.data.id].url = msg.data.cover;
});
```

## Client
Import the elements that you are going to use in the header.
```html
<link rel="import" href="bower_components/xdmvcclient/polymer/xdmvc-synchronised.html">
<link rel="import" href="bower_components/xdmvcclient/polymer/xdmvc-connection.html">
<link rel="import" href="bower_components/xdmvcclient/polymer/xdmvc-roles.html">
<link rel="import" href="bower_components/xdmvcclient/polymer/xdmvc-devices.html">
```


### Connecting to the server
None of the attributes are required.
If `reconnect` is set to `true`, the device will automatically try to reconnect to previously connected devices.
```html
<xdmvc-connection server="darroch.inf.ethz.ch" port="9000" ajaxPort="9001" reconnect="true"></xdmvc-connection>
```

### Specifying objects for synchronisation.
Each object must have an identifier (here gallery, cursors).
Only objects and arrays can be synchronised.
Currently, objects are transmitted as a whole, but for arrays there is a delta update mechanism.
```html
<xdmvc-synchronised id="sync"
               objects='{ "gallery": {"currentAlbum": -1, "currentImage": 0},
               "cursor" :{"x": 0, "y": 0}}'>
</xdmvc-synchronised>
```
If `updateServer` is set to `true`, changes to these object are send to the server and produce an `objectChanged` event.
```html
<xdmvc-synchronised id="persistent"
                    objects='{ "album": {"id":"", "cover": ""}}'
                    updateServer="true">
</xdmvc-synchronised>
```

### Example structure of an application
Wrap your application in a Polymer element.
```html
<html>
    <head>
        <!-- 1. Load platform support before any code that touches the DOM. -->
        <script src="bower_components/webcomponentsjs/webcomponents.js"></script>
        <!-- 2. Load the component using an HTML Import -->
        <link rel="import" href="bower_components/xdmvcclient/polymer/xdmvc-synchronised.html">
        <link rel="import" href="bower_components/xdmvcclient/polymer/xdmvc-connection.html">
        <link rel="import" href="bower_components/xdmvcclient/polymer/xdmvc-roles.html">
        <link rel="import" href="bower_components/xdmvcclient/polymer/xdmvc-devices.html">
        <meta name="viewport" content="width=device-width, user-scalable=no">
    </head>
    <body>
        <polymer-element name="my-app" >
            <template>
                <xdmvc-connection reconnect="true"></xdmvc-connection>
            </template>
        </polymer-element>

        <my-app></my-app>

    </body>
</html>
```