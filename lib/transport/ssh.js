var util = require('util')
  , extend = require('util-extend')
  , Fiber = require('fibers')
  , Connection = require('ssh2')
  , byline = require('byline')
  , Transport = require('./index')
  , errors = require('../errors')
  , fs = require('fs');

function SSH(context) {
  SSH.super_.call(this, context);

  var config = context.remote;

  if(config.privateKey) {
    config.privateKey =
      fs.readFileSync(config.privateKey, { encoding: 'utf8' });
  }

  var self = this;

  var fiber = Fiber.current;

  this._connection = new Connection();
  this._connection.on('ready', function() {
    fiber.run();
  });
  this._connection.on('error', function(err) {
    throw new errors.ConnectionFailedError('Error connecting to ' +
                                  self._context.remote.host + ': ' + err);
  });
  this._connection.connect(config);

  return Fiber.yield();
}
util.inherits(SSH, Transport);

SSH.prototype._exec = function(command, options) {
  options = options || {};

  var self = this;

  options = extend(extend({}, self._options), options); // clone and extend

  var result = {
    code: 0,
    stdout: null,
    stderr: null
  };

  self._logger.command(command);

  var fiber = Fiber.current;

  self._connection.exec(command, function(err, stream) {

    stream.on('data', function(data) {
      result.stdout = (result.stdout || '') + data;
    });

    stream.stderr.on('data', function(data) {
      result.stderr = (result.stderr || '') + data;
    });

    byline(stream).on('data', function(data) {
      if(!options.silent) {
        self._logger.stdout(data);
      }
    });

    byline(stream.stderr).on('data', function(data) {
      if(options.failsafe) {
        self._logger.stdwarn(data);
      } else {
        self._logger.stderr(data);
      }
    });

    stream.on('exit', function(code) {
      result.code = code;
    });

    stream.on('close', function() {
      if(result.code === 0) {
        self._logger.success('ok');
      } else if(options.failsafe) {
        self._logger.warn('safely failed (' + result.code + ')');
      } else {
        self._logger.error('failed (' + result.code + ')');
        throw new errors.CommandExitedAbormallyError(
                  'Command exited abnormally on ' + self._context.remote.host);
      }
      fiber.run(result);
    });
  });

  return Fiber.yield();
};

SSH.prototype.close = function() {
  this._connection.end();
};

module.exports = SSH;
