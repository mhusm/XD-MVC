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
            callback.apply(null, arguments);
        });
    }

};