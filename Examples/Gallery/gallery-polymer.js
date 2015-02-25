var xdserver = require('./xdserver.js');
xdserver.start(9000);

var connect = require('connect'),
    http = require('http'),
	bodyParser = require('body-parser'),
	serveStatic = require('serve-static'); 
  
var url = require('url');

var app = connect().use(bodyParser.json()).use(serveStatic(__dirname + '/public'));
//var app = connect().use(bodyParser.urlencoded({ extended: false, type:'application/json'  })).use(serveStatic(__dirname + '/public'));
var server = http.createServer(app);
var fs = require('fs');
var basePath = "\public\\polymer\\images";
var transient = {};
var persistent = {};

// TODO extract transient and persistent stuff into framework


function handleGallery(req, res) {
    var query = url.parse(req.url, true).query;
    console.log(req.body);
	
    if (query.album) {
        setCurrentAlbum(query.album);
    }
    if (req.body.changed) {
        persistent = req.body.changed;
        console.log(persistent);
		console.log("changed");
    }
    
	res.writeHead(200, {'Content-Type': 'text/json' });
	res.write(JSON.stringify({transient: transient, persistent: persistent}));
	res.end('\n');
}

function createModel() {
	var files = fs.readdirSync(basePath),
        thumbs,
        albums = [],
        album,
        currentAlbum = "";
    
    
    files.forEach(function (file) {
	    thumbs = fs.readdirSync(basePath + "\\" + file + "\\thumbs");
        album = {title: file, url: "images/" + file + "/thumbs/" + thumbs[0]};
        albums.push(album);
    });
    if (files.length > 0) {
        currentAlbum = albums[0].title;
    }
     
    createAlbumModel(currentAlbum);
    persistent.albums = albums;
    transient.currentAlbum = currentAlbum;
    
}

function setCurrentAlbum(newAlbum) {
    createAlbumModel(newAlbum);
 //   transient.currentAlbum = newAlbum;
   
}

function createAlbumModel(title) {
	var files = fs.readdirSync(basePath + "\\" + title + "\\thumbs");
    var largePath = "images/" + title + "/large/";
    var thumbsPath = "images/" + title + "/thumbs/";
	// Read images from directory
	persistent.thumbs = files.map(function (f) {
		return thumbsPath + f;
	});
	persistent.large = files.map(function (f) {
		return largePath + f;
	});
    transient.current = 0;
 
   
}

app.use("/gallery", handleGallery);

createModel();
server.listen(8082);


