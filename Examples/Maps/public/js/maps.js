/*
 * XD-MVC -- A framework for cross-device applications
 * Copyright (C) 2014-2015 Maria Husmann. All rights reserved.
 *
 * XD-MVC is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * XD-MVC is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with XD-MVC. If not, see <http://www.gnu.org/licenses/>.
 *
 * See the README and LICENSE files for further information.
 *
 */

var map;
var views = {};
function initialize() {
    (function () {
        function CustomEvent ( event, params ) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent( 'CustomEvent' );
            evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
            return evt;
        }

        CustomEvent.prototype = window.Event.prototype;
        window.CustomEvent = CustomEvent;
    })();
    XDmvc.init();
    XDmvc.reconnect = false;
    XDmvc.connectToServer(undefined, 9010, 3010, 9011 );
    XDmvc.on("XDserverReady", function(){
        $("#myDeviceId").text(XDmvc.deviceId);
        $("#inputDeviceId").val(XDmvc.deviceId);
    });
    XDmvc.removeRole("sync-all");
    XDmvc.addRole("mirror");

    XDmvc.on('XDdisconnection', function(device){
        if (XDmvc.hasRole("overview")) {
            views[device.id].setMap(null);
            delete views[device.id];
        }
    });


    var mapOptions = {
        zoom: 8,
        center: new google.maps.LatLng(-34.397, 150.644)
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    var center = {"lat": map.center.lat(), "lng": map.center.lng()};
    var zoom = {"level": map.getZoom()};
    var mapType = {"type" : map.getMapTypeId()};
    var bounds =   {"ne" : {"lat" : 0,
                            "lng" : 0},
                    "sw" : {"lat" : 0,
                            "lng" : 0}};

    var setCenter = function setCenter(id, newcenter){
        center.lat = Math.round10(newcenter.lat, -10);
        center.lng = Math.round10(newcenter.lng, -10);
        XDmvc.discardChanges(id);
        map.setCenter(new google.maps.LatLng(newcenter.lat, newcenter.lng));
        XDmvc.discardChanges(id);
    };

    google.maps.event.addListener(map, 'center_changed', function() {
        center.lat = Math.round10(map.center.lat(), -10);
        center.lng =  Math.round10(map.center.lng(), -10);
        Platform.performMicrotaskCheckpoint();
    });
    XDmvc.synchronize(center,setCenter ,"center");


    var setMapType = function setMapType(id, newmapType){
        mapType.type = newmapType.type;
        XDmvc.discardChanges(id);
        map.setMapTypeId(newmapType.type);
        XDmvc.discardChanges(id);
    };
    google.maps.event.addListener(map, 'maptypeid_changed', function() {
        mapType.type =  map.getMapTypeId();
        Platform.performMicrotaskCheckpoint();
    });
    XDmvc.synchronize(mapType,setMapType ,"mapType");

    var setZoom = function setZoom(id, newzoom){
        zoom.level = newzoom.level;
        XDmvc.discardChanges(id);
        map.setZoom(newzoom.level);
        XDmvc.discardChanges(id);
    };
    google.maps.event.addListener(map, 'zoom_changed', function() {
        zoom.level = map.getZoom();
        Platform.performMicrotaskCheckpoint();
    });
    XDmvc.synchronize(zoom,setZoom ,"zoom");

    google.maps.event.addListener(map, 'bounds_changed', function() {
        var newbounds =   map.getBounds();
        bounds.ne.lat = newbounds.getNorthEast().lat();
        bounds.ne.lng = newbounds.getNorthEast().lng();
        bounds.sw.lat = newbounds.getSouthWest().lat();
        bounds.sw.lng = newbounds.getSouthWest().lng();
        XDmvc.forceUpdate("bounds");
        Platform.performMicrotaskCheckpoint();
     });
    XDmvc.synchronize(bounds, undefined ,"bounds");

    var showBounds = function showBounds(id, data, sender){
        if(views[sender] === undefined) {
            views[sender] = new google.maps.Rectangle({
                strokeColor: '#' + (parseInt(parseInt(sender, 36).toExponential().slice(2,-5), 10) & 0xFFFFFF).toString(16).toUpperCase(),
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#' + (parseInt(parseInt(sender, 36).toExponential().slice(2,-5), 10) & 0xFFFFFF).toString(16).toUpperCase(),
                fillOpacity: 0.1,
                map: map,
                bounds: new google.maps.LatLngBounds(
                    new google.maps.LatLng(data.sw.lat, data.sw.lng),
                    new google.maps.LatLng(data.ne.lat, data.ne.lng)
                )
            });
        } else {
            views[sender].setBounds(new google.maps.LatLngBounds(
                new google.maps.LatLng(data.sw.lat, data.sw.lng),
                new google.maps.LatLng(data.ne.lat, data.ne.lng)));
        }
    };

    var mirrorZoom = function mirrorZoom(id, data, sender){
        if (XDmvc.getConnectedDevice(sender).roles.indexOf("mirror") > -1){
            setZoom(id, data);
        }
    };

    var mirrorCenter = function mirrorCenter(id, data, sender){
        if (XDmvc.getConnectedDevice(sender).roles.indexOf("mirror") > -1){
            setCenter(id, data);
        }
    };


    XDmvc.configureRole("mirror", [{"center":mirrorCenter}, {"zoom":mirrorZoom}]);
    XDmvc.configureRole("viewer", []);
    XDmvc.configureRole("all", ["center", "mapType", "zoom", "bounds"]);
    XDmvc.configureRole("overview", [{"bounds":showBounds}]);

    $("#menu-button").on("click", function(){
        $("#menu").toggle();
    });

    $("#changeId").on("click", function(){
        $("#deviceId").toggle();
        $("#deviceId").removeClass("has-error");
        return false;
    });


    $("#deviceIdButton").on("click", function(){
        var newId = $("#inputDeviceId").val();
        if (newId) {
            XDmvc.changeDeviceId(newId);
            $("#deviceId").toggle();
            $("#myDeviceId").text(XDmvc.deviceId);
        } else {
            $("#deviceId").addClass("has-error");
        }
        return false;
    });

    $("#connect").on("click", function(){
        var otherDevice = $("#inputOtherDevice").val();
        if (otherDevice) {
            XDmvc.connectTo(otherDevice);
        } else {
            $("#inputOtherDevice").addClass("has-error");
        }
        return false;
    });

    $("#roles input:radio").on("change", function(event){
        var role = event.target.value;
        var old = XDmvc.roles[0];
        XDmvc.removeRole(old);
        XDmvc.addRole(role);
        if (old  === "overview") {
            Object.keys(views).forEach(function(key){
                views[key].setMap(null);
            });
            views = {};
        }
    });

    $("#showDevices").on("click", function(){
        updateDevices();
        return false;
    });

    updateDevices();

    XDmvc.on('XDconnection', function(event){
        updateDevices();
    });
    XDmvc.on('XDdisconnection', function(event){
        updateDevices();
    });

}

