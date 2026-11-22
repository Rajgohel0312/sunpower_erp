/**
 * WhatsApp Automated Solar Inquiry Bot & Conversation Thread Manager
 * 
 * 1. The connected device acts as the live WhatsApp bot for any customer who messages it.
 * 2. Manages real conversation threads with full message histories.
 * 3. Supports live staff customer support from the PC (human takeover & staff replies).
 * 4. Automatically captures leads into SunPower ERP via crmService.
 */

import { crmService } from '../crm/crm.service.js';
import { prisma } from '../../database/prisma.js';
import { whatsappGateway } from './whatsapp.gateway.js';

class WhatsAppBot {
  constructor() {
    this.threads = new Map(); // phone -> thread object
    this.processedMessageIds = new Set();

    // Hook into gateway incoming messages from the connected device
    whatsappGateway.onMessage((msg) => this.handleIncomingMessage(msg));
  }

  /**
   * Retrieves or initializes a conversation thread for a phone number
   */
  async getOrCreateThread(phoneRaw, remoteJid = null, senderName = null) {
    const cleanDigits = phoneRaw.replace(/[^0-9]/g, '');
    const phone = cleanDigits || phoneRaw;

    // Check if thread exists under exact key or suffix (e.g. matching 10 digits)
    let existingKey = this.threads.has(phone) ? phone : null;
    if (!existingKey && phone.length >= 10) {
      const suffix = phone.slice(-10);
      for (const [key] of this.threads.entries()) {
        if (key.length >= 10 && (key.endsWith(suffix) || suffix.endsWith(key.slice(-10)))) {
          existingKey = key;
          break;
        }
      }
    }

    if (!existingKey) {
      const thread = {
        phone,
        remoteJid: remoteJid || (phone.includes('@') ? phone : `${phone}@s.whatsapp.net`),
        name: senderName || 'Solar Inquirer',
        leadNumber: null,
        leadId: null,
        botEnabled: true,
        agentConnected: false,
        agentName: null,
        state: 'IDLE',
        lastActive: Date.now(),
        unread: 0,
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        messages: []
      };
      this.threads.set(phone, thread);

      // Async lookup for existing CRM Lead or Customer in DB
      this.enrichThreadFromDatabase(thread).catch((e) =>
        console.warn('[WhatsApp Bot]: DB lookup warning:', e.message)
      );
      return thread;
    }

    const thread = this.threads.get(existingKey);
    if (remoteJid) thread.remoteJid = remoteJid;
    if (senderName && (thread.name === 'Solar Inquirer' || !thread.name)) {
      thread.name = senderName;
    }
    return thread;
  }

  /**
   * Enriches thread with matched CRM Lead or Customer
   */
  async enrichThreadFromDatabase(thread) {
    const cleanDigits = thread.phone.slice(-10);
    const phoneNormalized = `+${thread.phone}`;

    // 1. Check existing Customer
    const customer = await prisma.customers.findFirst({
      where: {
        OR: [
          { phone_e164: phoneNormalized },
          { phone_e164: { contains: cleanDigits } }
        ],
        deleted_at: null
      }
    });

    if (customer) {
      thread.name = customer.full_name;
      thread.customerId = customer.id;
      thread.customerCode = customer.customer_code;
      return;
    }

    // 2. Check existing Lead
    const lead = await prisma.leads.findFirst({
      where: {
        OR: [
          { phone_e164: phoneNormalized },
          { phone_e164: { contains: cleanDigits } }
        ]
      },
      orderBy: { created_at: 'desc' }
    });

    if (lead) {
      thread.name = lead.full_name;
      thread.leadNumber = lead.lead_number;
      thread.leadId = lead.id;
      thread.leadStage = lead.stage;
    }
  }

