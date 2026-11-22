import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappGateway } from '../../src/modules/whatsapp/whatsapp.gateway.js';
import { whatsappBot } from '../../src/modules/whatsapp/whatsapp.bot.js';
import { whatsappService } from '../../src/modules/whatsapp/whatsapp.service.js';
import { prisma } from '../../src/database/prisma.js';

describe('WhatsApp Connected Device Bot & Live PC Support Desk', () => {
  test('1. WhatsApp Gateway initial status is DISCONNECTED with clean state', () => {
    const status = whatsappGateway.getStatus();
    assert.ok(status);
    assert.ok(['DISCONNECTED', 'CONNECTING', 'SCAN_QR'].includes(status.status));
  });

  test('2. Customer messaging our connected device receives interactive solar menu', async () => {
    const testPhone = '919988776655';
    await whatsappBot.handleIncomingMessage({
      id: `test-msg-${Date.now()}`,
      from: testPhone,
      senderName: 'Aditya Test',
      text: 'Hello SunPower',
      timestamp: new Date().toISOString()
    });

    const thread = whatsappBot.getThread(testPhone);
    assert.ok(thread, 'Thread must exist for customer');
    assert.ok(thread.messages.length >= 2, 'Must have inbound and outbound reply');

    const botReply = thread.messages.find(m => m.sender === 'BOT');
    assert.ok(botReply);
    assert.ok(botReply.text.includes('Welcome to SunPower Solar'));
    assert.ok(botReply.text.includes('New Solar Rooftop Inquiry'));
  });

  test('3. Option 1 advances conversation to COLLECTING_INQUIRY', async () => {
    const testPhone = '919988776655';
    await whatsappBot.handleIncomingMessage({
      id: `test-msg-opt1-${Date.now()}`,
      from: testPhone,
      senderName: 'Aditya Test',
      text: '1',
      timestamp: new Date().toISOString()
    });

    const thread = whatsappBot.getThread(testPhone);
    const botReply = thread.messages[thread.messages.length - 1];

    assert.ok(botReply);
    assert.equal(botReply.sender, 'BOT');
    assert.ok(botReply.text.includes('Instant Rooftop Solar Estimation'));
  });

  test('4. Submitting inquiry details creates Lead in CRM and confirms reference number', async () => {
    const testPhone = '919876500099';
    // 1. Select option 1
    await whatsappBot.handleIncomingMessage({
      id: `test-f1-${Date.now()}`,
      from: testPhone,
      senderName: 'Nikhil Mehta',
      text: '1'
    });

    // 2. Provide details
    await whatsappBot.handleIncomingMessage({
      id: `test-f2-${Date.now()}`,
      from: testPhone,
      senderName: 'Nikhil Mehta',
      text: 'Nikhil Mehta, Rajkot, 11000'
    });

    const thread = whatsappBot.getThread(testPhone);
    const lastMsg = thread.messages[thread.messages.length - 1];

    assert.ok(lastMsg.text.includes('Inquiry Reference'));
    assert.ok(lastMsg.text.includes('Nikhil Mehta'));

    // Verify in PostgreSQL database
    const lead = await prisma.leads.findFirst({
      where: {
        full_name: 'Nikhil Mehta',
        source: 'WHATSAPP'
      }
    });

    assert.ok(lead);
    assert.equal(lead.city, 'Rajkot');
    assert.equal(Number(lead.monthly_electricity_bill), 11000);
  });

  test('5. Staff can send live messages from PC through the connected device', async () => {
    const testPhone = '919876500099';
    const staffMsg = await whatsappService.sendStaffMessage({
      to: testPhone,
      message: 'Hello Nikhil, our engineer will visit your terrace tomorrow at 11 AM.',
      actor: { full_name: 'Admin Desk' }
    });

    assert.ok(staffMsg);
    assert.equal(staffMsg.sender, 'STAFF');

    const thread = whatsappBot.getThread(testPhone);
    const lastMsg = thread.messages[thread.messages.length - 1];
    assert.equal(lastMsg.sender, 'STAFF');
    assert.equal(lastMsg.text, 'Hello Nikhil, our engineer will visit your terrace tomorrow at 11 AM.');
  });

  test('6. Staff can toggle bot auto-reply to take over conversation', async () => {
    const testPhone = '919876500099';
    const thread = await whatsappService.setBotEnabled(testPhone, false);
    assert.equal(thread.botEnabled, false);

    // Customer sends message while bot is paused
    await whatsappBot.handleIncomingMessage({
      id: `cust-msg-${Date.now()}`,
      from: testPhone,
      senderName: 'Nikhil Mehta',
      text: 'Can I pay in cash?'
    });

    // Verify bot DID NOT auto-reply
    const updatedThread = whatsappBot.getThread(testPhone);
    const lastMsg = updatedThread.messages[updatedThread.messages.length - 1];
    assert.equal(lastMsg.sender, 'CUSTOMER');
    assert.equal(lastMsg.text, 'Can I pay in cash?');
  });
});
