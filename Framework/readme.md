# Cross-device MVC

Here is a quick introduction to the framework. Please look at the examples for more details on usage.

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
None of the attributes are required as there are defaults that match the server-side component.
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

Use the specified objects in your elements.
```html
<gallery-overview id='overview'
                   currentAlbum="{{$.sync.objects.gallery.currentAlbum}}"
                   albums="{{albums}}">
</gallery-overview>
<gallery-element id='gallery'
                  images="{{albums[$.sync.objects.gallery.currentAlbum].thumbs}}"
                  current="{{$.sync.objects.gallery.currentImage}}"
                  on-image="{{imageClicked}}"/>
```

### Roles
Define the roles of the system. Roles can be preselected.
```html
<xdmvc-roles id="roles"
             roles="['owner', 'visitor', 'albums', 'album', 'image']"
             selected="['albums']">
</xdmvc-roles>
```

Roles can be add and removed to the current device dynamically. For example, in an event handler.
```javascript
albumClicked: function() {
    this.$.roles.removeRole('albums');
    this.$.roles.addRole('album');
}
```

Roles of the current device can be queried.
```javascript
this.albumsVisible = this.$.roles.isselected.albums &&  !this.$.roles.isselected.visitor;
```

Roles of connected devices can also be queried. A number indicates how many devices in the system (not including self) have given role.
```javascript
this.$.roles.othersRoles.albums > 0
```


### Devices
Similarly to the roles, you can query the devices. Add the devices element to your application.
```html
<xdmvc-devices id="devices"></xdmvc-devices>
```

Query the current device and connected devices
```javascript
if (devices.device.type === "small" && devices.othersDevices.large > 0) {
    // do something
}
```

### Distributing the UI
Use the role and device query mechanism to adapt your UI by binding to conditional templates.

```html
<template bind if="{{$.roles.isselected.owner}}">
    <input type="file" multiple accept="image/*" on-change="{{handleFiles}}"/>
    <gallery-element id='gallery'
                     images="{{$.sync.objects.images}}"
                     current="{{$.sync.objects.current.index}}">
    </gallery-element>
</template>
```

Note that anything in the template will not be loaded if the query evaluates to `false`. Alternatively, you can bind to the `hidden` attribute.
This will load the code and run the associated scripts, but not show the element.
```html
<button on-click="{{showAlbum}}"
        hidden?="{{!$.roles.isselected.owner}}">
    Back to Album
</button>
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
                <xdmvc-synchronised id="sync"
                                     objects='{"current": { "index":0}, "images": [],
                                "cursor" :{"x": 0, "y": 0}}'>
                </xdmvc-synchronised>
                <xdmvc-roles id="roles"
                          roles="['owner', 'visitor', 'album', 'image']"
                          selected="['album']">
                </xdmvc-roles>
                <xdmvc-devices id="devices"></xdmvc-devices>

                <template bind if="{{$.roles.isselected.owner}}">
                    <input type="file" multiple accept="image/*" on-change="{{handleFiles}}"/>
                    <gallery-element id='gallery'
                                  images="{{$.sync.objects.images}}"
                                  current="{{$.sync.objects.current.index}}">
                    </gallery-element>
                </template>
                <template bind if="{{!($.roles.isselected.owner && $.devices.othersDevices.large > 0)}}">
                    <image-element images="{{$.sync.objects.images}}"
                                 current="{{$.sync.objects.current.index}}"
                                 cursor="{{$.sync.objects.cursor}}"
                                 showControls="{{$.roles.isselected.owner}}"></image-element>
                </template>

           </template>
        </polymer-element>

        <my-app></my-app>

    </body>
</html>
```