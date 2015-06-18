
var nofMessages = 3000; //number of 'time messages' for each connected Device
var sleepInterval = 30; //interval between sending message to the same Device
var running = false;

function initialize() {
    /*
    Connection handling
     */
    XDmvc.init();
    XDmvc.reconnect = false;



    var arch = getQueryParams(window.location.search).architecture;
    if (!arch){
        var archString = 'architecture='+XDmvc.peerToPeer;
        window.history.pushState('', '', window.location.search.length > 0? window.location.search +"&" +archString : '?'+archString);
        XDmvc.setPeerToPeer();
    } else{
        if (arch ===  'p2p' || arch ===  XDmvc.peerToPeer) {
            XDmvc.setPeerToPeer();
            archString = 'architecture=' + XDmvc.peerToPeer;
            window.history.pushState('', '','?'+archString);
        } else {
            XDmvc.setClientServer();
            archString = 'architecture=' + XDmvc.clientServer;
            window.history.pushState('', '', '?'+archString);
        }
    }

    XDmvc.connectToServer(null, 7001, 3001,9001, null);

    $('#architecture').text(XDmvc.network_architecture);

    updateDevices();
    $("#myDeviceId").text(XDmvc.deviceId);
    $("#inputDeviceId").val(XDmvc.deviceId);

    $("#changeArchitecture").on("click", function(){
        if(XDmvc.isPeerToPeer()) {
            archString = 'architecture=' + XDmvc.clientServer;
            window.history.pushState('', '','?'+archString);
            location.reload(false);
        } else {
            archString = 'architecture=' + XDmvc.peerToPeer;
            window.history.pushState('', '','?'+archString);
            location.reload(false);
        }

        return false;
    });

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

    $("#sendFrequency").val(sleepInterval).change(function () {
        var v = $(this).val();
        if (v && !isNaN(+v)) {
            sleepInterval = +v;
            if (sleepInterval < 1) {
                sleepInterval = 1;
            } else if (sleepInterval > 2000) {
                sleepInterval = 2000;
            }
            $(this).val("" + sleepInterval);
        }
    });


    $("#runTest").on("click", function(){
        running = true;
        graph();
        runTests();
        return false;
    });

    $("#stopTest").on("click", function(){
        running = false;
        return false;
    });

    $("#downloadCSV").on("click", function(){
        running = false;
        XDmvc.connectedDevices.forEach(function (device) {
            createCSV(device.id);
        })
        return false;
    });

}

function runTests() {
    if(running) {
        for(var l= XDmvc.connectedDevices.length-1, i= l; i>-l; --i) {
            XDmvc.connectedDevices[i].send('time', {});
        }

        window.setTimeout(runTests, sleepInterval);
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

function createCSV(name) {
    var csvRows = [];
    var data = XDmvc.getConnectedDevice(name).timeStamps;
/*
    for(var i=0, l=data.length; i<l; ++i){
        csvRows.push(data[i].join(','));
    }*/

    var csvString = data.join(',');
    var a         = document.createElement('a');
    a.href        = 'data:attachment/csv,' + csvString;
    a.target      = '_blank';
    a.download    = name + '_out.csv';

    document.body.appendChild(a);
    a.click();
}





function graph(){

    var data = [],
        totalPoints = 300,
        maxY = 20,
        minY = 40;

    var colors = [];

    function getData() {

        var res = [];
        colors = [];
        var max = minY;
        XDmvc.connectedDevices.forEach(function(device) {
            var arr = device.timeStamps;
            var data = arr.slice(Math.max(arr.length - totalPoints, 0));
            var avgs = device.avg.slice(Math.max(device.avg.length - totalPoints, 0))
            // Zip the generated y values with the x values
            var resDevice = [];
            var avgDevice = [];
            var sum = 0;
            for (var i = 0; i < data.length; ++i) {
                var time = data[i][1];
                if( time > max)
                    max = time;
                resDevice.push([i, time]);
                sum += data[i][1];
            }

            var avg = sum / data.length;
            avgs.push(avg);
            // Zip the generated y values with the x values
            /*
            for (var i = 1; i < avgs.length; ++i) {
                avgDevice.push([i-1, avgs[i]]);
            }
            device.avg = avgs;
           // res.push({data: avgDevice, color: device.color});
            */
            maxY = max;
            res.push({data: resDevice, color: device.color, label:  Math.round(avg) + " ms"});
        });

        return res;
    }

    var options = {
        series: {
            shadowSize: 0	// Drawing is faster without shadows
        },
        yaxis: {
            min: 0
        },
        xaxis: {
            show: false
        }
    }

    var plot = $.plot("#graph",  getData() , options );

    $(window).resize(function() {
        plot = $.plot("#graph",  getData() , options );
    });

    function update() {

        plot.setData(getData());
        plot.getAxes().yaxis.options.max = maxY;
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