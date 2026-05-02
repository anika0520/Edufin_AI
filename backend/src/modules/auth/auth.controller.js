// src/modules/auth/auth.controller.js
const authService = require('./auth.service');
const { ApiResponse } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('firstName').trim().isLength({ min: 2, max: 100 }),
  body('lastName').trim().isLength({ min: 2, max: 100 }),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.validationError(res, errors.array());
    }

    const result = await authService.register(req.body, req);
    return ApiResponse.created(res, result, 'Registration successful');
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.validationError(res, errors.array());
    }

    const result = await authService.login(req.body, req);
    return ApiResponse.success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return ApiResponse.error(res, 'Refresh token required', 400);

    const tokens = await authService.refresh(refreshToken, req);
    return ApiResponse.success(res, { tokens }, 'Tokens refreshed');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    await authService.logout(token, req.userId);
    return ApiResponse.success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

const me = async (req, res) => {
  return ApiResponse.success(res, { user: req.user }, 'User profile');
};

module.exports = { register, login, refresh, logout, me, registerValidation, loginValidation };
