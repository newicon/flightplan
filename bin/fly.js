#!/usr/bin/env node

var Liftoff = require('liftoff')
  , v8flags = require('v8flags')
  , semver = require('semver')
  , logger = require('../lib/logger')()
  , cliPackage = require('../package')
  , argv = require('minimist')(process.argv.slice(2));

var cli = new Liftoff({
  name: 'flightplan',
  processTitle: 'Flightplan',
  configName: 'flightplan',
  extensions: {
    '.js': null,
    '.coffee': 'coffee-script/register'
  },
  nodeFlags: v8flags.fetch()
});

// Handle positional args
var task = 'default';
var target = argv._.length ? argv._[0] : null;

if(target && target.indexOf(':') !== -1) {
  target = target.split(':');
  task = target[0];
  target = target[1];
}

// Handle optional args
var optionalArgs = {
  file:     ['f', 'flightplan'],
  username: ['u', 'username'],
  debug:    ['d', 'debug'],
  version:  ['v', 'version'],
  help:     ['h', 'help'],
  color:    ['no-color']
};

var options = {};
Object.keys(optionalArgs).forEach(function(opt) {
  optionalArgs[opt].forEach(function(variant) {
    if(argv[variant]) {
      options[opt] = argv[variant];
      return false;
    }
  });
});

if(options.help) {
  var out = '\n' +
    '  Usage: fly [task:]target [options]\n\n' +
    '  Options:\n\n'  +
    '    -h, --help               show usage information\n' +
    '    -v, --version            show version number\n' +
    '    -f, --flightplan <file>  path to flightplan (default: flightplan.js)\n' +
    '    -u, --username <string>  user for connecting to remote hosts\n' +
    '    -d, --debug              enable debug mode\n' +
    '        --no-color           disable colors in output\n';
  console.log(out);
  process.exit(0);
}

if(options.version) {
  console.log(cliPackage.version);
  process.exit(0);
}

var invoke = function(env) {
  if(!target) {
    logger.error('Error: No target specified');
    process.exit(1);
  }

  if(!env.configPath) {
    logger.error('Error: flightplan.js not found');
    process.exit(1);
  }

  if(!env.modulePath) {
    logger.error('Error: Local flightplan package not found in ' + env.cwd);
    process.exit(1);
  }

  if(!semver.satisfies(env.modulePackage.version, '>=0.5.0')) {
    logger.error('Error: local flightplan package version should be >=0.5.0');
    process.exit(1);
  }

  process.chdir(env.configBase);
  require(env.configPath);
  var instance = require(env.modulePath);
  instance.run(task, target, options);
};

cli.launch({
  configPath: options.file
}, invoke);