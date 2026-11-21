/**
 * User & Role Management Database Repository
 */

import { db } from '../../database/index.js';

export const userRepository = {
  /**
   * List users with pagination and role mapping
   */
  async listUsers({ page = 1, limit = 25, search, role }, client = null) {
    const offset = (page - 1) * limit;

    let query = db
      .select('u.id', 'u.email', 'u.phone_e164', 'u.full_name', 'u.is_active', 'u.created_at')
      .from('users AS u')
      .whereNull('u.deleted_at');

    if (search) {
      query.andWhere(g => {
        g.where('u.full_name', 'ILIKE', `%${search}%`)
         .orWhere('u.email', 'ILIKE', `%${search}%`);
      });
    }

    const rows = await query
      .orderBy('u.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .execute(client);

    // Get count for pagination metadata
    const countRes = await db
      .select('COUNT(*) AS total')
      .from('users AS u')
      .whereNull('u.deleted_at')
      .executeTakeFirst(client);

    const total = parseInt(countRes?.total || '0', 10);

    return {
      users: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  /**
   * Find user by ID with roles and permissions
   */
  async findById(id, client = null) {
    const user = await db
      .select('id', 'email', 'phone_e164', 'full_name', 'is_active', 'created_at')
      .from('users')
      .where('id', '=', id)
      .whereNull('deleted_at')
      .executeTakeFirst(client);

    if (!user) return null;

    const roleRows = await db
      .select('r.code', 'r.name')
      .from('user_roles AS ur')
      .join('roles AS r', 'r.id', '=', 'ur.role_id')
      .where('ur.user_id', '=', id)
      .execute(client);

    user.roles = roleRows;
    return user;
  },

  /**
   * Creates a user and assigns roles in a transaction
   */
  async createUser(userData, roleCodes, client = null) {
    // 1. Insert user
    const newUser = await db
      .insertInto('users', {
        email: userData.email,
        phone_e164: userData.phone_e164,
        password_hash: userData.password_hash,
        full_name: userData.full_name,
        is_active: userData.is_active ?? true
      })
      .returning('id', 'email', 'phone_e164', 'full_name', 'is_active', 'created_at')
      .executeTakeFirst(client);

    // 2. Fetch role IDs for the requested codes
    if (roleCodes && roleCodes.length > 0) {
      const roles = await db
        .select('id', 'code')
        .from('roles')
        .whereIn('code', roleCodes)
        .execute(client);

      const userRoleRows = roles.map(r => ({
        user_id: newUser.id,
        role_id: r.id
      }));

      if (userRoleRows.length > 0) {
        await db.insertInto('user_roles', userRoleRows).execute(client);
      }
      newUser.roles = roles.map(r => r.code);
    }

    return newUser;
  },

  /**
   * Updates user and reassigns roles
   */
  async updateUser(id, updateData, roleCodes, client = null) {
    if (Object.keys(updateData).length > 0) {
      await db
        .update('users', {
          ...updateData,
          updated_at: new Date()
        })
        .where('id', '=', id)
        .execute(client);
    }

    if (roleCodes) {
      // Clear existing roles
      await db.deleteFrom('user_roles').where('user_id', '=', id).execute(client);

      const roles = await db
        .select('id', 'code')
        .from('roles')
        .whereIn('code', roleCodes)
        .execute(client);

      const userRoleRows = roles.map(r => ({
        user_id: id,
        role_id: r.id
      }));

      if (userRoleRows.length > 0) {
        await db.insertInto('user_roles', userRoleRows).execute(client);
      }
    }

    return this.findById(id, client);
  }
};

export default userRepository;
