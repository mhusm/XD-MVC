var fs = require('fs');

module.exports = {
    storeSession: function (sessionId, id, role, name, data, response) {
         // Create sessionfile if not exists
            fs.exists(__dirname + "/storage/" + sessionId + '.db', function (exists) {
                if (!exists) {
                    fs.writeFile(__dirname + "/storage/" + sessionId + '.db', '{}');
                }

                // Read out sessiondata
                fs.readFile(__dirname + "/storage/" + sessionId + '.db', 'utf8', function (err, data) {
                    if (err) {
                        response.setHeader("Content-Type", "text/html");
                        response.statusCode = 404;
                        response.end();
                        console.error("A storage error occurred.", err);
                    } else {

                        var file = {};
                        if (data !== null && data !== undefined) {
                            file = JSON.parse(data);
                        }

                        file[id] = {"role": role, "name": name, "data": JSON.parse(data)};

                        // Write sessiondata back
                        fs.writeFile(__dirname + "/storage/" + sessionId + '.db',
                            JSON.stringify(file),
                            function (err) {
                                if (err) {
                                    response.setHeader("Content-Type", "text/html");
                                    response.statusCode = 404;
                                    response.end();
                                    console.error("A storage error occurred.", err);
                                } else {
                                    response.end();
                                    console.info("Stored session " + sessionId + " of " + id + ".");
                                }
                            });
                    }
                });
            });
    },

    restoreSession: function(sessionId, id, response) {
        // restore session
        console.log('restore');
        fs.readFile(__dirname + "/storage/" + sessionId + '.db', 'utf8', function (err, data) {
            if (err) {
                response.setHeader("Content-Type", "text/html");
                response.statusCode = 404;
                response.end();
                console.error("A storage error occurred.", err);
            }

            var file = JSON.parse(data);
            response.write(JSON.stringify({"peers": Object.keys(file), "data": file[id]}));
            response.end();

            console.info('Restored session ' + sessionId + ' for user ' + id + '.');

        });
    }
}
