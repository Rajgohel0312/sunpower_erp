/**
 * WhatsApp Baileys Gateway Adapter for SunPower ERP
 * Encapsulates WebSocket connection lifecycle, multi-file auth credentials,
 * QR code generation, incoming message unwrapping, and reconnect logic.
 */

import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';

/**
 * Recursively unwraps WhatsApp message payload to extract raw text content
 */
function extractMessageText(message) {
  if (!message) return '';
  if (message.ephemeralMessage?.message) {
    return extractMessageText(message.ephemeralMessage.message);
  }
  if (message.viewOnceMessage?.message) {
    return extractMessageText(message.viewOnceMessage.message);
  }
  if (message.viewOnceMessageV2?.message) {
    return extractMessageText(message.viewOnceMessageV2.message);
  }
  if (message.documentWithCaptionMessage?.message) {
    return extractMessageText(message.documentWithCaptionMessage.message);
  }

  // 1. Text & Conversational
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;

  // 2. Interactive & Template Responses
  if (message.interactiveMessage?.body?.text) return message.interactiveMessage.body.text;
  if (message.interactiveResponseMessage?.body?.text) return message.interactiveResponseMessage.body.text;
  if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId;
  if (message.buttonsResponseMessage?.selectedDisplayText) return message.buttonsResponseMessage.selectedDisplayText;
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) return message.listResponseMessage.singleSelectReply.selectedRowId;
  if (message.listResponseMessage?.title) return message.listResponseMessage.title;
  if (message.templateButtonReplyMessage?.selectedId) return message.templateButtonReplyMessage.selectedId;

  // 3. Media Attachments with or without captions
  if (message.imageMessage) {
    return message.imageMessage.caption ? `📷 ${message.imageMessage.caption}` : '📷 [Photo Attached]';
  }
  if (message.documentMessage) {
    const fn = message.documentMessage.fileName || 'file';
    return `📄 [Document: ${fn}]`;
  }
  if (message.audioMessage) {
    return '🎙 [Voice Message]';
  }
  if (message.videoMessage) {
    return message.videoMessage.caption ? `🎥 ${message.videoMessage.caption}` : '🎥 [Video Attached]';
  }
  if (message.locationMessage) {
    return `📍 [Location Shared: ${message.locationMessage.degreesLatitude}, ${message.locationMessage.degreesLongitude}]`;
  }
  if (message.contactMessage) {
    return `👤 [Contact Shared: ${message.contactMessage.displayName || ''}]`;
  }

  return '';
}

class WhatsAppGateway {
  constructor() {
    this.sock = null;
    this.status = 'DISCONNECTED'; // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED'
    this.qrCodeDataUrl = null;
    this.rawQr = null;
    this.device = null;
    this.lastError = null;
    this.messageListeners = [];
    this.authDir = path.resolve(config.STORAGE_ROOT || './storage', 'whatsapp', 'auth');
  }

  /**
   * Initializes / starts the Baileys connection socket
   */
  async connect() {
    if (this.status === 'CONNECTED' && this.sock) {
      return this.getStatus();
    }

    try {
      this.status = 'CONNECTING';
      this.lastError = null;

      // Ensure auth storage folder exists
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      const silentLogger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        auth: state,
        logger: silentLogger,
        printQRInTerminal: true, // Also print QR in console terminal for convenience
        browser: ['SunPower ERP', 'Chrome', '1.0.0'],
        syncFullHistory: false
      });

