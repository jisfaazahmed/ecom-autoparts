/**
 * Standardized API Response Utilities
 */

class ApiResponse {
  /**
   * Success response
   */
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      status: 'success',
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Error response
   */
  static error(res, message = 'Error occurred', statusCode = 500, errors = null) {
    const response = {
      status: 'error',
      message,
      timestamp: new Date().toISOString()
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Created response (201)
   */
  static created(res, data, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  /**
   * Bad request response (400)
   */
  static badRequest(res, message = 'Bad request', errors = null) {
    return this.error(res, message, 400, errors);
  }

  /**
   * Not found response (404)
   */
  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  /**
   * Conflict response (409)
   */
  static conflict(res, message = 'Resource conflict') {
    return this.error(res, message, 409);
  }

  /**
   * Internal server error response (500)
   */
  static serverError(res, message = 'Internal server error') {
    return this.error(res, message, 500);
  }
}

module.exports = ApiResponse;