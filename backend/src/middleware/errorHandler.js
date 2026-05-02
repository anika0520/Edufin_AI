// src/middleware/errorHandler.js
const logger = require('../utils/logger');
const { AppError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Postgres errors
  if (err.code === '23505') {
    statusCode = 409;
    message = 'Resource already exists';
  } else if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced resource not found';
  } else if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid UUID format';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Token expired'; }

  if (!err.isOperational && statusCode === 500) {
    logger.error('Unhandled error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.userId,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};

module.exports = { errorHandler, notFound };
