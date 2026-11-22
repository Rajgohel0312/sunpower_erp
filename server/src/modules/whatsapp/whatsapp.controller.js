/**
 * WhatsApp Controller for SunPower ERP
 */

import { whatsappService } from './whatsapp.service.js';
import { sendSuccess, AppError } from '../../utils/response.js';
import { z } from 'zod';

const sendMessageSchema = z.object({
  to: z.string().min(6, 'Valid phone number is required'),
  message: z.string().min(1, 'Message cannot be empty')
});

const toggleBotSchema = z.object({
  enabled: z.boolean()
});

const simulateMessageSchema = z.object({
  from: z.string().default('919876543210'),
  senderName: z.string().default('Aditya Sharma'),
  text: z.string().min(1, 'Text message is required')
});

export const whatsappController = {
  async getStatus(req, res, next) {
    try {
      const data = await whatsappService.getStatus();
      return sendSuccess(res, data, 'WhatsApp status retrieved');
    } catch (err) {
      next(err);
    }
  },

  async connect(req, res, next) {
    try {
      const data = await whatsappService.connect();
      return sendSuccess(res, data, 'WhatsApp gateway initialization requested');
    } catch (err) {
      next(err);
    }
  },

  async disconnect(req, res, next) {
    try {
      const data = await whatsappService.disconnect();
      return sendSuccess(res, data, 'WhatsApp gateway unlinked and disconnected');
    } catch (err) {
      next(err);
    }
  },

  async getThreads(req, res, next) {
    try {
      const threads = await whatsappService.getThreads();
      return sendSuccess(res, threads, 'Conversation threads retrieved');
    } catch (err) {
      next(err);
    }
  },

  async getThread(req, res, next) {
    try {
      const thread = await whatsappService.getThread(req.params.phone);
      return sendSuccess(res, thread, 'Thread retrieved');
    } catch (err) {
      next(err);
    }
  },

  async sendStaffMessage(req, res, next) {
    try {
      const to = req.params.phone || req.body.to;
      const message = req.body.message || req.body.text;

      const parse = sendMessageSchema.safeParse({ to, message });
      if (!parse.success) {
        throw new AppError('Invalid message input', 400, 'INVALID_INPUT', parse.error.format());
      }

      const result = await whatsappService.sendStaffMessage({
        to: parse.data.to,
        message: parse.data.message,
        actor: req.user
      });

      return sendSuccess(res, result, 'Message dispatched from connected WhatsApp device');
    } catch (err) {
      next(err);
    }
  },

  async toggleBot(req, res, next) {
    try {
      const parse = toggleBotSchema.safeParse(req.body);
      if (!parse.success) {
        throw new AppError('Valid enabled flag is required', 400, 'INVALID_INPUT');
      }

      const thread = await whatsappService.setBotEnabled(req.params.phone, parse.data.enabled);
      return sendSuccess(res, thread, `Bot auto-reply ${parse.data.enabled ? 'resumed' : 'paused'}`);
    } catch (err) {
      next(err);
    }
  },

  async connectAgent(req, res, next) {
    try {
      const phone = req.params.phone;
      const agentName = req.user?.fullName || req.user?.full_name || 'SunPower Advisor';
      const thread = await whatsappService.connectAgent({ phone, agentName });
      return sendSuccess(res, thread, 'Agent connected to chat. Bot auto-reply disabled.');
    } catch (err) {
      next(err);
    }
  },

  async disconnectAgent(req, res, next) {
    try {
      const phone = req.params.phone;
      const thread = await whatsappService.disconnectAgent({ phone });
      return sendSuccess(res, thread, 'Agent disconnected. Bot auto-reply re-enabled.');
    } catch (err) {
      next(err);
    }
  },

  async simulateInboundMessage(req, res, next) {
    try {
      const parse = simulateMessageSchema.safeParse(req.body);
      if (!parse.success) {
        throw new AppError('Invalid simulation payload', 400, 'INVALID_INPUT', parse.error.format());
      }
      const result = await whatsappService.simulateInboundMessage(parse.data);
      return sendSuccess(res, result, 'Inbound message received on connected device');
    } catch (err) {
      next(err);
    }
  }
};

export default whatsappController;
