/**
 * User & Role Management HTTP Controller
 */

import { userService } from './user.service.js';
import { sendSuccess } from '../../utils/response.js';

export const userController = {
  async listUsers(req, res, next) {
    try {
      const result = await userService.listUsers(req.query);
      return sendSuccess(res, result.users, { pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  async getUser(req, res, next) {
    try {
      const user = await userService.getUser(req.params.id);
      return sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  },

  async createUser(req, res, next) {
    try {
      const user = await userService.createUser(req.body, req.user);
      return sendSuccess(res, user, { message: 'User created successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req, res, next) {
    try {
      const user = await userService.updateUser(req.params.id, req.body, req.user);
      return sendSuccess(res, user, { message: 'User updated successfully' });
    } catch (err) {
      next(err);
    }
  }
};

export default userController;
