/**
 * WhatsApp Gateway & Live Support Desk Routes for SunPower ERP
 */

import express from 'express';
import { whatsappController } from './whatsapp.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'SALES_EXECUTIVE', 'SALES_MANAGER', 'INVENTORY_MANAGER'));

// Device Link & Gateway lifecycle
router.get('/status', whatsappController.getStatus);
router.post('/connect', whatsappController.connect);
router.post('/disconnect', whatsappController.disconnect);

// Live Conversation Threads & Customer Support Desk
router.get('/threads', whatsappController.getThreads);
router.get('/threads/:phone', whatsappController.getThread);
router.post('/threads/:phone/send', whatsappController.sendStaffMessage);
router.post('/threads/:phone/toggle-bot', whatsappController.toggleBot);
router.post('/threads/:phone/agent-connect', whatsappController.connectAgent);
router.post('/threads/:phone/agent-disconnect', whatsappController.disconnectAgent);

// Direct Outbound & Developer Simulation
router.post('/send', whatsappController.sendStaffMessage);
router.post('/simulate', whatsappController.simulateInboundMessage);

export const whatsappRouter = router;
export default router;
