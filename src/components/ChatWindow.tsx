import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User as UserIcon, Send, Video, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

// Define the types we need
type Message = Tables<"messages">;
type Profile = Tables<"profiles">;
type ConnectionWithProfiles = Tables<"connections"> & {
  requester: Pick<Profile, "id" | "username" | "avatar_url">;
  receiver: Pick<Profile, "id" | "username" | "avatar_url">;
  conversations: { id: string }[];
  otherUser: Pick<Profile, "id" | "username" | "avatar_url">;
};

interface ChatWindowProps {
  user: User;
  connection: ConnectionWithProfiles;
}

const ChatWindow = ({ user, connection }: ChatWindowProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  
  const conversationId = connection.conversations[0]?.id;
  const otherUser = connection.otherUser;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch historical messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!conversationId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      
      const { data, error }= await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        toast({ title: "Error", description: "Failed to load messages.", variant: "destructive" });
      } else {
        setMessages(data);
      }
      setLoading(false);
    };
    fetchMessages();
  }, [conversationId, toast]);

  // 2. Listen for NEW messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat_room_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages((currentMessages) => [...currentMessages, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // 3. Scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 4. Handle send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !conversationId) return;

    const content = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase
      .from("messages")
      .insert({
        content: content,
        sender_id: user.id,
        conversation_id: conversationId,
      });

    if (error) {
      toast({ title: "Error", description: "Message failed to send.", variant: "destructive" });
      setNewMessage(content); // Put the failed message back
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
      </div>
    );
  }
  
  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-white/50 bg-white/5 px-6 py-3 rounded-full backdrop-blur-md border border-white/10">
          This connection has no chat room.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative bg-transparent">
      {/* Header - Glass Effect */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10 border-2 border-purple-500/30 ring-2 ring-purple-500/10">
              <AvatarImage src={otherUser.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <UserIcon className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">{otherUser.username}</h1>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-xs text-white/50">Online</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => toast({ title: "Voice call coming soon!"})}>
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => toast({ title: "Video call coming soon!"})}>
              <Video className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user.id;
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
            >
              {!isMe && (
                <Avatar className="h-8 w-8 border border-white/10 mb-1">
                  <AvatarImage src={otherUser.avatar_url || ''} />
                  <AvatarFallback className="bg-indigo-900/50 text-white text-xs">
                    <UserIcon className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[75%] md:max-w-[60%] p-3.5 rounded-2xl text-sm shadow-lg backdrop-blur-sm border ${
                  isMe
                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-none border-transparent shadow-purple-500/10"
                    : "bg-white/10 text-white rounded-bl-none border-white/10 shadow-black/20"
                }`}
              >
                <p className="leading-relaxed">{msg.content}</p>
                <span className={`text-[10px] block mt-1 ${isMe ? "text-white/50 text-right" : "text-white/30"}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area - Glass Effect */}
      <footer className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl">
        <form onSubmit={handleSend} className="flex gap-3 items-center relative">
          <Input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50 h-12 rounded-xl pl-4 pr-12 shadow-inner"
          />
          <Button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="absolute right-1.5 h-9 w-9 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </footer>
    </div>
  );
};

export default ChatWindow;