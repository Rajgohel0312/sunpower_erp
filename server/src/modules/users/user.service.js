/**
 * User & Role Management Business Logic Service
 */

import { userRepository } from './user.repository.js';
import { hashPassword } from '../../utils/crypto.js';
import { AppError } from '../../utils/response.js';
import { withTransaction } from '../../database/pool.js';

export const userService = {
  /**
   * List users with pagination and search
   */
  async listUsers(params) {
    return userRepository.listUsers(params);
  },

  /**
   * Get single user profile
   */
  async getUser(id) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }
    return user;
  },

  /**
   * Create new user and assign roles
   */
  async createUser(input, actor) {
    const passwordHash = await hashPassword(input.password);

    return withTransaction(async (trx) => {
      return userRepository.createUser(
        {
          email: input.email,
          phone_e164: input.phone_e164,
          full_name: input.full_name,
          password_hash: passwordHash,
          is_active: true
        },
        input.role_codes,
        trx
      );
    });
  },

  /**
   * Update existing user profile
   */
  async updateUser(id, input, actor) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const { role_codes, ...fields } = input;

    return withTransaction(async (trx) => {
      return userRepository.updateUser(id, fields, role_codes, trx);
    });
  }
};

export default userService;
