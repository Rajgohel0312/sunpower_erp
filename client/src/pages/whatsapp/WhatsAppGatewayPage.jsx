import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Send,
  MessageSquare,
  Bot,
  User,
  Power,
  Zap,
  ArrowRight,
  Search,
  Clock,
  ShieldCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import Badge from '../../components/common/Badge.jsx';
import { Link } from 'react-router-dom';

export default function WhatsAppGatewayPage() {
  const [gatewayStatus, setGatewayStatus] = useState({
    status: 'DISCONNECTED',
    qrCodeDataUrl: null,
    device: null,
    lastError: null
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [threads, setThreads] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);

  const messagesEndRef = useRef(null);
  const selectedPhoneRef = useRef(selectedPhone);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  // Polling for live connection status, conversation threads, and active chat messages
  useEffect(() => {
    fetchStatus();
    fetchThreads();

    const interval = setInterval(() => {
      fetchStatus(false);
      fetchThreads(false);
      // Real-time polling of currently open chat messages
      if (selectedPhoneRef.current) {
        fetchActiveThread(selectedPhoneRef.current);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Fetch active thread messages immediately when user selects a different chat
  useEffect(() => {
    if (selectedPhone) {
      fetchActiveThread(selectedPhone);
    }
  }, [selectedPhone]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread?.messages]);

  const fetchStatus = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await apiRequest('/whatsapp/status');
      if (res?.data) {
        setGatewayStatus(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch WhatsApp gateway status:', err.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchThreads = async (showSpinner = false) => {
    try {
      const res = await apiRequest('/whatsapp/threads');
      if (res?.data && Array.isArray(res.data)) {
        setThreads(res.data);
        // Auto-select first thread if none selected
        if (!selectedPhoneRef.current && res.data.length > 0) {
          setSelectedPhone(res.data[0].phone);
        }
      }
    } catch (err) {
      console.warn('Could not fetch conversation threads:', err.message);
    }
  };

  const fetchActiveThread = async (phone) => {
    try {
      const res = await apiRequest(`/whatsapp/threads/${phone}`);
      if (res?.data) {
        setActiveThread(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch thread details:', err.message);
    }
  };

  const handleStartConnect = async () => {
    setActionLoading(true);
    try {
      const res = await apiRequest('/whatsapp/connect', { method: 'POST' });
      if (res?.data) {
        setGatewayStatus(res.data);
      }
      setShowScannerModal(true);
    } catch (err) {
      alert('Failed to initialize WhatsApp gateway: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to unlink and log out this WhatsApp device?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiRequest('/whatsapp/disconnect', { method: 'POST' });
      if (res?.data) {
        setGatewayStatus(res.data);
      }
      setShowScannerModal(false);
    } catch (err) {
      alert('Failed to disconnect device: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendStaffReply = async (e) => {
    if (e) e.preventDefault();
    if (!selectedPhone || !replyText.trim() || sending) return;

    setSending(true);
    const textToSend = replyText.trim();
    setReplyText('');

    try {
      await apiRequest(`/whatsapp/threads/${selectedPhone}/send`, {
        method: 'POST',
        body: JSON.stringify({ message: textToSend })
      });
      await fetchActiveThread(selectedPhone);
      await fetchThreads();
    } catch (err) {
      alert('Failed to send reply to customer: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleConnectAgent = async () => {
    if (!selectedPhone || !activeThread) return;
    try {
      const res = await apiRequest(`/whatsapp/threads/${selectedPhone}/agent-connect`, {
        method: 'POST'
      });
      if (res?.data) {
        setActiveThread(res.data);
      }
      await fetchThreads();
    } catch (err) {
      alert('Could not connect agent: ' + err.message);
    }
  };

  const handleDisconnectAgent = async () => {
    if (!selectedPhone || !activeThread) return;
    try {
      const res = await apiRequest(`/whatsapp/threads/${selectedPhone}/agent-disconnect`, {
        method: 'POST'
      });
      if (res?.data) {
        setActiveThread(res.data);
      }
      await fetchThreads();
    } catch (err) {
      alert('Could not disconnect agent: ' + err.message);
    }
  };

  const handleToggleBot = async () => {
    if (!selectedPhone || !activeThread) return;
    const newStatus = !activeThread.botEnabled;

    try {
      const res = await apiRequest(`/whatsapp/threads/${selectedPhone}/toggle-bot`, {
        method: 'POST',
        body: JSON.stringify({ enabled: newStatus })
      });
      if (res?.data) {
        setActiveThread(res.data);
      }
    } catch (err) {
      alert('Could not toggle bot status: ' + err.message);
    }
  };

  const filteredThreads = threads.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      t.phone.includes(q) ||
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.leadNumber && t.leadNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-100 overflow-hidden">
      {/* 1. TOP HEADER & CONNECTION TERMINAL BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl shadow-xs">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              WhatsApp Live Support & 24/7 Solar Bot
            </h1>
            <p className="text-xs text-slate-500">
              Your connected phone acts as the 24/7 automated bot; staff can monitor and reply live from PC.
            </p>
          </div>
        </div>

        {/* Device Status Indicator */}
        <div className="flex items-center gap-3">
          {gatewayStatus.status === 'CONNECTED' && gatewayStatus.device ? (
            <div className="flex items-center gap-3 bg-emerald-50/80 border border-emerald-200 px-3.5 py-1.5 rounded-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <div className="text-xs">
                <span className="text-slate-500 font-medium">Device: </span>
                <strong className="text-emerald-900 font-mono">{gatewayStatus.device.phone}</strong>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-100/60 px-2 py-0.5 rounded transition"
                title="Unlink Phone"
              >
                Unlink
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-xs font-semibold text-amber-900">
                {gatewayStatus.status === 'SCAN_QR' ? 'Ready to Scan QR' : 'Device Not Linked'}
              </span>
              <button
                onClick={handleStartConnect}
                disabled={actionLoading}
                className="text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition shadow-xs flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                {actionLoading ? 'Connecting...' : 'Scan QR'}
              </button>
            </div>
          )}

          <button
            onClick={() => { fetchStatus(); fetchThreads(); }}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition"
            title="Refresh Chats"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. MAIN WHATSAPP WEB WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: ACTIVE CONVERSATIONS LIST */}
        <div className="w-80 sm:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
          {/* Search bar */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by phone, name, or lead..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Smartphone className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-medium">No customer chats yet.</p>
                <p className="text-[11px] text-slate-400">
                  When a customer sends a WhatsApp message to your linked phone, the chat will appear here live!
                </p>
              </div>
            ) : (
              filteredThreads.map((t) => {
                const isSelected = selectedPhone === t.phone;
                return (
                  <div
                    key={t.phone}
                    onClick={() => setSelectedPhone(t.phone)}
                    className={`p-3.5 cursor-pointer transition flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-emerald-50/70 border-l-4 border-emerald-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Contact Avatar */}
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
                      {t.name ? t.name.charAt(0).toUpperCase() : 'C'}
                    </div>

                    {/* Chat Snippet */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {t.name || `+${t.phone}`}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(t.lastMessageTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono mb-1">
                        +{t.phone}
                      </div>

                      <p className="text-xs text-slate-600 truncate">
                        {t.lastMessage || 'Conversation started'}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        {t.leadNumber && (
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                            {t.leadNumber}
                          </span>
                        )}
                        {t.agentConnected ? (
                          <span className="text-[9px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded-full">
                            👤 Agent Active (Bot OFF)
                          </span>
                        ) : t.botEnabled ? (
                          <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                            🤖 Bot Active
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full">
                            Bot Paused
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE CONVERSATION & SUPPORT CHAT DESK */}
        {activeThread ? (
          <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
            {/* Chat Room Header */}
            <div className="bg-white px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow">
                  {activeThread.name ? activeThread.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-sm text-slate-900">
                      {activeThread.name || `Customer (+${activeThread.phone})`}
                    </h2>
                    {activeThread.leadNumber && (
                      <Link
                        to="/leads"
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded hover:underline"
                        title="View CRM Lead"
                      >
                        {activeThread.leadNumber}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    +{activeThread.phone}
                  </p>
                </div>
              </div>

              {/* Agent Connection / Bot Control */}
              <div className="flex items-center gap-3">
                {activeThread.agentConnected ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                      Agent Connected (Bot Disabled)
                    </span>
                    <button
                      onClick={handleDisconnectAgent}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition shadow-xs cursor-pointer"
                      title="Disconnect agent and re-enable bot"
                    >
                      <Power className="w-3.5 h-3.5" />
                      Disconnect Agent (Enable Bot)
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      🤖 Bot Auto-Responding
                    </span>
                    <button
                      onClick={handleConnectAgent}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 transition shadow-xs cursor-pointer"
                      title="Connect agent to take over chat and disable bot"
                    >
                      <User className="w-3.5 h-3.5" />
                      Connect Agent (Disable Bot)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 p-6 overflow-y-auto space-y-3.5 bg-slate-100/90">
              {activeThread.messages && activeThread.messages.length > 0 ? (
                activeThread.messages.map((m, idx) => {
                  if (m.sender === 'SYSTEM') {
                    return (
                      <div key={m.id || idx} className="flex justify-center my-2">
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-200/90 px-3.5 py-1 rounded-full border border-slate-300 shadow-2xs">
                          {m.text}
                        </span>
                      </div>
                    );
                  }

                  const isCustomer = m.direction === 'INBOUND';
                  const isStaff = m.sender === 'STAFF';
                  const isBot = m.sender === 'BOT';
                  const isPhone = m.sender === 'PHONE';

                  return (
                    <div
                      key={m.id || idx}
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-xs whitespace-pre-wrap ${
                          isCustomer
                            ? 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
                            : isStaff
                            ? 'bg-midnight text-white rounded-tr-none'
                            : isPhone
                            ? 'bg-sky-700 text-white rounded-tr-none'
                            : 'bg-emerald-600 text-white rounded-tr-none'
                        }`}
                      >
                        <div className="text-[10px] font-semibold opacity-75 mb-1 flex items-center gap-1">
                          {isCustomer && <User className="w-3 h-3" />}
                          {isBot && <Bot className="w-3 h-3" />}
                          {isStaff && <User className="w-3 h-3" />}
                          {isPhone && <Smartphone className="w-3 h-3" />}
                          {isCustomer ? (m.senderName || activeThread.name) : isBot ? 'SunPower Bot' : isPhone ? 'Mobile WhatsApp' : `Staff: ${m.senderName || 'Admin'}`}
                        </div>

                        {m.text}

                        {m.leadCreated && (
                          <div className="mt-2 pt-2 border-t border-emerald-500/40 text-[11px] font-semibold flex items-center justify-between">
                            <span>CRM Lead Created:</span>
                            <span className="font-mono bg-white text-emerald-900 px-1.5 py-0.5 rounded shadow-xs">
                              {m.leadCreated}
                            </span>
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                        {new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No message history recorded yet for this conversation.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Staff Reply Bar (Sends real WhatsApp message from connected phone to customer) */}
            <form onSubmit={handleSendStaffReply} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                placeholder={`Reply to ${activeThread.name || 'customer'} from PC (sent via connected phone)...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 text-sm border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition shadow flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No Chat Selected</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Select a customer conversation from the left to view the live chat, monitor bot automated answers, or take over with direct staff support from PC.
            </p>
          </div>
        )}
      </div>

      {/* 3. POPUP MODAL: QR CODE SCANNER (Shown when clicking Scan QR) */}
      {(showScannerModal || gatewayStatus.status === 'SCAN_QR') && gatewayStatus.status !== 'CONNECTED' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <QrCode className="w-5 h-5 text-emerald-600" />
                Link WhatsApp Device
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* QR Image Box */}
            {gatewayStatus.qrCodeDataUrl ? (
              <div className="text-center space-y-4">
                <div className="relative inline-block p-4 bg-white border-2 border-emerald-500 rounded-2xl shadow-lg">
                  <img
                    src={gatewayStatus.qrCodeDataUrl}
                    alt="Scan with WhatsApp Linked Devices"
                    className="w-64 h-64 mx-auto rounded-lg"
                  />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow tracking-wider uppercase">
                    Scan with Phone
                  </div>
                </div>

                <div className="text-left bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                  <p className="font-semibold text-slate-800">Quick Steps:</p>
                  <p>1. Open <strong>WhatsApp</strong> on your mobile phone.</p>
                  <p>2. Tap <strong>Linked Devices</strong> (in Settings or ⋮ Menu).</p>
                  <p>3. Tap <strong>Link a Device</strong> and point your camera here.</p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-800">Initializing Baileys Gateway...</p>
                <p className="text-xs text-slate-500">Generating secure device authentication QR code.</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowScannerModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
