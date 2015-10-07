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

function XDEmitter () {
    this.callbackmap = {};
}

XDEmitter.prototype.on = function (event, callback) {

    if (!this.callbackmap[event]) {
        this.callbackmap[event] = [];
    }

    this.callbackmap[event].push(callback);
};

XDEmitter.prototype.emit = function (event) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (this.callbackmap[event]) {
        this.callbackmap[event].forEach(function(callback){
            callback.apply(this, args);
        });
    }
};