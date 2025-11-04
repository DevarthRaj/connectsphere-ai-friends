import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User as UserIcon, Send, Video } from "lucide-react";
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
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Error: This connection has no chat room.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="border-b bg-card p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src={otherUser.avatar_url || ''} />
              <AvatarFallback><UserIcon /></AvatarFallback>
            </Avatar>
            <h1 className="text-xl font-bold">{otherUser.username}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => toast({ title: "Coming soon!"})}>
            <Video className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end gap-2 ${
              msg.sender_id === user.id ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender_id !== user.id && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={otherUser.avatar_url || ''} />
                <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
              </Avatar>
            )}
            <div
              className={`max-w-xs md:max-w-md p-3 rounded-lg ${
                msg.sender_id === user.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary"
              }`}
            >
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t bg-card">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
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