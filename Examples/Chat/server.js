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
var xdmvc = new XDmvcServer();

var connect = require('connect'),
    http = require('http'),
	serveStatic = require('serve-static');
var app = connect().use(serveStatic(__dirname + '/public'));
var server = http.createServer(app);

xdmvc.start();
server.listen(8080);


