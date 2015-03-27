var map;
function initialize() {
    XDmvc.init();
    XDmvc.reconnect = true;
    XDmvc.connectToServer();

    var mapOptions = {
        zoom: 8,
        center: new google.maps.LatLng(-34.397, 150.644)
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    var center = {"lat": map.center.lat(), "lng": map.center.lng()}
    var zoom = {"level": map.getZoom()};
    var mapType = {"type" : map.getMapTypeId()};
    var bounds =   {"ne" : {"lat" : 0,
                            "lng" : 0},
                    "sw" : {"lat" : 0,
                            "lng" : 0}};
    var views = {};

    var setCenter = function setCenter(id, newcenter){
        center.lat = newcenter.lat;
        center.lng = newcenter.lng;
        map.setCenter(new google.maps.LatLng(newcenter.lat, newcenter.lng));
        XDmvc.discardChanges(id);
    };

    google.maps.event.addListener(map, 'center_changed', function() {
        center.lat = map.center.lat();
        center.lng = map.center.lng();
        console.log("center changed");
        console.log(center);
    });
    XDmvc.synchronize(center,setCenter ,"center");


    var setMapType = function setMapType(id, newmapType){
        map.setMapTypeId(newmapType.type);
        mapType.type = newmapType.type;
        XDmvc.discardChanges(id);
    };
    google.maps.event.addListener(map, 'maptypeid_changed', function() {
        mapType.type =  map.getMapTypeId();
    });
    XDmvc.synchronize(mapType,setMapType ,"mapType");

    var setZoom = function setZoom(id, newzoom){
        map.setZoom(newzoom.level);
        zoom.level = newzoom.level;
        XDmvc.discardChanges(id);
    };
    google.maps.event.addListener(map, 'zoom_changed', function() {
        zoom.level = map.getZoom();
        console.log("zoom changed " +zoom.level );
    });
    XDmvc.synchronize(zoom,setZoom ,"zoom");

    google.maps.event.addListener(map, 'bounds_changed', function() {
        var newbounds =   map.getBounds();
        bounds.ne.lat = newbounds.getNorthEast().lat();
        bounds.ne.lng = newbounds.getNorthEast().lng();
        bounds.sw.lat = newbounds.getSouthWest().lat();
        bounds.sw.lng = newbounds.getSouthWest().lng();
        XDmvc.forceUpdate("bounds");
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


    XDmvc.configureRole("center", ["center"]);
    XDmvc.configureRole("zoom", ["zoom"]);
    XDmvc.configureRole("mapType", ["mapType"]);
    XDmvc.configureRole("bounds", [{"bounds":showBounds}]);
}

google.maps.event.addDomListener(window, 'load', initialize);

