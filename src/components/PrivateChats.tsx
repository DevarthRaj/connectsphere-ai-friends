import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Video, Loader2, User as UserIcon } from "lucide-react";
import ChatWindow from "./ChatWindow";
import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// This is our new, more robust type that matches the single-query data
interface FriendConnection {
  id: string; // The connection ID
  conversation_id: string | null; // The associated conversation ID
  otherUser: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

// FIX #1: We now accept 'user' as a prop
const PrivateChats = ({ user }: { user: User }) => {
  const [connections, setConnections] = useState<FriendConnection[]>([]);
  const [selectedChat, setSelectedChat] = useState<FriendConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchConnections = async () => {
      if (!user) return; // Don't run if the user prop isn't ready
      setLoading(true);

      try {
        // FIX #2: This is now a single, efficient query
        const { data, error } = await supabase
          .from("connections")
          .select(`
            id,
            conversations ( id ), 
            requester:requester_id (id, username, avatar_url),
            receiver:receiver_id (id, username, avatar_url)
          `)
          .eq("status", "accepted")
          .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

        if (error) throw error;

        // Now we format the data on the client side
        const formattedConnections = (data || []).map((conn: any) => {
          // The 'conversations' property will be an array, we need the first (and only) item
          const conversation = conn.conversations[0];
          return {
            id: conn.id,
            otherUser: conn.requester.id === user.id ? conn.receiver : conn.requester,
            conversation_id: conversation?.id || null,
          };
        });

        setConnections(formattedConnections);
      } catch (error: any) {
        toast({
          title: "Error loading chats",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, [user, toast]); // FIX #1: Re-run when the user prop changes

  if (loading) {
    return (
      <Card className="shadow-medium">
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  // The ChatWindow needs a valid conversation_id to work
  if (selectedChat && selectedChat.conversation_id) {
    return <ChatWindow connection={selectedChat} onBack={() => setSelectedChat(null)} />;
  }

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Your Chats
        </CardTitle>
        <CardDescription>
          Chat with your connected users
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No connections yet. Find people to start chatting!
          </p>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => (
              <Card key={connection.id} className="bg-secondary/50 hover:bg-secondary transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={connection.otherUser.avatar_url || ''} />
                        <AvatarFallback><UserIcon /></AvatarFallback>
                      </Avatar>
                      <p className="font-semibold">{connection.otherUser.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (connection.conversation_id) {
                            setSelectedChat(connection);
                          } else {
                            toast({ title: "Error", description: "Conversation not found for this user." });
                          }
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Chat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast({ title: "Coming soon!", description: "Video calling is under development." })}
                      >
                        <Video className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 

export default PrivateChats;