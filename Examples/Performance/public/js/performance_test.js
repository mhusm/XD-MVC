var map;
function initialize() {
    XDmvc.init();
    XDmvc.reconnect = false;
    XDmvc.setClientServer();
    XDmvc.connectToServer();
    showAvailableDevices();
    $("#myDeviceId").text(XDmvc.deviceId);
    $("#inputDeviceId").val(XDmvc.deviceId);


    $("#showDevices").on("click", function(){
        showAvailableDevices();
        return false;
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
}

function showAvailableDevices() {
    XDmvc.server.requestAvailableDevices();
    window.setTimeout(addDevices, 1000);
    addDevices();
}

function addDevices() {
    // list container
    var listContainer = $('#deviceList');
    listContainer.empty();
    for (var i=0; i<XDmvc.availableDevices.length; i++) {
        var dev = XDmvc.availableDevices[i];
        listContainer.prepend('<a href="#" class="list-group-item">'+dev.id+'</a>');
    }
    // add onclick listener
    $("#deviceList a").click(function() {
        XDmvc.connectTo($(this).text());
        $(this).remove();
    });
}

document.addEventListener("DOMContentLoaded", function(event) {
    initialize();
});