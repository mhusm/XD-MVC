var XDmvcServer = require('xd-mvc/xdmvcserver.js');
var xdmvc = new XDmvcServer();

var connect = require('connect'),
    http = require('http'),
	bodyParser = require('body-parser'),
	serveStatic = require('serve-static');

var url = require('url');

var app = connect().use(bodyParser.json()).use(serveStatic(__dirname + '/public'));
app.use("/gallery", handleGallery);

var server = http.createServer(app);
var fs = require('fs');
var basePath = "\public\\images";
var albums = [];

function createModel() {
    var files = fs.readdirSync(basePath),
        thumbs,
        album;

    files.forEach(function (file) {
        thumbs = fs.readdirSync(basePath + "\\" + file + "\\thumbs");
        album = {title: file, url: "images/" + file + "/thumbs/" + thumbs[0]};
        albums.push(album);
    });

    albums.forEach(function(album){
        var title = album.title;
        var files = fs.readdirSync(basePath + "\\" + title + "\\thumbs");
        var largePath = "images/" + title + "/large/";
        var thumbsPath = "images/" + title + "/thumbs/";
        // Read images from directory
        album.thumbs = files.map(function (f) {
            return thumbsPath + f;
        });
        album.large = files.map(function (f) {
            return largePath + f;
        });
    });

    console.log(albums);
 }

function handleGallery(req, res, next){
    var parsedUrl = url.parse(req.url, true)
    var query = parsedUrl.query;
    var path = parsedUrl.pathname.split("/");
    res.setHeader('Access-Control-Allow-Origin', '*')

    if (path.length === 2 && path[1].length ===0){
        res.writeHead(200, {'Content-Type': 'text/json' });
        res.write(JSON.stringify(albums));
        res.end('\n');
    }

}

createModel();
xdmvc.start(9000, 9001);
xdmvc.on("objectChanged", function(msg){
    console.log(msg);
    albums[msg.data.id].url = msg.data.cover;
});

server.listen(8082);


