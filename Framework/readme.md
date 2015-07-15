# Cross-device MVC

Here is a quick introduction to the framework using [Polymer](http://www.polymer-project.org). Please look at the examples for more details on usage. 
If you don't want to use Polymer, look at the maps example.

## Server

Add the XD-MVC server to your Node.js project.

```javascript
var XDmvcServer = require('xd-mvc/xdmvcserver.js');
var xdmvc = new XDmvcServer();
```

Start the server. You can specify two ports. 
The first is for the peerJS server, the second for Socket.io and the third for an Ajax connection.
If no ports are specified, 9000, 3000, and 9001 are used as defaults.

```javascript
xdmvc.start(9000, 3000, 9001);
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
<xdmvc-connection server="darroch.inf.ethz.ch" socketport="3000" ajaxPort="9001" reconnect="true" architecture="client-server"></xdmvc-connection>
```

### Specifying objects for synchronisation.
Each object must have an identifier (here gallery, cursors).
Only objects and arrays can be synchronised.
If you want to synchronise atomic values such as strings or integers warp them in an object.
Define your objects as properties in Polymer.
```javascript
properties: {
    synced: {
        type: Object,
        value: function(){ return { "gallery": {"currentAlbum": -1, "currentImage": 0},
            "cursor" :{"x": -1, "y": -1}} } ,
        notify: true
    },
    persisted: {
        type: Object,
        value: function(){ return { "album": {"id":"", "cover": ""}}} ,
        notify: true
    },
}
```

```html
<xdmvc-synchronised id="sync"
               objects='{{synced}}'>
</xdmvc-synchronised>
```
If `updateServer` is set to `true`, changes to these object are send to the server and produce an `objectChanged` event.
```html
<xdmvc-synchronised id="persistent"
                    objects='{{persisted}}'
                    update-server="true">
</xdmvc-synchronised>
```

Use the specified objects in your elements.
```html
<gallery-overview id='overview'
                  current-album="{{synced.gallery.currentAlbum}}">
</gallery-overview>
<gallery-element id='gallery'
                 images="{{getAlbums(albums, synced.gallery.currentAlbum)}}"
                 current="{{synced.gallery.currentImage}}"
                 on-image="imageClicked" >
</gallery-element>
```

### Roles
Define the roles of the system. Roles can be preselected.
```html
<xdmvc-roles id="roles"
             available='["owner", "visitor", "albums", "album", "image"]'
             select='["albums"]'
             roles='{{roles}}'>
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
this.albumsVisible = this.roles.isselected.albums &&  !this.roles.isselected.visitor;
```

Roles of connected devices can also be queried. A number indicates how many devices in the system (not including self) have given role.
```javascript
this.roles.othersRoles.albums > 0
```


### Devices
Similarly to the roles, you can query the devices. Add the devices element to your application.
```html
<xdmvc-devices id="devices" devices="{{devices}}"></xdmvc-devices>
```

Query the current device and connected devices. Currently there are four device types: small, medium, large, and xlarge.
The categorisation of the devices depends on device independent pixels at the moment.
Unfortunately, it is not possible to detect physical screen size. We plan to support capabilities such as touch in the future.
```javascript
if (this.devices.thisDevice.type === "small" && this.devices.othersDevices.large > 0) {
    // do something
}
```

### Distributing the UI
Use the role and device query mechanism to adapt your UI by binding to conditional templates.

```html
<template is="dom-if" if="{{roles.isselected.owner}}">
    <input is="core-input" type="file" multiple accept="image/*" on-change="handleFiles"  label="Choose photos"/>
    <gallery-element id='gallery'
                     images="{{synced.images}}"
                     current="{{synced.current.index}}">
    </gallery-element>
</template>
```

Note that anything in the template will not be loaded if the query evaluates to `false`. Alternatively, you can bind to the `hidden` attribute.
This will load the code and run the associated scripts, but not show the element.
```html
<button on-click="{{showAlbum}}"
        hidden$="{{!$.roles.isselected.owner}}">
    Back to Album
</button>
```

With version 1.0 expressions in data binding were removed from Polymer. If you want more complex rules for UI distribution, you need to use computed bindings.
Have a look at the gallery for some examples.

