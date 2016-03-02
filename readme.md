# XD-MVC

XD-MVC brings cross-device capabilities to MVC frameworks. 
It can be used as a plain JavaScript library. In addition, we provide an integration with [Polymer](http://www.polymer-project.org).
XD-MVC consists of a server-side and a client-side part.
For communication among devices, both a peer-to-peer (based on [PeerJS](http://peerjs.com/)) and a client-server (based on [Socket.io](http://socket.io/)) version exist. In addition, a hybrid version is enabled by default, which will use PeerJS for clients that support it and fall back to Socket.io for those that do not. The hybrid version is used by default, however, you are free to choose another version that suits your needs best. You can also choose to only use the device-to-device communication library (d2d.js) that is part of this project.

## Structure
**Note that the structure of this project has changed. The project has been split over multiple repositories. The code in this one will no longer be maintained and will be removed in the future.** 

* The **server-side** part is located at [https://github.com/mhusm/XD-MVC-Server](XD-MVC-Server). 
* The **client-side** part is located at [https://github.com/mhusm/XD-MVC-Client](XD-MVC-Client).
* A gallery example built with **Polymer** is located at [https://github.com/mhusm/XD-Gallery](XD-Gallery).
* A maps example built with **JavaScript** is located at [https://github.com/mhusm/XD-Maps](XD-Maps).
* A Chat example using **d2d** is located at [https://github.com/mhusm/XD-Maps](XD-Maps).

## Supported Browsers
The framework uses some experimental JavaScript features, hence it may not work equally well in all browsers. 
The best support is reached for Chrome.
If peer-to-peer communication is used, that is the only browser that is fully supported due to issues of PeerJS with other browsers.
If client-server or hybrid communication is used, also Firefox and Safari should work. For applications built with Polymer we have seen best results with Chrome, however, thanks to polyfills all modern browsers should be suppported. Internet Explorer support has not been tested. 

## About this Project
XD-MVC is under development at the [Globis Group at ETH Zürich](https://globis.ethz.ch). The project is coordinated by [Maria Husmann](https://globis.ethz.ch/#!/person/maria-husmann/). [Fabian Stutz](https://github.com/fabwid), Silvan Egli, and Marko Zivkovic have contributed to XD-MVC.