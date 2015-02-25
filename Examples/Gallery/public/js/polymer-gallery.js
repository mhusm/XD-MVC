$(document).on("polymer-ready", function () {
	var viewer = document.querySelector('image-element');
		
	Object.observe(XDp2p.myPosition, function (changes) {
        viewer.offset = XDp2p.myPosition.value;
    });

});
