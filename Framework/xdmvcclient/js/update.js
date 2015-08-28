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

function synchronizeObject(path, original, owner, callback){
    var observer = new ObjectObserver(original);
    var key;
    observer.open(function(added, removed, changed){
        // Deleted properties
        for (key in removed) {
            owner.set(path+"." +key, undefined);
        }
        // New and changed properties
        for (key in changed) {
            owner.set(path+"." +key, changed[key]);
        }
        for (key in added) {
            owner.set(path+"." +key, added[key]);
        }
        if (callback) {
            callback();
        }
    });

}

function synchronizeArray(path, original, owner, callback){
    var observer = new ArrayObserver(original);
    observer.open(function(splices){
        splices.forEach(function(splice) {
            var spliceArgs = [splice.index, splice.removed.length];
            var addIndex = splice.index;
            while (addIndex < splice.index + splice.addedCount) {
                spliceArgs.push(original[addIndex]);
                addIndex++;
            }

            var args = [path].concat(spliceArgs);
            owner.splice.apply(owner, args);
        });
        if (callback) {
            callback();
        }
    });

}

