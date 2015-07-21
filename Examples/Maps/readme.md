# Cross-device Maps

This application allows to browse Google maps simulatenously from different devices.
In the menu, you can see your device ID and connect to another devices by specifying its respective ID.
There are three roles: viewer, mirror, and overview. Viewer devices are independent and don't react to other devices. 
Mirror devices reproduce synchronise the center and zoom level of other viewer devices. This allows you, for example, to 
look at the same map region once as satellite image and once as a street map. Overview devices display the regions of 
any other connected device as a coloured rectangle.


## Installation
This project requires [node.js](nodejs.org) and [bower](bower.io).
It is assumed that you have both the Framework and the Examples folder in the same directory (as it is here in the repository).

1. `npm install`
2. `bower install`

## Starting
1. `node server.js`
2. Point your browser to http://hostname:8080/maps.html