      // Handle credentials updates
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates (QR generation & open/close)
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.rawQr = qr;
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 6,
              color: {
                dark: '#0f172a',
                light: '#ffffff'
              }
            });
            this.status = 'SCAN_QR';
            console.log('\n======================================================');
            console.log('📱 [WhatsApp Gateway]: Live QR code ready for scanning!');
            console.log('Open WhatsApp on your phone -> Linked Devices -> Link a Device');
            console.log('======================================================\n');
          } catch (qrErr) {
            console.error('[WhatsApp Gateway]: Error converting QR to image:', qrErr.message);
          }
        }

        if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrCodeDataUrl = null;
          this.rawQr = null;

          const rawId = this.sock.user?.id || '';
          const phone = rawId.split(':')[0] || rawId.split('@')[0];
          const name = this.sock.user?.name || 'SunPower Solar Bot';

          this.device = {
            id: rawId,
            phone: phone ? `+${phone}` : 'Connected Device',
            name,
            connectedAt: new Date().toISOString()
          };

          console.log('\n======================================================');
          console.log(`✅ [WhatsApp Gateway]: Connected as ${this.device.phone} (${this.device.name})`);
          console.log('Your device is now acting as the 24/7 SunPower Solar WhatsApp Bot!');
          console.log('======================================================\n');
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.warn(`[WhatsApp Gateway]: Connection closed (status: ${statusCode}, shouldReconnect: ${shouldReconnect})`);

          if (statusCode === DisconnectReason.loggedOut) {
            this.status = 'DISCONNECTED';
            this.device = null;
            this.qrCodeDataUrl = null;
            this.rawQr = null;
            this.sock = null;
            // Clean up session folder upon logout
            try {
              if (fs.existsSync(this.authDir)) {
                fs.rmSync(this.authDir, { recursive: true, force: true });
              }
            } catch (rmErr) {
              console.warn('[WhatsApp Gateway]: Error cleaning auth files:', rmErr.message);
            }
          } else if (shouldReconnect) {
            this.status = 'CONNECTING';
            setTimeout(() => this.connect(), 3000);
          } else {
            this.status = 'DISCONNECTED';
          }
        }
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!Array.isArray(messages)) return;

        for (const msg of messages) {
          if (!msg.message) continue;

          const fromJid = msg.key.remoteJid || '';
          // Ignore status broadcasts and group chats
          if (fromJid === 'status@broadcast' || fromJid.endsWith('@g.us')) continue;

          const rawText = extractMessageText(msg.message);
          if (!rawText.trim()) continue;

          // For 1-on-1 private chats, remoteJid is always the customer / conversation partner
          const partnerJid = (fromJid.endsWith('@lid') && msg.key.participant && !msg.key.participant.endsWith('@lid'))
            ? msg.key.participant
            : fromJid;
          const phone = partnerJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || fromJid.split('@')[0];
          const senderName = msg.pushName || (msg.key.fromMe ? 'Connected Phone' : 'Customer');

          const normalizedMessage = {
            id: msg.key.id,
            from: phone,
            remoteJid: fromJid,
            senderName,
            text: rawText.trim(),
            fromMe: Boolean(msg.key.fromMe),
            timestamp: new Date(Number(msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString()
          };

          console.log(`[WhatsApp Gateway]: 📥 Received message from ${fromJid} (${senderName}): "${normalizedMessage.text}"`);

          // Dispatch to subscribers
          for (const listener of this.messageListeners) {
            try {
              await listener(normalizedMessage);
            } catch (err) {
              console.error('[WhatsApp Gateway]: Error in message listener:', err.message);
            }
          }
        }
      });

      return this.getStatus();
    } catch (err) {
      console.error('[WhatsApp Gateway]: Failed to initialize Baileys:', err.message);
      this.status = 'DISCONNECTED';
      this.lastError = err.message;
      return this.getStatus();
    }
  }

  /**
   * Disconnects and unlinks the device
   */
  async disconnect() {
    try {
      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (e) {
          this.sock.end(new Error('Manual disconnect'));
        }
      }

      this.status = 'DISCONNECTED';
      this.device = null;
      this.qrCodeDataUrl = null;
      this.rawQr = null;
      this.sock = null;

      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }

      console.log('[WhatsApp Gateway]: Device successfully disconnected and unlinked.');
      return this.getStatus();
    } catch (err) {
      console.error('[WhatsApp Gateway]: Error during disconnect:', err.message);
      this.status = 'DISCONNECTED';
      return this.getStatus();
    }
  }

  /**
   * Sends an outbound text message to a specific JID or phone number
   */
  async sendMessage(to, text) {
    if (!this.sock || this.status !== 'CONNECTED') {
      console.log(`[WhatsApp (Offline Dev Mode)]: To: ${to} | Text: ${text.slice(0, 60)}...`);
      return { success: true, simulated: true, id: `offline-${Date.now()}` };
    }

    try {
      // Determine exact JID
      let jid = to;
      if (!jid.includes('@')) {
        const cleaned = to.replace(/[^0-9]/g, '');
        jid = `${cleaned}@s.whatsapp.net`;
      }

      console.log(`[WhatsApp Gateway]: 📤 Dispatched message to ${jid}: "${text.slice(0, 50)}..."`);
      const result = await this.sock.sendMessage(jid, { text });
      return { success: true, id: result?.key?.id || `msg-${Date.now()}` };
    } catch (err) {
      console.error(`[WhatsApp Gateway]: ❌ Error sending message to ${to}:`, err.message);
      throw err;
    }
  }

  /**
   * Registers a callback for incoming messages
   */
  onMessage(callback) {
    this.messageListeners.push(callback);
  }

  /**
   * Returns current gateway status
   */
  getStatus() {
    return {
      status: this.status,
      qrCodeDataUrl: this.status === 'SCAN_QR' ? this.qrCodeDataUrl : null,
      device: this.device,
      lastError: this.lastError
    };
  }
}

export const whatsappGateway = new WhatsAppGateway();
export default whatsappGateway;
