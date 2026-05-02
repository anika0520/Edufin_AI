// src/utils/response.js

class ApiResponse {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static created(res, data, message = 'Created successfully') {
    return this.success(res, data, message, 201);
  }

  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    const body = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
  }

  static validationError(res, errors) {
    return this.error(res, 'Validation failed', 422, errors);
  }

  static unauthorized(res, message = 'Unauthorized') {
    return this.error(res, message, 401);
  }

  static forbidden(res, message = 'Forbidden') {
    return this.error(res, message, 403);
  }

  static notFound(res, message = 'Not found') {
    return this.error(res, message, 404);
  }
}

class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message, errors) {
    super(message, 422, errors);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

module.exports = { ApiResponse, AppError, ValidationError, NotFoundError, UnauthorizedError };
