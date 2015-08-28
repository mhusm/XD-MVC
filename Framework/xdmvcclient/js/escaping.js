// copied from  http://underscorejs.org/underscore.js
var htmlEscape = {
    
      // Invert the keys and values of an object. The values must be serializable.
    invert : function (obj) {
        var result = {};
        var keys = Object.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
          result[obj[keys[i]]] = keys[i];
        }
        return result;
    },


    // List of HTML entities for escaping.
    escapeMap : {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;'
    },
    // Functions for escaping and unescaping strings to/from HTML interpolation.
    createEscaper : function(map) {
        var escaper = function(match) {
          return map[match];
        };
        // Regexes for identifying a key that needs to be escaped
        var source = '(?:' + Object.keys(map).join('|') + ')';
        var testRegexp = RegExp(source);
        var replaceRegexp = RegExp(source, 'g');
        return function(string) {
          string = string == null ? '' : '' + string;
          return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
        };
    }
};

htmlEscape.unescapeMap = htmlEscape.invert(htmlEscape.escapeMap);
htmlEscape.escape = htmlEscape.createEscaper(htmlEscape.escapeMap);
htmlEscape.unescape = htmlEscape.createEscaper(htmlEscape.unescapeMap);