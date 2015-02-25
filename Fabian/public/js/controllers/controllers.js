var XDMediaplayer = angular.module('XDMediaplayer', []);

XDMediaplayer.controller('MediaplayerCtrl', function ($scope) {
    $scope.library = {};
    $scope.$watch("library");
    XDClient.registerObject(
        "library",
        $scope.library,
        null,
        function (sender, obj) {
            for (var key in obj) {
                    $scope.library[key] = obj[key];
            }
            for (var key in $scope.library) {
                if (obj[key] === undefined) {
                    delete $scope.library[key];
                }
            }
            $scope.$apply();
        },
        true);

    $scope.playlist = [];
    $scope.$watch("playlist");
    XDClient.registerObject(
        "playlist",
        $scope.playlist,
        null,
        function (sender, obj) {
            obj.forEach(function (entry, index) {
                $scope.playlist[index] = entry;
            });
            if ($scope.playlist.length - obj.length > 1) {
                $scope.playlist.splice(obj.length, $scope.playlist.length - obj.length);
            }
            $scope.$apply();
        });

    var playInterval;
    $scope.play = false;
    $scope.$watch("play", function () {
        if ($scope.play === true) {
            document.getElementById('playbutton').innerHTML = "Pause";
            playInterval = window.setInterval(function () {
                if ($scope.play === true && $scope.playlist.length > $scope.currentImage + 1) {
                    $scope.currentImage = $scope.currentImage + 1;
                    $scope.$apply();
                } else {
                    $scope.play = false;
                    $scope.$apply();
                }
            }, $scope.interval * 1000);

        } else {
            document.getElementById('playbutton').innerHTML = "Play";
            window.clearInterval(playInterval);
        }
    });
    XDClient.registerObject(
        "play",
        $scope.play,
        null,
        function (sender, obj) {
            $scope.play = JSON.parse(obj);
            $scope.$apply();
        });

    $scope.currentImage = 0;
    $scope.$watch("currentImage");
    XDClient.registerObject(
        "currentImage",
        $scope.currentImage,
        null,
        function (sender, obj) {
            $scope.currentImage = obj;
            $scope.$apply();
        });

    $scope.intervals = [1,2,5,10,20];
    $scope.interval = 5;
    $scope.$watch("interval");
    XDClient.registerObject(
        "interval",
        $scope.interval,
        null,
        function (sender, obj) {
            $scope.interval = obj;
            $scope.$apply();
        });



    $scope.addFilesToLibrary = function () {
        var files = document.getElementById('files').files;

        for (var i = 0, f; f = files[i]; i++) {
            $scope.library[f.name] = {
                "name": f.name,
                "file": f,
                "type": f.type,
                "size": f.size,
                "contributor": XDClient.userId
            };
            var reader = new FileReader();

            reader.onload = (function (f) {
                return function (e) {
                    //document.getElementById('preview' + f.name).src = e.target.result;
                    var oldValue = JSON.parse(JSON.stringify($scope.library));
                    $scope.library[f.name].preview = e.target.result;
                    $scope.$apply();
                    XDClient.updateObject("library", $scope.library, true, oldValue);
                }
            })(f);

            reader.readAsDataURL(f);
        }
    };

    $scope.addFileToPlaylist = function (file) {
        $scope.playlist.push({
            "name": file
        });
    };

    $scope.nextImage = function () {
        if ($scope.currentImage + 1 < $scope.playlist.length) {
            $scope.currentImage =  $scope.currentImage + 1;
        }
    };

    $scope.previousImage = function () {
        if ($scope.currentImage > 0) {
            $scope.currentImage = $scope.currentImage - 1;
        }
    };

    $scope.showImage = function (position) {
        $scope.currentImage = position;
    };

    $scope.playback = function () {
        if ($scope.play === false) {
            $scope.play = true;
        } else {
            $scope.play = false;
        }
    };
});
