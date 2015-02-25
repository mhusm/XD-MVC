/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define */

var XDClient = {
    peer: null,
    userId: null,
    userRole: null,
    userName: null,
    userSession: null,
    availablePeers: {},
    availableSessions: [],
    connections: [],
    objectsToSync: {},
    roles: {},
    otherRoles: {},

    // CONNECT WITH THE SERVER
    connectToServer: function (userId, callback) {
        "use strict";
        var wantedId;
        if(userId !== null && userId !== undefined) {
            wantedId = userId;
        } else {
            wantedId = XDClient.userId;
        }

        if(XDClient.peer !== null && XDClient.peer !== undefined) {
            XDClient.peer.disconnect();
        }
        console.info("Trying to connect to server...");
        XDClient.peer = new Peer(wantedId, {
            host: "localhost",
            port: 9000
        });
        XDClient.peer.on("open", function (id) {
            console.info("Connection successful. Current id: " + id);
            XDClient.userId = id;
            XDClient.requestAvailablePeers();

            if(callback !== undefined) {
                callback();
            }
        });

        XDClient.peer.on("connection", XDClient.handleConnection);
        XDClient.peer.on("error", function (err) {
            XDClient.handleError(err);
        });
    },

    // GET A LIST OF ALL AVAILABLE PEERS AND SESSIONS
    requestAvailablePeers: function () {
        "use strict";
        ajax.get("http://localhost:9001", {
                listAllPeers: 1,
                test: 'test'
            },
            function (x) {
                var availabilityList = JSON.parse(x);
                XDClient.availablePeers = {};
                for (var entry in availabilityList.peers) {
                    if (entry !== XDClient.userId) {
                        XDClient.availablePeers[entry] = availabilityList.peers[entry];
                    }
                }
                XDClient.availableSessions = availabilityList.sessions;
            });
    },

    // SEND OBJECT-UPDATE TO ALL CONNECTED AND INTERESTED PEERS
    publish: function (msg) {
        "use strict";
        if (msg.label === null || msg.data === null) {
            console.warn("Wrongly formatted message. Please use {'label' : label, 'data' : data}");
        } else {
            XDClient.connections.forEach(function (conn) {
                if (conn.open) {
                    if (XDClient.otherRoles[conn.peer] === null
                        || XDClient.otherRoles[conn.peer] === undefined
                        || XDClient.roles[XDClient.otherRoles[conn.peer]].subObjects.indexOf(msg.label) !== -1) {

                        conn.send({
                            "type": "msg",
                            "sender": XDClient.userId,
                            "data": msg
                        });
                        //conn.send(document.getElementById("text").value);
                        console.info(msg.label + ": " + msg.data + " sent to: " + conn.peer);
                        //}
                    }
                } else {
                    console.info(msg.label + ": " + msg.data + " not sent to: " + conn.peer);
                }
            });
        }
    },

    // SEND A SYSTEM MESSAGE TO ALL CONNECTED PEERS
    publishSystemMessage: function (msg) {
         "use strict";
        if (msg.type === null) {
            console.warn("Wrongly formatted system-message. Please use {'type' : type, 'data' : data}");
        } else {
            XDClient.connections.forEach(function (conn) {
                if (conn.open) {
                        conn.send({
                            "type": "sys",
                            "sender": XDClient.userId,
                            "data": msg
                        });
                        //conn.send(document.getElementById("text").value);
                        console.info("System-message " + msg.data + " sent to: " + conn.peer);
                        //}
                } else {
                    console.warn("Connection is closed: System-message " + msg.data + " not sent to " + conn.peer);
                }
            });
        }
    },

    // GET DATA OF ALL OBJECTS FROM ALL CONNECTED PEERS
    lookupAll : function() {
        XDClient.publishSystemMessage(
            {"type": "lookup",
            "data": ""});
    },

    // CONNECT TO PEERS SELECTED IN MENU
    connectToSelectedPeers: function () {
        "use strict";
        XDClient.disconnectFromPeers();
        var collection = document.getElementById('xdclient_menu').getElementsByTagName('INPUT');
        var x;
        for (x = 0; x < collection.length; x++) {
            if (collection[x].type.toUpperCase() === 'CHECKBOX' && collection[x].checked) {
                XDClient.connectToPeer(collection[x].value);
            }
        }
    },

    // CONNECT TO PEER WITH ID peer
    connectToPeer: function (peer) {
        "use strict";
        console.info("Connect to peer " + peer);
        var conn = XDClient.peer.connect(peer);

        if(XDClient.connections.indexOf(conn) === -1) {
            XDClient.connections.push(conn);
        }

        XDClient.handleConnection(conn);
    },

    // DISCONNECT FROM ALL PEERS
    disconnectFromPeers: function () {
        "use strict";
        XDClient.connections.forEach(function (conn) {
            conn.close();
        });
        XDClient.connections = [];
        XDClient.userSession = undefined;
    },

    // CHANGE NAME AND BROADCAST IT TO ALL CONNECTED PEERS
    changeName: function (name) {
        "use strict";
        XDClient.userName = name;
        console.info("Username changed to " + name);
        XDClient.broadcastName(name);
    },

    // BROADCAST NAME TO ALL CONNECTED PEERS & SERVER
    broadcastName: function () {
        "use strict";
        XDClient.connections.forEach(function (conn) {
            if (conn.open) {
                XDClient.publishSystemMessage(
                    {
                        "type": "name",
                        "data": XDClient.userName
                    }
                );
                console.info("Rolechange broadcast successful.");
            } else {
                console.warn("Connection is closed: Rolechange broadcast to " + conn.peer + " failed.");
            }
        });

        // Submit rolechange to server
        ajax.get("http://localhost:9001", {
                changeName: 1,
                id: XDClient.userId,
                name: XDClient.userName
            },
            function (x) {},
            false);
    },

     // CHANGE ROLE OF PEER AND BRADCAST THE ROLE
    changeRole: function (roleName) {
        "use strict";
        if (roleName !== null && XDClient.roles[roleName] !== null) {
            XDClient.userRole = roleName;
            console.info("UserRole changed to " + roleName);
            XDClient.broadcastRole();
            XDClient.lookupAll();
        } else {
            console.warn("Role does not exist. Please use registerRole first.");
        }
    },

    // BROADCAST ROLE TO ALL CONNECTED PEERS & THE SERVER
    broadcastRole: function () {
        "use strict";
        XDClient.connections.forEach(function (conn) {
            if (conn.open) {
                XDClient.publishSystemMessage({
                        "type": "role",
                        "data": XDClient.userRole
                    }
                );
                //conn.send(document.getElementById("text").value);
                console.info("Rolechange broadcast successful.");
            } else {
                console.warn("Connection is closed: Rolechange broadcast to " + conn.peer + " failed.");
            }
        });

        // Submit rolechange to server
        ajax.get("http://localhost:9001", {
                changeRole: 1,
                id: XDClient.userId,
                role: XDClient.userRole
            },
            function (x) {},
            false);
    },

    // LISTENER ON CONNECTIONS
    handleConnection: function (conn) {
        "use strict";
        console.info("Connection from: " + conn.peer);

        conn.on("error", function (err) {
            XDClient.handleError(err);
        });

        conn.on("data", function (data) {
            XDClient.handleData(conn, data);
        });

        conn.on("open", function () {
            XDClient.handleOpen(conn);
        });

        conn.on("close", function () {
            XDClient.handleClose(conn);
        });
    },

    // CALLED WHEN A NEW CONNECTION GETS OPENED
    handleOpen: function (conn) {
        "use strict";
        console.info("Open Connection with " + conn.peer);
        if (XDClient.connections.indexOf(conn) === -1) {
            // Received a connection: send current data
            XDClient.connections.push(conn);
            for (var object in XDClient.objectsToSync) {
                    XDClient.publish({"label": object, "data": JSON.stringify(XDClient.objectsToSync[object].object)});
                }
        }
        // Broadcast current session
        XDClient.publishSystemMessage(
            {
                "type": "session",
                "data": XDClient.userSession
            }
        );
        // Broadcast current Role
        XDClient.publishSystemMessage(
            {
                "type": "role",
                "data": XDClient.userRole
            }
        );
        // Broadcast connected peers
        var connectedPeers = [];
        XDClient.connections.forEach(function (connection) {
            connectedPeers.push(connection.peer);
        });
        XDClient.publishSystemMessage(
            {
                "type": "peers",
                "data": JSON.stringify(connectedPeers)
            }
        );
    },

    // CALLED, WHEN DATA ARRIVES OVER A CONNECTION
    handleData: function (conn, msg) {
        "use strict";
        if (msg.type === "msg") {
            //data received
            console.info("Data received - " + msg.data.label + ": " + msg.data.data + " - from: " + msg.sender);

            var data;

            if (msg.data.type === "delta_object") {
                // Only received changed entries (of JSON-Object)
                // -> merge with current locally stored object

                var oldValue = XDClient.objectsToSync[msg.data.label].object;
                var receivedData = JSON.parse(msg.data.data);
                var newValue = {};
                for (var key in receivedData) {
                    if (receivedData[key] === "XD_VALUE_UNCHANGED") {
                        newValue[key] = oldValue[key];
                    } else {
                        newValue[key] = receivedData[key];
                    }
                }

                data = JSON.stringify(newValue);

            } else if (msg.data.type === "delta_array") {
                // Only received changed entries (of array)
                // -> merge with current locally stored object

                var oldValue = XDClient.objectsToSync[label].object;
                var receivedData = JSON.parse(msg.data.data);
                var newValue = [];
                receivedData.forEach(function (entry, index) {
                    if (entry === "XD_VALUE_UNCHANGED") {
                        newValue[index] = oldValue[index];
                    } else {
                        newValue[index] = entry;
                    }
                });

                data = JSON.stringify(newValue);

            } else {
                // Full update
                data = msg.data.data;
            }

            if (XDClient.userRole !== null && XDClient.roles[XDClient.userRole].callback !== null && XDClient.roles[XDClient.userRole].callback !== undefined) {

                //Use callback of role
                //prepare arguments (existing and updated)
                var args = [];
                var x;
                for (x = 0; x < XDClient.roles[XDClient.userRole].subObjects.length; x++) {
                    if (msg.data.label === XDClient.roles[XDClient.userRole].subObjects[x]) {
                        args[XDClient.roles[XDClient.userRole].subObjects[x]] = JSON.parse(data);
                    } else {
                        args[XDClient.roles[XDClient.userRole].subObjects[x]] =
                            XDClient.objectsToSync[XDClient.roles[XDClient.userRole].subObjects[x]].object;
                    }
                }

                //Call the function
                XDClient.roles[XDClient.userRole].callback(msg.sender, args);
            } else {

                // ??? NOT NECESSARY ANYMORE, BECAUSE OF OBJECT.OBSERVE?
                //XDClient.objectsToSync[msg.data.label].object = JSON.parse(msg.data.data);

                //Use callback of object
                if (XDClient.objectsToSync[msg.data.label].callback !== null && XDClient.objectsToSync[msg.data.label].callback !== undefined) {
                    XDClient.objectsToSync[msg.data.label].callback(msg.sender, JSON.parse(data));
                }
            }
        } else if (msg.type === "sys") {
            //system data received
            console.info("System data received. From:" + msg.sender + " Type:" + msg.data.type + " Data:" + msg.data.data);
            if (msg.data.type === "role") {
                XDClient.otherRoles[msg.sender] = msg.data.data;
            } else if (msg.data.type === "session") {
                if (msg.data.data === null && XDClient.userSession === null) {
                    if (msg.sender > XDClient.userId) {
                        XDClient.userSession = msg.sender + '_' + XDClient.userId;
                        XDClient.publishSystemMessage({
                                "type": "session",
                                "data": XDClient.userSession
                            });
                    } else {
                        XDClient.userSession = XDClient.userId + '_' + msg.sender;
                        XDClient.publishSystemMessage({
                                "type": "session",
                                "data": XDClient.userSession
                            });
                    }
                } else if (msg.data.data !== null && XDClient.userSession === null) {
                    XDClient.userSession = msg.data.data;
                    XDClient.publishSystemMessage({
                            "type": "session",
                            "data": msg.data.data
                        });
                } else if (msg.data.data === null && XDClient.userSession !== null) {
                    XDClient.publishSystemMessage({
                            "type": "session",
                            "data": XDClient.userSession
                        });
                } else if (msg.data.data !== XDClient.userSession) {
                    if (msg.data.data > XDClient.userSession) {
                        XDClient.publishSystemMessage({
                                "type": "session",
                                "data": XDClient.userSession
                            });
                    } else {
                        XDClient.userSession = msg.data.data;
                        XDClient.publishSystemMessage({
                                "type": "session",
                                "data": msg.data.data
                            });
                    }
                } else {
                    // Submit sessionId to server
                    console.info("Agreed on SessionID: " + XDClient.userSession);
                    ajax.get("http://localhost:9001", {
                            joinSession: 1,
                            id: XDClient.userId,
                            session: XDClient.userSession
                        },
                        function (x) {},
                        false);
                }
            } else if (msg.data.type === "storeSession") {
                var sessionString = "{";
                for (var object in XDClient.objectsToSync) {
                    sessionString = sessionString + '"' + object + '": ' + JSON.stringify(XDClient.objectsToSync[object].object) + ', ';
                }
                sessionString = sessionString.slice(0, -2) + '}';

                ajax.get("http://localhost:9001", {
                        storeSession: 1,
                        id: XDClient.userId,
                        role: XDClient.userRole,
                        name: XDClient.userName,
                        sessionId: XDClient.userSession,
                        data: sessionString
                    },
                    function (x) {},
                    false);

            } else if (msg.data.type === "lookup") {
                for (var object in XDClient.objectsToSync) {
                    XDClient.publish({"label": object, "data": JSON.stringify(XDClient.objectsToSync[object].object)});
                }
            } else if (msg.data.type === "peers") {
                console.info("Connect to partner peers.");
//                JSON.parse(msg.data.data).forEach(function (peer) {
//                    if (XDClient.connections.indexOf(peer) === -1) {
//                        XDClient.connectToPeer(peer);
//                    }
//                });
            }
        } else {
            console.warn("Wrongly formatted data received.");
        }
    },

    // CALLED WHEN AN ERROR OCCURS OVER A CONNECTION
    handleError: function (err) {
        "use strict";
        console.error("An error occurred.", err);
    },

    // CALLED, WHEN A CONNECTION GETS CLOSED
    handleClose: function (conn) {
        "use strict";
        if (XDClient.connections.indexOf(conn) !== -1) {
            console.info("Disconnected from " + conn.peer);
            XDClient.connections.splice(XDClient.connections.indexOf(conn), 1);
        }
    },

    // REGISTER AN OBJECT, WHICH WILL BE OBSERVED
    registerObject: function (label, object, serialisation, callback, deltaUpdates) {
        "use strict";
        if (XDClient.objectsToSync[label] === null || XDClient.objectsToSync[label] === undefined) {
            if (serialisation === null) {
               XDClient.objectsToSync[label] = {
                    "object": object,
                    "serialisation": null,
                    "callback": callback,
                    "deltaUpdates": deltaUpdates
                };
            } else {
                XDClient.objectsToSync[label] = {
                    "object": serialisation(object),
                    "serialisation": serialisation,
                    "callback": callback,
                    "deltaUpdates": deltaUpdates
                };
            }

            if (object instanceof Object) {
                Object.observe(object, function (label) {
                    return function (changes) {
                        changes.forEach(function (change) {
                            //console.error("O.o(): \n" + JSON.stringify(change) + "\n\n" + JSON.stringify(change.oldValue));
                            if (change.oldValue === undefined) {
                                XDClient.updateObject(label, change.object, true, {});
                            } else if (JSON.stringify(XDClient.objectsToSync[label].object) !== JSON.stringify(change.object)) {
                                XDClient.updateObject(label, change.object, true, change.oldValue.object);
                            }
                        });
                    }
                }(label));
            }

            console.info("Object " + label + " has been registered.");
        } else {
            console.warn("Label already in use. Please change label or use updateObject.");
        }
    },

    // CALL TO BROADCAST OBJECT CHANGE
    updateObject: function (label, object, forced, oldObject) {
        "use strict";

        if (XDClient.objectsToSync[label] !== null && XDClient.objectsToSync[label] !== undefined) {

            var serialisation = XDClient.objectsToSync[label].serialisation;
            if (serialisation === null) {
                serialisation = function (obj) {
                    return obj;
                }
            }

            // Is the object the same as before?
            if (JSON.stringify(XDClient.objectsToSync[label].object) !== JSON.stringify(serialisation(object)) || forced) {

                var oldValue;
                if (forced) {
                    oldValue = oldObject;
                } else {
                    oldValue = XDClient.objectsToSync[label].object;
                }

                if (XDClient.objectsToSync[label].serialisation === null) {
                    XDClient.objectsToSync[label] = {
                        "object": object,
                        "serialisation": XDClient.objectsToSync[label].serialisation,
                        "callback": XDClient.objectsToSync[label].callback,
                        "deltaUpdates": XDClient.objectsToSync[label].deltaUpdates
                    };
                } else {
                    XDClient.objectsToSync[label] = {
                        "object": XDClient.objectsToSync[label].serialisation(object),
                        "serialisation": XDClient.objectsToSync[label].serialisation,
                        "callback": XDClient.objectsToSync[label].callback,
                        "deltaUpdates": XDClient.objectsToSync[label].deltaUpdates
                    };
                }

                if (XDClient.objectsToSync[label].deltaUpdates === true) {
                    if (object.constructor === {}.constructor) {
                        // {}-Object: Try Delta-update

                        var delta = {};

                        for (var key in object) {
                            if (JSON.stringify(object[key]) === JSON.stringify(oldValue[key])) {
                                // value not changed -> do not resend
                                delta[key] = "XD_VALUE_UNCHANGED";
                            } else {
                                // value changed -> send
                                delta[key] = object[key];
                            }
                        }

                        //console.error(delta);

                        XDClient.publish({
                            "label": label,
                            "type": "delta_object",
                            "data": JSON.stringify(delta)
                        });
                    } else if (object.constructor === [].constructor) {
                        // []-Object: Try delta update

                        var delta = [];

                        object.forEach(function (entry, index) {
                            if (JSON.stringify(entry) === JSON.stringify(oldValue[index])) {
                                delta[index] = "XD_VALUE_UNCHANGED";
                            } else {
                                delta[index] = entry;
                            }
                        });

                        XDClient.publish({
                            "label": label,
                            "type": "delta_array",
                            "data": JSON.stringify(delta)
                        });
                    } else {
                        XDClient.publish({
                            "label": label,
                            "data": JSON.stringify(XDClient.objectsToSync[label].object)
                        });
                    }
                } else {
                    XDClient.publish({
                        "label": label,
                        "data": JSON.stringify(XDClient.objectsToSync[label].object)
                    });
                }

                console.info("Object " + label + " has been updated.");
            } else {
                console.info("Object " + label + " is up-to-date.");
            }
        } else {
            console.warn("Tried to update non registered object. Please use registerObject first.");
        }
    },

    // REGISTER A ROLE
    registerRole: function (label, subObjects, callback) {
        "use strict";
        if (XDClient.roles[label] === null || XDClient.roles[label] === undefined) {
            XDClient.roles[label] = {
                "subObjects": subObjects,
                "callback": callback
            };
            console.info("Role " + label + " with Subscription of " + subObjects + " got defined.");
        } else {
            console.warn("Role " + label + " has already been defined.");
        }
    },

    // STORE THE CURRENT SESSION (SEND DATA TO SERVER AND TELL CONNECTED PEERS TO DO THE SAME)
    storeSession: function () {
        console.info('Store session - send objects to server.');
        XDClient.publishSystemMessage({
            "type": "storeSession",
            "data": ""
        });
        var sessionString = "{";
        for (var object in XDClient.objectsToSync) {
            sessionString = sessionString + '"' + object + '": ' + JSON.stringify(XDClient.objectsToSync[object].object) + ', ';
        }
        sessionString = sessionString.slice(0, -2) + '}';

        ajax.get("http://localhost:9001", {
                storeSession: 1,
                id: XDClient.userId,
                role: XDClient.userRole,
                name: XDClient.userName,
                sessionId: XDClient.userSession,
                data: sessionString
            },
            function (x) {},
  false);
  },

   // RESTORE A PREVIOUS SESSION
  restoreSession: function (sessionId, clientId) {
      "use strict";

      // Connect to server with correct ID
      XDClient.connectToServer(clientId, function () {
          ajax.get("http://localhost:9001", {
                  restoreSession: 1,
                  sessionId: sessionId,
                  id: clientId
              },
              function (x) {
                  var parsedObjects = JSON.parse(x);

                  // Restore objects
                  for (var object in parsedObjects.data.data) {
                      console.info("Object " + object + " restored.");
                      XDClient.objectsToSync[object].object = parsedObjects.data.data[object];
                      //Use callback of object
                      if (XDClient.objectsToSync[object].callback !== null && XDClient.objectsToSync[object].callback !== undefined) {
                          XDClient.objectsToSync[object].callback(XDClient.userId, parsedObjects.data.data[object]);
                      }
                  }

                  // Restore name
                  if (parsedObjects.data.name !== undefined && parsedObjects.data.name !== null && parsedObjects.data.name !== 'null') {
                      XDClient.changeName(parsedObjects.data.name);

                  }

                  // Restore role
                  if (parsedObjects.data.role !== undefined && parsedObjects.data.role !== null && parsedObjects.data.role !== 'null') {
                      XDClient.changeRole(parsedObjects.data.role);
                      //XDClient.userRole = parsedObjects.data.role;
                  }

                  // Restore session Id
                  XDClient.userSession = sessionId;
                  ajax.get("http://localhost:9001", {
                          joinSession: 1,
                          id: XDClient.userId,
                          session: XDClient.userSession
                      },
                      function (x) {},
                      false);


                  // Reconnect to peers (if available)
                  parsedObjects.peers.forEach(function (key) {
                      if (XDClient.availablePeers[key] !== undefined) {
                          XDClient.connectToPeer(key);
                      }
                  });

                  console.info('Restored session.');
              });
      });
  },

   // DEFAULT-MENU TO PROVIDE BASIC FUNCTIONALITY
  showMenu: function () {
      "use strict";

      XDClient.requestAvailablePeers();

      var html = '<div class="xdclient_menu_inner">' + '<div class="xdclient_close" onclick="XDClient.hideMenu();">x</div>' + '<h1>XDClient Menu</h1><hr />' + '<h3>Username</h3>' + '<input name="username" id="username" placeholder="Username" type="text"';

      if (XDClient.userName != null) {
          html = html + 'value="' + XDClient.userName + '"';
      }

      html = html + '/><button type="submit" onclick="javascript: XDClient.changeName(document.getElementById(\'username\').value);">Change</button>' + '<h3>Available Peers</h3>';

      if (Object.keys(XDClient.availablePeers).length > 0) {
          var conns = [];
          XDClient.connections.forEach(function (c) {
              conns.push(c.peer);
          });
          console.log(JSON.stringify(XDClient.availablePeers));
          for (var p in XDClient.availablePeers) {
              if (conns.indexOf(p) === -1) {
                  html = html + '<input type="checkbox" value="' + p + '">';

                  // has the client a name?
                  if (XDClient.availablePeers[p].name !== undefined) {
                      html = html + XDClient.availablePeers[p].name;
                  } else {
                      html = html + p;
                  }

                  // is the client in a session?
                  if (XDClient.availablePeers[p].session !== undefined) {
                      html = html + ' <small>(' + XDClient.availablePeers[p].session + ')</small>';
                  }

                  html = html + '<br />';
              } else {
                  html = html + '<input type="checkbox" value="' + p + '" checked="checked">';
                  if (XDClient.availablePeers[p].name !== undefined) {
                      html = html + XDClient.availablePeers[p].name + ' <small>' + XDClient.availablePeers[p].session + '</small>';
                  } else {
                      html = html + p;
                  }

                  // is the client in a session?
                  if (XDClient.availablePeers[p].session !== undefined) {
                      html = html + ' <small>(' + XDClient.availablePeers[p].session + ')</small>';
                  }

                  html = html + '<br />';
              }
          };
          html = html + '<br/><button onclick="XDClient.connectToSelectedPeers();">Connect!</button>';
      } else {
          html = html + 'No connections available.';
      }

      html = html + '<hr />';
      html = html + '<h3>Available Roles</h3>';
        var k = null;
        for (k in XDClient.roles) {
            if (k === XDClient.userRole) {
                html = html + '<input type="radio" name="roles" value="' + k + '" checked />' + k + '<br />';
            } else {
                html = html + '<input type="radio" name="roles" value="' + k + '" />' + k + '<br />';
            }
        }

        if (k === null) {
            html = html + '<br/>No roles defined.';
        } else {
            html = html + '<br/><button onclick="var collection = document.getElementById(\'xdclient_menu\').getElementsByTagName(\'INPUT\'); var x;for (x = 0; x < collection.length; x++) {if (collection[x].type.toUpperCase() === \'RADIO\' && collection[x].checked) {if (XDClient.roles[collection[x].value] !== null) {XDClient.changeRole(collection[x].value);}}}">Change role</button>';
        }

        html = html + '<hr />';
        html = html + '<button onclick="javascript:XDClient.storeSession();">Store session</button><hr />';

        html = html + '<input name="sessionId" id="sessionId" placeholder="Session ID" /><input name="clientId" id="clientId" placeholder="User ID" /><button onclick="javascript:XDClient.restoreSession(document.getElementById(\'sessionId\').value, document.getElementById(\'clientId\').value);">Restore session</button>';
        html = html + '</div>';

        document.getElementById('xdclient_menu').style.display = '';
        document.getElementById('xdclient_menu').innerHTML = html;
    },

    hideMenu: function () {
        "use strict";
        document.getElementById('xdclient_menu').style.display = 'none';
        document.getElementById('xdclient_menu').innerHTML = '';
    }
};

var ajax = {};
ajax.x = function () {
    if (typeof XMLHttpRequest !== 'undefined') {
        return new XMLHttpRequest();
    }
    var versions = [
        "MSXML2.XmlHttp.5.0",
        "MSXML2.XmlHttp.4.0",
        "MSXML2.XmlHttp.3.0",
        "MSXML2.XmlHttp.2.0",
        "Microsoft.XmlHttp"
    ];

    var xhr;
    for (var i = 0; i < versions.length; i++) {
        try {
            xhr = new ActiveXObject(versions[i]);
            break;
        } catch (e) {}
    }
    return xhr;
};

ajax.send = function (url, callback, method, data, sync) {
    var x = ajax.x();
    x.open(method, url, sync);
    x.onreadystatechange = function () {
        if (x.readyState == 4) {
            callback(x.responseText)
        }
    };
    if (method == 'POST') {
        x.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    }
    x.send(data)
};

ajax.get = function (url, data, callback, sync) {
    var query = [];
    for (var key in data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
    ajax.send(url + '?' + query.join('&'), callback, 'GET', null, sync)
};

ajax.post = function (url, data, callback, sync) {
    var query = [];
    for (var key in data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
    ajax.send(url, callback, 'POST', query.join('&'), sync)
};
