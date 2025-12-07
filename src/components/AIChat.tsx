import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, Sparkles, Bot, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY; 

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
            "apikey": anonKey
          },
          body: JSON.stringify({
            messages: [...messages, userMessage] 
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response, 
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative bg-transparent">
      {/* Header - Glass Effect */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              AI Assistant
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200">BETA</span>
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
              <span className="text-xs text-white/50">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.map((msg, index) => {
          const isMe = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex items-end gap-3 ${isMe ? "justify-end" : "justify-start"}`}
            >
              {!isMe && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] md:max-w-[70%] p-4 rounded-2xl text-sm shadow-lg backdrop-blur-sm border ${
                  isMe
                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-none border-transparent shadow-purple-500/10"
                    : "bg-black/40 text-white/90 rounded-bl-none border-white/10 shadow-black/20"
                }`}
              >
                {/* We use 'whitespace-pre-wrap' so the AI's formatting (paragraphs, code blocks) 
                   is preserved and legible.
                */}
                <p className="leading-relaxed whitespace-pre-wrap font-light tracking-wide">
                  {msg.content}
                </p>
              </div>

              {isMe && (
                <div className="h-8 w-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white shrink-0">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shrink-0 animate-pulse">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-black/40 border border-white/10 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </main>

      {/* Input Area - Glass Effect */}
      <footer className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="flex gap-3 items-center relative">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask anything..."
            autoComplete="off"
            disabled={isLoading}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50 h-12 rounded-xl pl-4 pr-12 shadow-inner transition-all hover:bg-white/10"
          />
          <Button 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 h-9 w-9 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            size="icon"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-white/20 uppercase tracking-widest">Powered by Google Gemini</p>
        </div>
      </footer>
    </div>
  );
};

export default AIChat;