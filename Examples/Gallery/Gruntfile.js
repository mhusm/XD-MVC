module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        clean: {
            client:  ["./public/bower_components/xdmvcclient"],
            server:  ["./node_modules/xd-mvc"]
        },

        "bower-install-simple": {
            options: {
                color: true,
                cwd: './',
                directory: "./public/bower_components/"
            }
        }
     });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-bower-install-task');
    grunt.loadNpmTasks('grunt-npm-install');

    // Default task(s).
    grunt.registerTask('default', ['clean:client', 'bower_install']);
    grunt.registerTask('server', ['clean:server', 'npm-install']);

};