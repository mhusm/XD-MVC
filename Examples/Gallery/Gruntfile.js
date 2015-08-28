/*
 * XD-MVC -- A framework for cross-device applications
 * Copyright (C) 2014-2015 Maria Husmann. All rights reserved.
 *
 * XD-MVC is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * XD-MVC is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with XD-MVC. If not, see <http://www.gnu.org/licenses/>.
 *
 * See the README and LICENSE files for further information.
 *
 */

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