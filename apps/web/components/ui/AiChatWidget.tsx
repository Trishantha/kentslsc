'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: 'Hi! I am the Kent SLSC assistant. Ask me about events, memberships, or the club.' }
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: input }]);
    setInput('');
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'assistant', text: 'I am still learning about the club. Please contact us for detailed help.' }]);
    }, 800);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="glass-card mb-3 flex h-96 w-80 flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-neon-blue/20 to-neon-gold/20 px-4 py-3">
              <span className="font-semibold">AI Assistant</span>
              <button onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[80%] rounded-xl px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'ml-auto bg-neon-blue text-white'
                      : 'bg-white/20 dark:bg-black/20'
                  )}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask something..."
                className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
              />
              <button onClick={send} className="rounded-lg bg-neon-blue p-2 text-slate-900">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="btn-primary h-12 w-12 rounded-full shadow-neon"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </motion.button>
    </div>
  );
}
