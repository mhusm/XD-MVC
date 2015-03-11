# Cross-device Gallery

There are two versions of the gallery example. The first one uses photos stored on the server (gallery.html).
The second one allows the user to choose photos from their device and sends no data to the server (galleryp2p.html).

## Installation
It is assumed that you have both the framework and the examples folder in the same directory (as it is here in the repository).
The Fabian folder is not required.

1. `npm install`
2. `bower install`

## Starting
For the server version:
1. `node gallery-polymer.js`
2. Point your brower to http://hostname:8082/gallery.html

For the peer-to-peer version:
1. `node gallery-p2p.js`
2. Point your brower to http://hostname:8082/galleryp2p.html

Note that the applications only work in Chrome at the moment.

##Configuration
You can add your own photos to the image folder, just use the same folder structure as the example albums.

