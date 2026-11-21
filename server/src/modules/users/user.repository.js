/**
 * User & Role Management Database Repository
 * Powered by Prisma ORM (@prisma/client)
 */

import { prisma } from '../../database/index.js';

export const userRepository = {
  /**
   * List users with pagination and search
   */
  async listUsers({ page = 1, limit = 25, search, role }, tx = null) {
    const client = tx || prisma;
    const where = {
      deleted_at: null
    };

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone_e164: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.user_roles = {
        some: {
          roles: {
            code: role
          }
        }
      };
    }

    const [rows, total] = await Promise.all([
      client.users.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone_e164: true,
          full_name: true,
          is_active: true,
          created_at: true,
          user_roles: {
            include: {
              roles: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      client.users.count({ where })
    ]);

    const users = rows.map((u) => {
      const roles = u.user_roles ? u.user_roles.map((ur) => ur.roles.code) : [];
      const { user_roles, ...rest } = u;
      return {
        ...rest,
        roles
      };
    });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  /**
   * Find user by ID with roles
   */
  async findById(id, tx = null) {
    const client = tx || prisma;
    const user = await client.users.findFirst({
      where: {
        id,
        deleted_at: null
      },
      select: {
        id: true,
        email: true,
        phone_e164: true,
        full_name: true,
        is_active: true,
        created_at: true,
        user_roles: {
          include: {
            roles: true
          }
        }
      }
    });

    if (!user) return null;

    const roles = user.user_roles.map(ur => ({
      code: ur.roles.code,
      name: ur.roles.name
    }));

    const { user_roles, ...userWithoutJunction } = user;
    return {
      ...userWithoutJunction,
      roles
    };
  },

  /**
   * Creates a user and assigns roles in a transaction
   */
  async createUser(userData, roleCodes, tx = null) {
    const client = tx || prisma;

    const roles = roleCodes && roleCodes.length > 0
      ? await client.roles.findMany({ where: { code: { in: roleCodes } } })
      : [];

    const newUser = await client.users.create({
      data: {
        email: userData.email,
        phone_e164: userData.phone_e164,
        password_hash: userData.password_hash,
        full_name: userData.full_name,
        is_active: userData.is_active ?? true,
        user_roles: {
          create: roles.map(r => ({ role_id: r.id }))
        }
      },
      select: {
        id: true,
        email: true,
        phone_e164: true,
        full_name: true,
        is_active: true,
        created_at: true
      }
    });

    newUser.roles = roles.map(r => r.code);
    return newUser;
  },

  /**
   * Updates user and reassigns roles
   */
  async updateUser(id, updateData, roleCodes, tx = null) {
    const client = tx || prisma;

    if (roleCodes) {
      await client.user_roles.deleteMany({ where: { user_id: id } });
      const roles = await client.roles.findMany({ where: { code: { in: roleCodes } } });
      if (roles.length > 0) {
        await client.user_roles.createMany({
          data: roles.map(r => ({ user_id: id, role_id: r.id }))
        });
      }
    }

    if (updateData && Object.keys(updateData).length > 0) {
      await client.users.update({
        where: { id },
        data: {
          ...updateData,
          updated_at: new Date()
        }
      });
    }

    return this.findById(id, client);
  }
};

export default userRepository;
