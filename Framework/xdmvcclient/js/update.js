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

