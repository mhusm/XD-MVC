

var nofMessages = 3000; //number of 'time messages' for each connected Device
var sleepInterval = 30; //interval between sending message to the same Device
var running = false;

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


    $("#runTest").on("click", function(){
        running = true;
        for(var i = 0; i < nofMessages; i++) {
            window.setTimeout(runTests, sleepInterval*i);
        }
        graph();
        return false;
    });

    $("#stopTest").on("click", function(){
        running = false;
        return false;
    });

}

function runTests() {
    if(running) {
        XDmvc.connectedDevices.forEach(function(device) {
            device.send('time', {});
        });
    }
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
    var length = XDmvc.connectedDevices.length;
    var colors = evenColors(length);
    for (var i=0; i<length; i++) {
        var dev = XDmvc.connectedDevices[i];
        // initialize array for averages
        dev.avg = [];
        //set color
        dev.color = colors[i];
        listContainer.prepend('<li class="list-group-item" id='+dev.id+'>'+dev.id+'</li>');
    }
    //style the buttons
    for (var i=0; i<length; i++) {
        var dev = XDmvc.connectedDevices[i];
        $('#'+dev.id).css('background-color', dev.color);
    }

}

document.addEventListener("DOMContentLoaded", function(event) {
    initialize();
});



function graph(){

    var data = [],
        totalPoints = 300;

    var colors = [];

    function getData() {

        var res = [];
        colors = [];
        XDmvc.connectedDevices.forEach(function(device) {
            var arr = device.timeStamps;
            var data = arr.slice(Math.max(arr.length - totalPoints, 0));
            var avgs = device.avg.slice(Math.max(device.avg.length - totalPoints, 0))
            // Zip the generated y values with the x values
            var resDevice = [];
          //  var avgDevice = [];
          //  var sum = 0;
            for (var i = 0; i < data.length; ++i) {
                resDevice.push([i, data[i]]);
              //  sum += data[i];
            }
            /*
            var avg = sum / data.length;
            avgs.push(avg);
            for (var i = 1; i < avgs.length; ++i) {
                avgDevice.push([i-1, avgs[i]]);
            }
            device.avg = avgs;
            res.push({data: avgDevice, color: device.color});
            */
            res.push({data: resDevice, color: device.color});
        });

        return res;
    }

    var plot = $.plot("#graph",  getData() , {
        series: {
            shadowSize: 0	// Drawing is faster without shadows
        },
        yaxis: {
            min: 0,
            max: 100
        },
        xaxis: {
            show: false
        }
    });

    function update() {

        plot.setData(getData());

        // Since the axes don't change, we don't need to call plot.setupGrid()
        plot.setupGrid();
        plot.draw();
        if(running)
            setTimeout(update, sleepInterval);
    }

    update();
}

/*
    Color settings
 */
function evenColors(total)
{
    var i = 360 / (total); // distribute the colors evenly on the hue range, don't start with 0
    var r = []; // hold the generated colors
    for (var x=1; x<=total; x++)
    {
        r.push(hsvToRgb(i * x, 100, 100)); // you can also alternate the saturation and value for even more contrast between the colors
    }
    return r;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

//http://snipplr.com/view/14590/hsv-to-rgb/
function hsvToRgb(h, s, v) {
    var r, g, b;
    var i;
    var f, p, q, t;

    s /= 100;
    v /= 100;

    h /= 60; // sector 0 to 5
    i = Math.floor(h);
    f = h - i; // factorial part of h
    p = v * (1 - s);
    q = v * (1 - s * f);
    t = v * (1 - s * (1 - f));

    switch(i) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;

        case 1:
            r = q;
            g = v;
            b = p;
            break;

        case 2:
            r = p;
            g = v;
            b = t;
            break;

        case 3:
            r = p;
            g = q;
            b = v;
            break;

        case 4:
            r = t;
            g = p;
            b = v;
            break;

        default: // case 5:
            r = v;
            g = p;
            b = q;
    }

    return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}