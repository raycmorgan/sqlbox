function BoxError(code, message, previousStack) {
  var error = new Error('(' + code + ') ' + (message || ''));
  error.code = code;

  Error.captureStackTrace(error, arguments.callee);

  if (previousStack) {
    error.message += ('\n\n --- Previous Trace --- \n\n' +
      previousStack + '\n\n ------------------- \n\n');
  }

  return error;
}

BoxError.stackCapture = function () {
  var error = new Error();
  Error.captureStackTrace(error, arguments.callee);
  return error.stack;
};

module.exports = BoxError;
