import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, Send, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface AnalyticsData {
  totalSales: number;
  totalCommission: number;
  totalOrders: number;
  totalVendors: number;
  aov: number;
  totalRefunds: number;
  topVendors: { shopName: string; name: string; sales: number; orders: number }[];
  ordersByStatus: Record<string, number>;
  salesByMonth: { month: string; sales: number; commission: number; orders: number }[];
  topCategories: { categoryId: string; earnings: number }[];
}

interface AnalyticsAIChatProps {
  analyticsData: AnalyticsData | null;
  dateRange: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AnalyticsAIChat: React.FC<AnalyticsAIChatProps> = ({ analyticsData, dateRange }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    'Summarize this period',
    'Which vendor is leading?',
    'Any categories declining?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.askAnalyticsAI(textToSend, analyticsData, dateRange);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: unknown) {
      console.error('Failed to get answer from AI:', err);
      const userFriendlyErrorMessage = err instanceof Error ? err.message : 'AI assistant is temporarily unavailable.';
      
      const systemErrorMessage: Message = {
        role: 'assistant',
        content: `❌ Error: ${userFriendlyErrorMessage}`
      };
      setMessages(prev => [...prev, systemErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.15 }}
            className="w-[340px] sm:w-[380px] bg-card/95 border border-primary/20 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 font-display font-bold text-foreground">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                <span>AI Analytics Assistant</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-white/10"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            
            {/* Content Container */}
            <div className="p-4 flex flex-col">
              {/* Hint alert */}
              <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-secondary/30 p-2.5 rounded-lg border border-white/5 mb-3">
                <AlertCircle className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span>Analyzing {dateRange} loaded data. Updates on date filter changes.</span>
              </div>

              {/* Chat log */}
              <div className="h-[260px] overflow-y-auto mb-3 space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <MessageSquare className="h-8 w-8 text-primary/40 mb-2" />
                    <p className="text-sm font-medium">No questions asked yet.</p>
                    <p className="text-xs max-w-xs mt-1">Ask questions like: "which category has highest sales?" or click one of the suggested prompts below.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3.5 py-2 text-xs leading-relaxed ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground font-medium rounded-tr-none' 
                            : msg.content.startsWith('❌ Error:')
                              ? 'bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-none font-medium'
                              : 'bg-secondary text-foreground rounded-tl-none border border-white/5 whitespace-pre-line'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-secondary text-foreground rounded-lg rounded-tl-none border border-white/5 px-3.5 py-2 text-xs flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                      <span className="text-muted-foreground font-medium text-[11px]">AI is analyzing your data...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Prompt Suggestions */}
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors font-medium cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Form Input */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="flex items-center gap-2 mt-1"
              >
                <input
                  type="text"
                  placeholder="Ask a question about loaded metrics..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  maxLength={500}
                  className="flex-1 min-w-0 bg-secondary/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={isLoading || !input.trim()}
                  className="h-8 w-8 rounded-lg flex-shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button Trigger */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 flex items-center justify-center border border-primary/30 cursor-pointer focus:outline-none"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 45, opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="sparkles"
              initial={{ rotate: 45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -45, opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex items-center justify-center"
            >
              <Sparkles className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default AnalyticsAIChat;
