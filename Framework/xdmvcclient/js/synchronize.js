/*global console, CustomEvent, Peer, Event */
'use strict';
/*jslint plusplus: true */


var XDsync = {
    syncData : {},

    /*
     --------------------
     Data Synchronisation
     --------------------
     */

    sendSyncToAll : function (changes, id) {
        var arrayDelta = [];
        var objectDelta = [];
        var data;
        if (!changes) {
            // No changes specified. Send whole object
            data = XDmvc.syncData[id].data;
        } else {
            if (Array.isArray(XDmvc.syncData[id].data)){
                var splices = changes[0];
                splices.forEach(function(splice) {
                    var spliceArgs = [splice.index, splice.removed.length];
                    var addIndex = splice.index;
                    while (addIndex < splice.index + splice.addedCount) {
                        spliceArgs.push(XDmvc.syncData[id].data[addIndex]);
                        addIndex++;
                    }
                    arrayDelta.push(spliceArgs);
                });
                data = arrayDelta;
            } else {
                objectDelta=Array.prototype.slice.call(changes, 0 ,3);
                data = objectDelta;
            }
        }

        var msg = {type: 'sync', data: data, id: id, arrayDelta: arrayDelta.length>0, objectDelta: objectDelta.length >0};
        var len = XDmvc.connectedDevices.length,
            i;

        for (i = 0; i < len; i++) {
            var conDev = XDmvc.connectedDevices[i];
            var con = conDev.connection;
            if (con.open &&  conDev.isInterested(id)){
                con.send(msg);
            }
        }

        if (XDmvc.syncData[id].updateServer) {
            XDmvc.sendToServer("sync", {type: 'sync', data: XDmvc.syncData[id].data});
        }
        var event = new CustomEvent('XDSyncData', {'detail' : id});
        document.dispatchEvent(event);

    },

    synchronize : function (data, callback, id, updateServer, updateObjectFunction, updateArrayFunction) {
        // if no id given, generate one. Though this may not always work. It could be better to enforce IDs.
        var dataid = typeof id !== 'undefined' ? id : 'sync' + (XDmvc.lastSyncId++);
        var sync = function (data) {return XDmvc.sendSyncToAll(arguments, dataid); };
        var updateObject = updateObjectFunction?  updateObjectFunction : function(id, key, value){ XDmvc.syncData[id].data[key] = value};
        var updateArray = updateArrayFunction?  updateArrayFunction : function(id, splices){
            splices.forEach(function(spliceArgs){
                Array.prototype.splice.apply(XDmvc.syncData[id].data, spliceArgs);
            });
        };
        XDmvc.syncData[dataid] = {data: data,
            callback: callback,
            syncFunction: sync,
            updateServer: updateServer,
            updateObjectFunction: updateObject,
            updateArrayFunction: updateArray
        };
        if (Array.isArray(data)){
            XDmvc.syncData[dataid].observer = new ArrayObserver(data);
            XDmvc.syncData[dataid].observer.open(sync);
        } else {
            // TODO this only observes one level. should observe nested objects as well?
            XDmvc.syncData[dataid].observer = new ObjectObserver(data);
            XDmvc.syncData[dataid].observer.open(sync);
        }
    },

    // TODO there is some redundancy with the update function. This should be fixed
    updateOld: function(old, data, arrayDelta, objectDelta){
        var changedOrAdded;
        var removed;
        var added = {};
        var key;
        var splices;
        if (Array.isArray(old)) {
            if (arrayDelta) {
                splices = data;
            } else {
                // No delta, replace old with new
                var args= [0, old.length].concat(data)
                splices = [args];
            }

            splices.forEach(function(spliceArgs){
                Array.prototype.splice.apply(old, spliceArgs);
            });
        } else {
            if (objectDelta) {
                added = data[0];
                removed = data[1];
                var changed = data[2];
                changedOrAdded = changed;
            }
            else{
                var delta = XDmvc.getDelta(old, data);
                removed = delta[0];
                changedOrAdded = delta[1];

            }

            // Deleted properties
            for (key in removed) {
                old[key] = undefined; // TODO this is not exactly the same as delete
            }
            // New and changed properties
            for (key in changedOrAdded) {
                old[key]= changedOrAdded[key];
            }
            for (key in added) {
                old[key]= changedOrAdded[key];
            }
        }
    },

    update : function (data, id, arrayDelta, objectDelta, keepChanges) {
        var observed =  XDmvc.syncData[id];
        var changedOrAdded;
        var removed;
        var added = {};
        var key;
        var splices;
        if (Array.isArray(observed.data)) {
            if (arrayDelta) {
                splices = data;
            } else {
                // No delta, replace old with new
                var args= [0, observed.data.length].concat(data)
                splices = [args];
            }

            observed.updateArrayFunction(id, splices);
        } else {
            if (objectDelta) {
                added = data[0];
                removed = data[1];
                var chagned = data[2];
                changedOrAdded = chagned;
            }
            else{
                var delta = XDmvc.getDelta(observed.data, data);
                removed = delta[0];
                changedOrAdded = delta[1];

            }

            // Deleted properties
            for (key in removed) {
                observed.updateObjectFunction(id, key, undefined); // TODO this is not exactly the same as delete
            }
            // New and changed properties
            for (key in changedOrAdded) {
                observed.updateObjectFunction(id, key, changedOrAdded[key]);
            }
            for (key in added) {
                observed.updateObjectFunction(id, key, added[key]);
            }
        }
        // Discard changes that were caused by the update
        if (!keepChanges) {
            observed.observer.discardChanges();
        }

        var event = new CustomEvent('XDupdate', {'detail': {dataId: id, data: observed.data}});
        document.dispatchEvent(event);
    },

    getDelta: function(oldObj, newObj){
        var addedOrChanged = {};
        var removed = {};
        var key;
        // No delta, replace all old with new properties
        // Deleted properties
        for (key in oldObj) {
            if (oldObj.hasOwnProperty(key) && !newObj.hasOwnProperty(key)) {
                removed[key] = true;
            }
        }
        // New and changed properties
        for (key in newObj) {
            if (newObj.hasOwnProperty(key)) {
                addedOrChanged[key] = newObj[key];
            }
        }
        return [removed, addedOrChanged];
   },

    forceUpdate: function(objectId){
        XDmvc.sendSyncToAll(null, objectId);
    },

    discardChanges: function(id){
        XDmvc.syncData[id].observer.discardChanges();
    }




};