function updateDevices() {
//TODO
//    XDmvc.server.requestAvailableDevices();
    window.setTimeout(addAvailableDevices, 1000);
    window.setTimeout(addConnectedDevices, 1000);
}

function addAvailableDevices() {
    // list container
    var listContainer = $('#availableDeviceList');
    listContainer.empty();
    var devices = XDmvc.getAvailableDevices();
    for (var i=0; i<devices.length; i++) {
        var dev = devices[i];
        var availableConnections = '  (' + (dev.usesPeerJs ? 'peerJS':'') + ' / ' + (dev.usesSocketIo ? 'socketIo': '') + ')';
        listContainer.prepend('<a href="#" class="list-group-item"> <p class="id">'+dev.id + '</p><p><small>' +  availableConnections + '</small></p></a>');
    }
    // add onclick listener
    $("#availableDeviceList a").click(function() {
        XDmvc.connectTo($(this).find('.id').text());
        $(this).remove();
    });
}

function addConnectedDevices() {
    // list container
    var listContainer = $('#connectedDeviceList');
    listContainer.empty();
    var devices = XDmvc.getConnectedDevices();
    var length = devices.length;
    for (var i=0; i<length; i++) {
        var dev = devices[i];
        var usesSocketIo = dev.connection instanceof VirtualConnection;
        var connString = ' (' + (usesSocketIo ? 'socketIO':'peerJS') + ')';
        listContainer.prepend('<li class="list-group-item" id='+dev.id+'>' + dev.id + connString + '</li>');
    }
    //style the buttons
    for (var i=0; i<length; i++) {
        var dev = devices[i];
        var usesSocketIo = dev.connection instanceof VirtualConnection;
        var color = usesSocketIo ? 'orange':'yellow'
        $('#'+dev.id).css('background-color', color );
    }
}

document.addEventListener("DOMContentLoaded", initialize);


// Rounding numbers. Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round
// Closure
(function() {
    /**
     * Decimal adjustment of a number.
     *
     * @param {String}  type  The type of adjustment.
     * @param {Number}  value The number.
     * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
     * @returns {Number} The adjusted value.
     */
    function decimalAdjust(type, value, exp) {
        // If the exp is undefined or zero...
        if (typeof exp === 'undefined' || +exp === 0) {
            return Math[type](value);
        }
        value = +value;
        exp = +exp;
        // If the value is not a number or the exp is not an integer...
        if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
            return NaN;
        }
        // Shift
        value = value.toString().split('e');
        value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
        // Shift back
        value = value.toString().split('e');
        return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
    }

    // Decimal round
    if (!Math.round10) {
        Math.round10 = function(value, exp) {
            return decimalAdjust('round', value, exp);
        };
    }
    // Decimal floor
    if (!Math.floor10) {
        Math.floor10 = function(value, exp) {
            return decimalAdjust('floor', value, exp);
        };
    }
    // Decimal ceil
    if (!Math.ceil10) {
        Math.ceil10 = function(value, exp) {
            return decimalAdjust('ceil', value, exp);
        };
    }
})();
//google.maps.event.addDomListener(window, 'load', initialize);
