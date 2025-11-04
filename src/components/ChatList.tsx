import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User as UserIcon, LogOut, UserCircle, Users, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ActiveChat, ChatConnection } from "@/types/chat"; 
import type { Tables } from "@/integrations/supabase/types";

type ConnectionWithProfiles = Omit<ChatConnection, "otherUser">;

interface ChatListProps {
  user: User; 
  onSelectChat: (chat: ActiveChat) => void;
  activeChatId: string | null;
}

const ChatList = ({ user, onSelectChat, activeChatId }: ChatListProps) => {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<ConnectionWithProfiles[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFriends = async () => {
      // This guard is from our previous fix and is still correct
      if (!user) {
        setLoading(false); 
        return;
      }
      
      setLoading(true);
      const { data, error } = await supabase
        .from("connections")
        .select(`
          id,
          status,
          requester:requester_id (id, username, avatar_url),
          receiver:receiver_id (id, username, avatar_url),
          conversations ( id )
        `)
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`); 

      if (error) {
        console.error("Error fetching friends:", error);
        toast({ title: "Error", description: "Failed to load friends list.", variant: "destructive" });
      } else {
        setFriends(data as unknown as ConnectionWithProfiles[]);
      }
      setLoading(false);
    };

    fetchFriends();
  }, [user, toast]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getOtherUser = (conn: ConnectionWithProfiles) => {
    return conn.requester.id === user.id ? conn.receiver : conn.requester;
  };

  return (
    <aside className="w-full md:w-1/3 lg:w-1/4 h-full flex flex-col bg-card border-r">
      <header className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ConnectSphere
          </h1>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/connections")}>
              <Users className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
              <UserCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <nav className="p-2 space-y-1">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start h-16 gap-3 p-2",
                activeChatId === "ai" && "bg-secondary"
              )}
              onClick={() => onSelectChat({ type: "ai", id: "ai" })}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-md">AI Assistant</span>
            </Button>

            {friends.map((conn) => {
              const otherUser = getOtherUser(conn);
              
              // === THIS IS THE FIX ===
              // We now safely check if 'conn.conversations' is an array AND has an item
              const conversationId = (conn.conversations && conn.conversations.length > 0)
                ? conn.conversations[0].id
                : null;
              // ========================
              
              if (!conversationId) {
                // This will gracefully hide any friend for whom the chat room isn't ready yet.
                // It will appear on the next page load.
                return null; 
              }

              return (
                <Button
                  key={conn.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-16 gap-3 p-2",
                    activeChatId === conn.id && "bg-secondary"
                  )}
                  onClick={() => onSelectChat({ 
                    type: "user", 
                    id: conn.id, 
                    data: { ...conn, otherUser }
                  })}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={otherUser.avatar_url || ''} />
                    <AvatarFallback><UserIcon /></AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-md">{otherUser.username}</span>
                </Button>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
};

export default ChatList;