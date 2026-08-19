/**
 * Global Error Handler Middleware
 *
 * The fourth parameter is required: Express identifies error handlers by `fn.length === 4`.
 * With three parameters this was registered as ordinary middleware, never received an
 * error, and every failure fell through to Express's default handler - which replies with
 * an HTML page, breaking the JSON contract every client parses. `_next` is named with a
 * leading underscore to satisfy the repo's `argsIgnorePattern` lint rule.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  console.error('❌ Error occurred:', err);

  // Once headers are out the response is already committed; only Express's default
  // handler can close the socket correctly from here.
  if (res.headersSent) {
    return _next(err);
  }

  // body-parser and http-errors set `status`; app code sets `statusCode`.
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Unparseable JSON body - previously surfaced as an HTML SyntaxError page.
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }

  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  // Mongoose rejects a malformed ObjectId with CastError; that is a bad request, not a
  // server fault, and the raw message names internal collections and fields.
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier';
  }

  // Log stack trace in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', err.stack);
  }

  // Driver and framework errors carry internals in their message (connection strings,
  // collection names, query shapes). The full error is already logged above, so the
  // client only needs to know the request failed.
  if (statusCode >= 500) {
    message = 'Internal Server Error';
    errors = null;
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = errorHandler;
