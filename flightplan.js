/**
 * Created by silvan_egli on 16.06.2015.
 */
var plan = require('flightplan');

var appName = 'performance';
var username = 'root';
var startFile = 'perf_server.js';
var currBranch;

var tmpDir = appName+'-' + new Date().getTime();

// configuration

plan.target('cloud', [
    {
        host: 'xdmvc.link',
        username: username,
        privateKey: '/Users/silvan_egli/.ssh/id_rsa',
        agent: process.env.SSH_AUTH_SOCK
    }
]);

// run commands on localhost
plan.local(function(local) {
    currBranch = local.exec('git rev-parse --abbrev-ref HEAD').stdout;
    console.log(currBranch);
    local.log('Push files to origin ' + currBranch);
    local.exec('git push origin ' + currBranch);
});

// run commands on remote hosts (destinations)
plan.remote(function(remote) {
    var appTopFolder = '~/code/xdmvc/Examples/'
    var appFolders = ['Gallery','Maps','Performance'];

    remote.log('pull from origin '+ currBranch);
    remote.exec('cd /root/code/xdmvc && git checkout ' + currBranch)


    appFolders.forEach(function (appFolder) {
        remote.log('-----------------------------------------------------------')
        remote.log('running grunt for ' + appFolder);
        remote.exec('cd '+appTopFolder + appFolder + ' && grunt && grunt client');
    });

/*
    remote.log('Reload application');
    remote.sudo('ln -snf ~/' + tmpDir + ' ~/'+appName, {user: username});
    remote.exec('forever stop ~/'+appName+'/'+startFile, {failsafe: true});
    remote.exec('forever start ~/'+appName+'/'+startFile);
    */
});