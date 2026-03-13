import React, { useMemo, useRef, useState, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2 } from 'lucide-react';

function SupportChatbot({ apiUrl, authState, userType }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const panelEndRef = useRef(null);

  const role = useMemo(() => {
    if (userType === 'recruiter') return 'recruiter';
    if (userType === 'superadmin') return 'superadmin';
    if (userType === 'candidate') return 'candidate';
    if (authState?.user?.userType) return authState.user.userType;
    return 'guest';
  }, [authState?.user?.userType, userType]);

  useEffect(() => {
    const greeting = role === 'recruiter'
      ? 'Hi! I can help you with candidate ranking, dashboard usage, filters, and hiring workflow questions.'
      : role === 'candidate'
        ? 'Hi! I can guide you through resume upload, quiz, interviews, scores, and profile completion.'
        : 'Hi! I can help both candidates and recruiters navigate TalentAI quickly.';

    setMessages([{ role: 'assistant', content: greeting }]);
  }, [role]);

  useEffect(() => {
    panelEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const streamAssistantMessage = async (text) => {
    const finalText = String(text || '').trim() || 'I am here to help. Could you rephrase your question?';
    let index = 0;
    const chunkSize = 4;

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    await new Promise((resolve) => {
      const timer = setInterval(() => {
        index += chunkSize;
        setMessages((prev) => {
          if (!prev.length) return prev;
          const clone = [...prev];
          clone[clone.length - 1] = {
            ...clone[clone.length - 1],
            content: finalText.slice(0, index),
          };
          return clone;
        });

        if (index >= finalText.length) {
          clearInterval(timer);
          resolve();
        }
      }, 18);
    });
  };

  const sendMessage = async () => {
    const query = input.trim();
    if (!query || loading) return;

    setInput('');
    const nextMessages = [...messages, { role: 'user', content: query }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          role,
          history: nextMessages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const raw = await response.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { success: false, reply: raw || 'Support service returned an invalid response.' };
      }

      const reply = data?.reply || data?.message || 'I could not process that request right now. Please try again.';
      await streamAssistantMessage(reply);
    } catch {
      await streamAssistantMessage('I am having trouble connecting right now. Please try again in a few seconds.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {open && (
        <div className="h-[70vh] w-[calc(100vw-1.5rem)] max-w-md rounded-2xl border border-white/15 bg-[#11152a]/95 shadow-2xl backdrop-blur-xl md:h-[560px]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#f97316]">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white md:text-base">TalentAI Support Bot</p>
                <p className="text-xs text-slate-400">Real-time assistant for candidates and recruiters</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          <div className="h-[calc(100%-8.4rem)] space-y-3 overflow-y-auto px-3 py-3 md:px-4">
            {messages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed md:text-base ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] text-white'
                      : 'bg-[#1a1f3c] text-slate-100 border border-white/10'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1f3c] px-3 py-2 text-xs text-slate-300 md:text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={panelEndRef} />
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about hiring flow, assessments, pricing..."
                className="h-11 w-full rounded-lg border border-white/15 bg-[#0f1221] px-3 text-sm text-white placeholder:text-slate-500 focus:border-[#7c3aed] focus:outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#f97316] text-white transition hover:bg-orange-500 disabled:opacity-50"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-[52px] min-w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#f97316] text-white shadow-xl transition hover:scale-105"
        aria-label="Open support chatbot"
      >
        <MessageCircle size={20} />
      </button>
    </div>
  );
}

export default SupportChatbot;