  /**
   * Main entry point for processing incoming messages from the connected device
   */
  async handleIncomingMessage(msg) {
    const { id, from, remoteJid, senderName, text, fromMe, timestamp } = msg;

    // Deduplication check
    if (id && this.processedMessageIds.has(id)) return;
    if (id) {
      this.processedMessageIds.add(id);
      if (this.processedMessageIds.size > 1000) {
        const first = this.processedMessageIds.values().next().value;
        this.processedMessageIds.delete(first);
      }
    }

    const phone = from.replace(/[^0-9]/g, '');
    const cleanText = (text || '').trim();
    if (!cleanText) return;

    const thread = await this.getOrCreateThread(phone, remoteJid, senderName);

    // If message was sent from our own phone (physical device), just record it in chat thread
    if (fromMe) {
      const existing = thread.messages.find(m => m.id === id);
      if (!existing) {
        thread.messages.push({
          id: id || `me-${Date.now()}`,
          text: cleanText,
          direction: 'OUTBOUND',
          sender: 'PHONE',
          senderName: 'Connected Phone',
          timestamp: timestamp || new Date().toISOString()
        });
        thread.lastMessage = cleanText;
        thread.lastMessageTime = timestamp || new Date().toISOString();
      }
      return;
    }

    // Append customer message to thread history
    const customerMsg = {
      id: id || `in-${Date.now()}`,
      text: cleanText,
      direction: 'INBOUND',
      sender: 'CUSTOMER',
      senderName: senderName || thread.name,
      timestamp: timestamp || new Date().toISOString()
    };
    thread.messages.push(customerMsg);
    thread.lastMessage = cleanText;
    thread.lastMessageTime = customerMsg.timestamp;
    thread.unread += 1;
    thread.lastActive = Date.now();

    // Check if user requested human support or reset
    const lower = cleanText.toLowerCase();
    if (['menu', 'help', 'hi', 'hello', 'hey', 'start', 'restart', '0'].includes(lower)) {
      thread.state = 'IDLE';
    }

    // If an agent is connected or bot is disabled, do not auto-reply
    if (thread.agentConnected || !thread.botEnabled) {
      console.log(`[WhatsApp Bot]: Chat with ${phone} has an active agent session (agentConnected: ${thread.agentConnected}, botEnabled: ${thread.botEnabled}). Skipping bot auto-reply.`);
      return;
    }

    // Process Bot Conversation Engine
    try {
      console.log(`[WhatsApp Bot]: 🤖 Processing state "${thread.state}" for input: "${cleanText}" from ${phone}`);

      switch (thread.state) {
        case 'IDLE':
          await this.handleIdleMenu(thread, cleanText, senderName);
          break;

        case 'COLLECTING_INQUIRY':
          await this.handleInquiryDetails(thread, cleanText, senderName);
          break;

        case 'HUMAN_HANDOVER':
          // Customer is in human handover mode; notify them staff will assist directly from PC
          await this.sendBotReply(thread, "👨‍💼 A SunPower solar consultant has been alerted and will respond directly to this chat from our desktop desk shortly.\n\n_Reply *MENU* at any time to return to the options._");
          break;

        default:
          thread.state = 'IDLE';
          await this.replyMainMenu(thread, senderName);
          break;
      }
    } catch (err) {
      console.error('[WhatsApp Bot Engine Error]:', err.message);
      await this.sendBotReply(thread, "Apologies, we encountered an error processing your message. Reply *MENU* to view options.");
    }
  }

  /**
   * Main menu greeting
   */
  async replyMainMenu(thread, name) {
    const greeting = name ? `Hello *${name}*!` : 'Hello!';
    const text = `
☀ *Welcome to SunPower Solar!* ☀
${greeting} Power your home or business with clean green solar energy.

Please reply with an option number:
1️⃣ *New Solar Rooftop Inquiry* (Instant estimation)
2️⃣ *Track Project / Order Status*
3️⃣ *Warranty & Technical Support*
4️⃣ *Speak to an Energy Consultant*

_Reply with 1, 2, 3, or 4_
    `.trim();

    await this.sendBotReply(thread, text);
  }

