/**
 * WhatsApp Domain Service for SunPower ERP
 * Coordinates between the Baileys gateway socket, conversation threads,
 * and the live staff customer support chat desk.
 */

import { whatsappGateway } from './whatsapp.gateway.js';
import { whatsappBot } from './whatsapp.bot.js';
import { AppError } from '../../utils/response.js';

export const whatsappService = {
  /**
   * Retrieves connection state, QR code image, and connected device info
   */
  async getStatus() {
    return whatsappGateway.getStatus();
  },

  /**
   * Starts socket connection and triggers QR generation
   */
  async connect() {
    return await whatsappGateway.connect();
  },

  /**
   * Disconnects / unlinks the connected device
   */
  async disconnect() {
    return await whatsappGateway.disconnect();
  },

  /**
   * Returns all active conversation threads for the live support desk
   */
  async getThreads() {
    return whatsappBot.getThreads();
  },

  /**
   * Returns message history for a specific customer thread
   */
  async getThread(phone) {
    const thread = whatsappBot.getThread(phone);
    if (!thread) {
      throw new AppError('Conversation thread not found', 404, 'THREAD_NOT_FOUND');
    }
    return thread;
  },

  /**
   * Sends a manual message from staff on the PC through the connected device
   */
  async sendStaffMessage({ to, message, actor }) {
    if (!to || !message || !message.trim()) {
      throw new AppError('Destination phone number and message text are required', 400, 'INVALID_INPUT');
    }

    return await whatsappBot.sendStaffMessage(to, message.trim(), actor);
  },

  /**
   * Connects a live agent to the chat, automatically disabling the bot
   */
  async connectAgent({ phone, agentName }) {
    return await whatsappBot.connectAgent(phone, agentName);
  },

  /**
   * Disconnects the live agent from the chat, automatically re-enabling the bot
   */
  async disconnectAgent({ phone }) {
    return await whatsappBot.disconnectAgent(phone);
  },

  /**
   * Toggles bot auto-responder for a specific chat (e.g., when human takes over)
   */
  async setBotEnabled(phone, enabled) {
    const thread = whatsappBot.setBotEnabled(phone, enabled);
    if (!thread) {
      throw new AppError('Conversation thread not found', 404, 'THREAD_NOT_FOUND');
    }
    return thread;
  },

  /**
   * Simulates an incoming customer message for developer testing
   */
  async simulateInboundMessage({ from = '919876543210', senderName = 'Ravi Patel', text = 'Hi' }) {
    await whatsappBot.handleIncomingMessage({
      id: `sim-in-${Date.now()}`,
      from,
      senderName,
      text,
      timestamp: new Date().toISOString()
    });

    return whatsappBot.getThread(from);
  }
};

export default whatsappService;
