/**
 * Created by silvan_egli on 16.06.2015.
 */
//scp ~/.ssh/id_rsa.pub root@xdmvc.link:~/.ssh/authorized_keys
var plan = require('flightplan');
var username = 'root';
var currBranch;


// configuration
plan.target('cloud', [
    {
        host: 'xdmvc.link',
        username: username,
        privateKey: 'C:/Users/siegli/Desktop/BaThe/.ssh/id_rsa',
        agent: process.env.SSH_AUTH_SOCK
    }
]);

// run commands on localhost
plan.local(function(local) {
    currBranch = local.exec('git rev-parse --abbrev-ref HEAD').stdout;
    local.log('Push files to origin ' + currBranch);
    local.exec('git push origin ' + currBranch);
});

// run commands on remote hosts (destinations)
plan.remote(function(remote) {
    var appTopFolder = '~/code/xdmvc/Examples/'
    var appFolders = ['Gallery','Maps','Performance'];

    remote.log('pull from origin '+ currBranch);
    remote.exec('cd /root/code/xdmvc && git checkout ' + currBranch + ' git pull origin ' + currBranch);


    appFolders.forEach(function (appFolder) {
        remote.log('-----------------------------------------------------------')
        remote.log('running grunt for ' + appFolder);
        remote.exec('cd '+appTopFolder + appFolder + ' && grunt && grunt server');
    });

    remote.log('---------------------------------------------------------');
    remote.log('Reload  Maps application');
    remote.exec('forever stop ~/code/xdmvc/Examples/Maps/server.js', {failsafe: true});
    remote.exec('forever start ~/code/xdmvc/Examples/Maps/server.js');
    remote.log('---------------------------------------------------------');
    remote.log('Reload Performance application');
    remote.exec('forever stop ~/code/xdmvc/Examples/Performance/perf_server.js', {failsafe: true});
    remote.exec('forever start ~/code/xdmvc/Examples/Performance/perf_server.js');

});