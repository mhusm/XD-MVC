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

var XDmvcServer = require('xd-mvc/xdmvcserver.js');
var path = require('path');
var xdmvc = new XDmvcServer();

var connect = require('connect'),
    http = require('http'),
	bodyParser = require('body-parser'),
	serveStatic = require('serve-static');

var url = require('url');

var app = connect().use(bodyParser.json()).use(serveStatic(path.join(__dirname, 'public')));
app.use("/gallery", handleGallery);

var server = http.createServer(app);
var fs = require('fs');
var basePath = path.join('public', 'images');
var albums = [];

function createModel() {
    var files = fs.readdirSync(basePath),
        thumbs,
        album;

    files.forEach(function (file) {
        thumbs = fs.readdirSync(path.join(basePath, file, 'thumbs'));
        album = {title: file, url: "images/" + file + "/thumbs/" + thumbs[0]};
        albums.push(album);
    });

    albums.forEach(function(album){
        var title = album.title;
        var files = fs.readdirSync(path.join(basePath, title, 'thumbs'));
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
xdmvc.start(9000, 3001, 9001);
xdmvc.on("objectChanged", function(msg){
    console.log(msg);
    albums[msg.data.id].url = msg.data.cover;
});

server.listen(8082);