  /**
   * Handles user menu selection from IDLE state
   */
  async handleIdleMenu(thread, input, name) {
    const choice = input.trim();

    if (choice === '1' || choice.includes('inquiry') || choice.includes('rooftop')) {
      thread.state = 'COLLECTING_INQUIRY';
      const prompt = `
🌞 *Instant Rooftop Solar Estimation*

To help us size your solar plant accurately, please reply with your details in one message:
*Full Name, City, Monthly Electricity Bill (₹)*

_Example:_
*${name || 'Rajesh Patel'}, Ahmedabad, 8500*
      `.trim();
      await this.sendBotReply(thread, prompt);
      return;
    }

    if (choice === '2' || choice.includes('track') || choice.includes('order')) {
      await this.handleTrackProject(thread);
      return;
    }

    if (choice === '3' || choice.includes('warranty') || choice.includes('support')) {
      await this.handleSupportRequest(thread);
      return;
    }

    if (choice === '4' || choice.includes('human') || choice.includes('advisor') || choice.includes('consultant')) {
      thread.state = 'HUMAN_HANDOVER';
      await this.sendBotReply(thread, `👨‍💼 Thank you! Our senior solar advisor has been notified on the PC support desk. We will message you on this chat shortly.\n\n_Reply *MENU* anytime to return to the automated menu._`);
      return;
    }

    // Default to main menu
    await this.replyMainMenu(thread, name);
  }

  /**
   * Solicits solar inquiry details and automatically registers a Lead in SunPower ERP
   */
  async handleInquiryDetails(thread, input, senderName) {
    const parts = input.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);

    let customerName = senderName || thread.name || 'Solar Inquiry';
    let city = 'Ahmedabad';
    let monthlyBill = 6000;

    if (parts.length >= 3) {
      customerName = parts[0] || customerName;
      city = parts[1] || city;
      const numMatch = parts[2].replace(/[^0-9]/g, '');
      if (numMatch) monthlyBill = Number(numMatch);
    } else if (parts.length === 2) {
      customerName = parts[0];
      const numMatch = parts[1].replace(/[^0-9]/g, '');
      if (numMatch) monthlyBill = Number(numMatch);
    } else {
      const numMatch = input.replace(/[^0-9]/g, '');
      if (numMatch && numMatch.length >= 3) monthlyBill = Number(numMatch);
    }

    // Sizing estimation
    const kwCapacity = Math.max(1, Math.min(25, Number((monthlyBill / 1200).toFixed(1))));
    const estimatedSavings = Math.round(monthlyBill * 0.85);

    // Call domain service to create Lead in SunPower ERP
    let leadNumber = 'LED-2026-NEW';
    try {
      const systemUser = await prisma.users.findFirst({
        where: { is_active: true },
        orderBy: { created_at: 'asc' }
      });

      const botActor = {
        id: systemUser?.id,
        email: 'whatsapp-bot@sunpower.com',
        fullName: 'SunPower WhatsApp Bot'
      };

      const phoneNormalized = `+${thread.phone}`;

      if (botActor.id) {
        const lead = await crmService.createLead({
          full_name: customerName,
          phone_e164: phoneNormalized,
          city: city,
          state: 'Gujarat',
          source: 'WHATSAPP',
          monthly_electricity_bill: monthlyBill,
          requested_capacity_kw: kwCapacity,
          system_type: 'ON_GRID',
          notes: `Inquiry captured automatically via WhatsApp Connected Device. City: ${city}, Monthly Bill: ₹${monthlyBill}, Sizing: ${kwCapacity} kW.`
        }, botActor);

        if (lead && lead.lead_number) {
          leadNumber = lead.lead_number;
          thread.leadNumber = lead.lead_number;
          thread.leadId = lead.id;
          thread.name = customerName;
        }
      }
    } catch (crmErr) {
      console.warn('[WhatsApp Bot]: Could not create lead in CRM database:', crmErr.message);
    }

    const confirmation = `
🎉 *Thank you, ${customerName}!*
Your rooftop solar inquiry has been registered.

📋 *Inquiry Reference:* *${leadNumber}*
⚡ *Recommended System:* *${kwCapacity} kW On-Grid Rooftop*
💰 *Est. Monthly Savings:* *~₹${estimatedSavings.toLocaleString('en-IN')}/mo*
📍 *City:* ${city}

Our solar engineer will contact you shortly to schedule a free site survey.

_Reply *MENU* to view main options._
    `.trim();

