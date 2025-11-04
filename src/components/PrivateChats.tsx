import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Video } from "lucide-react";
import ChatWindow from "./ChatWindow";
import { User } from "@supabase/supabase-js";

interface Connection {
  id: string;
  otherUser: {
    id: string;
    username: string;
  };
  conversation_id: string;
}

const PrivateChats = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedChat, setSelectedChat] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("connections")
        .select(`
          id,
          requester_id,
          receiver_id,
          requester:requester_id (id, username),
          receiver:receiver_id (id, username)
        `)
        .eq("status", "accepted")
        .or(`requester_id.eq.${user?.id},receiver_id.eq.${user?.id}`);

      if (error) throw error;

      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id, connection_id");

      if (convError) throw convError;

      const connectionsWithConversations = (data || []).map((conn: any) => {
        const conversation = conversations?.find(c => c.connection_id === conn.id);
        return {
          id: conn.id,
          otherUser: conn.requester_id === user?.id ? conn.receiver : conn.requester,
          conversation_id: conversation?.id || ""
        };
      });

      setConnections(connectionsWithConversations);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  if (loading) {
    return (
      <Card className="shadow-medium">
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  if (selectedChat) {
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
            No connections yet. Send connection requests to start chatting!
          </p>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => (
              <Card key={connection.id} className="bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{connection.otherUser.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setSelectedChat(connection)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Chat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: "Coming soon!",
                            description: "Video calling feature is under development.",
                          });
                        }}
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
