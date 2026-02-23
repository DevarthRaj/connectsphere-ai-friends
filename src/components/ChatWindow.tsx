import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User as UserIcon, Send, Video, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
type Profile = Tables<"profiles">;

interface ChatWindowProps {
  user: User;
  connection: any;
}

const emotionColors: Record<string, string> = {
  joy: "#FFD700",
  anger: "#ff0000ff",
  sadness: "#1E90FF",
  neutral: "#11ce66ff"
};

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

  // Fetch old messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!conversationId) return;

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
      }

      setLoading(false);
    };

    fetchMessages();
  }, [conversationId]);

  // Realtime listener
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
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 🔥 MODIFIED SEND FUNCTION
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId) return;

    const content = newMessage.trim();
    setNewMessage("");

    try {
      // 1️⃣ Call ML API
      const res = await fetch("http://44.223.0.97:8000/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: content })
      });

      const data = await res.json();
      const emotion = data.emotion;

      // 2️⃣ Store message with emotion
      const { error } = await supabase
        .from("messages")
        .insert({
          content,
          sender_id: user.id,
          conversation_id: conversationId,
          emotion
        });

      if (error) throw error;

    } catch (err) {
      toast({
        title: "Error",
        description: "Message failed to send.",
        variant: "destructive"
      });
      setNewMessage(content);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user.id;

          const bgColor = msg.emotion
            ? emotionColors[msg.emotion] || "#cccccc"
            : isMe
              ? "#7c3aed"
              : "rgba(255,255,255,0.1)";

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                style={{
                  background: bgColor
                }}
                className="max-w-[70%] p-3 rounded-2xl text-sm text-white"
              >
                <p>{msg.content}</p>
                <span className="text-[10px] opacity-60 block mt-1 text-right">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="p-4 border-t">
        <form onSubmit={handleSend} className="flex gap-3">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <Button type="submit" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </footer>
    </div>
  );
};

export default ChatWindow;