    await this.sendBotReply(thread, confirmation, leadNumber);
    thread.state = 'IDLE';
  }

  /**
   * Tracks customer order / project milestone
   */
  async handleTrackProject(thread) {
    const cleanDigits = thread.phone.slice(-10);
    const phoneNormalized = `+${thread.phone}`;

    try {
      const customer = await prisma.customers.findFirst({
        where: {
          OR: [
            { phone_e164: phoneNormalized },
            { phone_e164: { contains: cleanDigits } }
          ],
          deleted_at: null
        },
        include: {
          sales_orders: {
            orderBy: { created_at: 'desc' },
            take: 1
          }
        }
      });

      if (!customer || !customer.sales_orders || customer.sales_orders.length === 0) {
        await this.sendBotReply(thread, `🔍 No active solar project was found for this phone number.\n\nReply *1* to submit a new inquiry or *4* to connect with our support desk.`);
        return;
      }

      const order = customer.sales_orders[0];
      const statusText = order.status === 'CONFIRMED' ? 'Confirmed & In Engineering' : order.status;

      const reply = `
📦 *Project Tracking: ${customer.full_name}*

Order Number: *${order.order_number}*
Status: *${statusText}*
Payment Status: *${order.payment_status}*
Grand Total: *₹${Number(order.grand_total).toLocaleString('en-IN')}*

You can also view your live project milestones, tax invoices, and warranties anytime on our Customer Portal:
http://localhost:5173/portal

_Reply *MENU* to view main options._
      `.trim();

      await this.sendBotReply(thread, reply);
    } catch (err) {
      await this.sendBotReply(thread, `Could not retrieve project status at this time. Please try again later or reply *4* for assistance.`);
    }
  }

  /**
   * Warranty & Support guidance
   */
  async handleSupportRequest(thread) {
    const text = `
🛠 *SunPower Warranty & Support Desk*

• Standard Solar Panels: *25-Year Performance Warranty*
• Solar Inverters: *5-Year Replacement Warranty*

To report an inverter fault, error code, or schedule maintenance:
1. Log in to your Customer Portal: http://localhost:5173/portal
2. Or reply *4* to chat with an on-duty technical engineer.

_Reply *MENU* to return to the main menu._
    `.trim();

    await this.sendBotReply(thread, text);
  }

  /**
   * Sends an automated reply from the bot through the connected device
   */
  async sendBotReply(thread, text, leadCreated = null) {
    const recipient = thread.remoteJid || thread.phone;
    console.log(`[WhatsApp Bot]: 🤖 Bot replying to ${recipient}: "${text.slice(0, 60)}..."`);

    // Send message through the real connected WhatsApp device
    const sendResult = await whatsappGateway.sendMessage(recipient, text);

    const botMsg = {
      id: sendResult.id || `bot-${Date.now()}`,
      text,
      direction: 'OUTBOUND',
      sender: 'BOT',
      senderName: 'SunPower Bot',
      timestamp: new Date().toISOString(),
      leadCreated
    };

    thread.messages.push(botMsg);
    thread.lastMessage = text;
    thread.lastMessageTime = botMsg.timestamp;
  }

  /**
   * Connects a live agent to the chat: automatically disables the bot and notifies customer
   */
  async connectAgent(phoneRaw, agentName = 'SunPower Support Agent') {
    const phone = phoneRaw.replace(/[^0-9]/g, '');
    const thread = await this.getOrCreateThread(phone);

    thread.agentConnected = true;
    thread.botEnabled = false; // Disable bot when agent connects
    thread.agentName = agentName;

    const noticeText = `👨‍💼 *${agentName}* has connected to this chat. You are now communicating directly with live customer support.`;
    const recipient = thread.remoteJid || thread.phone;

    try {
      const sendResult = await whatsappGateway.sendMessage(recipient, noticeText);
      const noticeMsg = {
        id: sendResult.id || `agent-join-${Date.now()}`,
        text: noticeText,
        direction: 'OUTBOUND',
        sender: 'SYSTEM',
        senderName: 'System',
        timestamp: new Date().toISOString()
      };
      thread.messages.push(noticeMsg);
      thread.lastMessage = noticeText;
      thread.lastMessageTime = noticeMsg.timestamp;
    } catch (e) {
      console.warn('[WhatsApp Bot]: Could not dispatch agent connect notice to WhatsApp:', e.message);
    }

    return thread;
  }

  /**
   * Disconnects the live agent: automatically re-enables the bot and notifies customer
   */
  async disconnectAgent(phoneRaw) {
    const phone = phoneRaw.replace(/[^0-9]/g, '');
    const thread = await this.getOrCreateThread(phone);

    thread.agentConnected = false;
    thread.botEnabled = true; // Re-enable bot when agent disconnects
    thread.agentName = null;

    const noticeText = `🤖 Live agent has disconnected. The automated assistant is re-enabled. Reply *MENU* at any time to view solar options.`;
    const recipient = thread.remoteJid || thread.phone;

    try {
      const sendResult = await whatsappGateway.sendMessage(recipient, noticeText);
      const noticeMsg = {
        id: sendResult.id || `agent-leave-${Date.now()}`,
        text: noticeText,
        direction: 'OUTBOUND',
        sender: 'SYSTEM',
        senderName: 'System',
        timestamp: new Date().toISOString()
      };
      thread.messages.push(noticeMsg);
      thread.lastMessage = noticeText;
      thread.lastMessageTime = noticeMsg.timestamp;
    } catch (e) {
      console.warn('[WhatsApp Bot]: Could not dispatch agent disconnect notice to WhatsApp:', e.message);
    }

    return thread;
  }

  /**
   * Sends a manual message from staff on the PC through the connected device
   */
  async sendStaffMessage(phoneRaw, text, staffUser = null) {
    const phone = phoneRaw.replace(/[^0-9]/g, '');
    const thread = await this.getOrCreateThread(phone);

    // If agent wasn't connected yet, automatically connect and disable bot
    if (!thread.agentConnected) {
      thread.agentConnected = true;
      thread.botEnabled = false;
      thread.agentName = staffUser?.fullName || staffUser?.full_name || staffUser?.email || 'Support Agent';
    }

    const recipient = thread.remoteJid || thread.phone;
    console.log(`[WhatsApp Bot]: 👤 Staff sending message to ${recipient}: "${text}"`);

    // Send through the real connected WhatsApp device
    const sendResult = await whatsappGateway.sendMessage(recipient, text);

    const staffName = staffUser?.fullName || staffUser?.full_name || staffUser?.email || 'Support Staff';

    const staffMsg = {
      id: sendResult.id || `staff-${Date.now()}`,
      text,
      direction: 'OUTBOUND',
      sender: 'STAFF',
      senderName: staffName,
      timestamp: new Date().toISOString()
    };

    thread.messages.push(staffMsg);
    thread.lastMessage = text;
    thread.lastMessageTime = staffMsg.timestamp;

    return staffMsg;
  }

  /**
   * Returns all conversation threads sorted by last activity
   */
  getThreads() {
    return Array.from(this.threads.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );
  }

  /**
   * Returns a specific thread by phone with suffix matching
   */
  getThread(phoneRaw) {
    const cleanDigits = phoneRaw.replace(/[^0-9]/g, '');
    const phone = cleanDigits || phoneRaw;
    let thread = this.threads.get(phone);
    if (!thread && phone.length >= 10) {
      const suffix = phone.slice(-10);
      for (const [key, val] of this.threads.entries()) {
        if (key.endsWith(suffix) || suffix.endsWith(key.slice(-10)) || val.remoteJid === phoneRaw) {
          thread = val;
          break;
        }
      }
    }
    if (thread) {
      thread.unread = 0; // Mark as read when opened
    }
    return thread;
  }

  /**
   * Toggles bot auto-reply for a specific conversation thread
   */
  setBotEnabled(phoneRaw, enabled) {
    const phone = phoneRaw.replace(/[^0-9]/g, '');
    let thread = this.threads.get(phone);
    if (!thread && phone.length >= 10) {
      const suffix = phone.slice(-10);
      for (const [key, val] of this.threads.entries()) {
        if (key.endsWith(suffix) || suffix.endsWith(key.slice(-10))) {
          thread = val;
          break;
        }
      }
    }
    if (thread) {
      thread.botEnabled = Boolean(enabled);
      return thread;
    }
    return null;
  }
}

export const whatsappBot = new WhatsAppBot();
export default whatsappBot;
