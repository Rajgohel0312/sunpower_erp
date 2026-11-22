import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import * as portalController from './portal.controller.js';

const router = Router();

// All portal routes require active authentication
router.use(authenticate);

router.get('/profile', portalController.getProfile);
router.get('/projects', portalController.getProjects);
router.get('/projects/:id', portalController.getProjectDetail);
router.get('/invoices', portalController.getInvoices);
router.get('/payments', portalController.getPayments);
router.get('/warranties', portalController.getWarranties);
router.get('/tickets', portalController.getTickets);
router.post('/tickets', portalController.createTicket);

// Staff trigger to onboard/re-send portal credentials to a customer
router.post('/invite/:customerId', async (req, res, next) => {
  try {
    const { ensureCustomerPortalUser } = await import('../orders/order.service.js');
    const result = await ensureCustomerPortalUser(req.params.customerId, req.user);
    return sendSuccess(res, result, { message: 'Customer portal credentials dispatched.' });
  } catch (err) {
    next(err);
  }
});

export default router;
