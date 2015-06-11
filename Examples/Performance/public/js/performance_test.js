var map;
function initialize() {
    /*
    Connection handling
     */
    XDmvc.init();
    XDmvc.reconnect = false;
    XDmvc.setClientServer();
    XDmvc.connectToServer();
    updateDevices();
    $("#myDeviceId").text(XDmvc.deviceId);
    $("#inputDeviceId").val(XDmvc.deviceId);


    $("#showDevices").on("click", function(){
        updateDevices();
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

    document.addEventListener('XDConnection', function(event){
        addConnectedDevices()
    });
    document.addEventListener('XDdevice', function(event){
        updateDevices();
    });


    /*
    Time measurement
     */
    var nofMessages = 1; //number of time messages for each connected Device
    var sleepIntervall = 500; //intervall between sending message to a Device

    $("#runTest").on("click", function(){
        for(var i = 0; i < nofMessages; i++) {
            window.setTimeout(runTests, sleepIntervall*i);
        }
        return false;
    });

}

function runTests() {
    XDmvc.connectedDevices.forEach(function(device) {
        device.send('time', {});
    });
}

function updateDevices() {
    XDmvc.server.requestAvailableDevices();
    window.setTimeout(addAvailableDevices, 1000);
    window.setTimeout(addConnectedDevices, 1000);
}

function addAvailableDevices() {
    // list container
    var listContainer = $('#availableDeviceList');
    listContainer.empty();
    for (var i=0; i<XDmvc.availableDevices.length; i++) {
        var dev = XDmvc.availableDevices[i];
        listContainer.prepend('<a href="#" class="list-group-item">'+dev.id+'</a>');
    }
    // add onclick listener
    $("#availableDeviceList a").click(function() {
        XDmvc.connectTo($(this).text());
        $(this).remove();
    });
}

function addConnectedDevices() {
    // list container
    var listContainer = $('#connectedDeviceList');
    listContainer.empty();
    for (var i=0; i<XDmvc.connectedDevices.length; i++) {
        var dev = XDmvc.connectedDevices[i];
        listContainer.prepend('<li class="list-group-item">'+dev.id+'</li>');
    }
}

document.addEventListener("DOMContentLoaded", function(event) {
    initialize();
});