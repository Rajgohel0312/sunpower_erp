/**
 * User & Role Management Express Router
 */

import { Router } from 'express';
import { userController } from './user.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  queryUserSchema
} from './user.schemas.js';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get(
  '/',
  requirePermission('users:read'),
  validate({ query: queryUserSchema }),
  userController.listUsers
);

userRouter.get(
  '/:id',
  requirePermission('users:read'),
  userController.getUser
);

userRouter.post(
  '/',
  requirePermission('users:manage'),
  validate({ body: createUserSchema }),
  userController.createUser
);

userRouter.put(
  '/:id',
  requirePermission('users:manage'),
  validate({ body: updateUserSchema }),
  userController.updateUser
);

export default userRouter;
