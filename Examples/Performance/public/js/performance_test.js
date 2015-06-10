var map;
function initialize() {
    XDmvc.init();
    XDmvc.reconnect = false;
    XDmvc.setClientServer();
    XDmvc.connectToServer();
    $("#myDeviceId").text(XDmvc.deviceId);
    $("#inputDeviceId").val(XDmvc.deviceId);



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


}

document.addEventListener("DOMContentLoaded", function(event) {
    initialize();
});