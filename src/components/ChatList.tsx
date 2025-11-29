import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// Use local client initialization to avoid path resolution errors
import { User, createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  LogOut, 
  UserCircle, 
  Users, 
  Bot, 
  Plus, 
  Search, 
  User as UserIcon 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ActiveChat, ChatConnection } from "@/types/chat"; 

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

// --- INTERNAL COMPONENT: NewChatDialog ---
interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFriend: (connection: any) => void;
  currentUser: any; 
}

const NewChatDialog = ({ open, onOpenChange, onSelectFriend, currentUser }: NewChatDialogProps) => {
  const [friends, setFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && currentUser) {
      fetchFriends();
    }
  }, [open, currentUser]);

  const fetchFriends = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('connections')
        .select(`
          *,
          requester:requester_id(id, username, avatar_url),
          receiver:receiver_id(id, username, avatar_url)
        `)
        .eq('status', 'accepted')
        .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredFriends = friends.filter((friend) => {
    const friendProfile = friend.requester_id === currentUser.id 
      ? friend.receiver 
      : friend.requester;
    
    const username = friendProfile?.username || "";
    return username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select a Friend</DialogTitle>
        </DialogHeader>
        
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search friends..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <ScrollArea className="h-[300px] mt-4">
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center text-sm text-muted-foreground p-4">Loading friends...</div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground p-4">
                {searchQuery ? "No friends found matching search." : "No friends found. Go to 'Connections' to add people!"}
              </div>
            ) : (
              filteredFriends.map((connection) => {
                const isRequester = connection.requester_id === currentUser.id;
                const friendProfile = isRequester ? connection.receiver : connection.requester;

                return (
                  <button
                    key={connection.id}
                    onClick={() => {
                      onSelectFriend(connection);
                      onOpenChange(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar>
                      <AvatarImage src={friendProfile?.avatar_url} />
                      <AvatarFallback>
                        {friendProfile?.username?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-medium truncate">{friendProfile?.username}</h4>
                      <p className="text-xs text-muted-foreground">Click to start chatting</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// --- MAIN COMPONENT: ChatList ---

type ConnectionWithProfiles = Omit<ChatConnection, "otherUser">;

interface ChatListProps {
  user: any; 
  onSelectChat: (chat: ActiveChat) => void;
  activeChatId: string | null;
}

const ChatList = ({ user, onSelectChat, activeChatId }: ChatListProps) => {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<ConnectionWithProfiles[]>([]);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchFriends();
    
    const channel = supabase
      .channel('chat_list_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        () => fetchFriends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchFriends = async () => {
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getOtherUser = (conn: ConnectionWithProfiles) => {
    return conn.requester.id === user.id ? conn.receiver : conn.requester;
  };

  // --- UPDATED SELF-HEALING CHAT STARTER ---
  const handleStartChat = async (conn: any) => {
    const otherUser = conn.requester_id === user.id ? conn.receiver : conn.requester;
    let conversationId = conn.conversations?.[0]?.id;

    if (!conversationId) {
      // No chat room locally? Check database or create one.
      try {
        const { data, error } = await supabase
          .from('conversations')
          .insert({ connection_id: conn.id })
          .select()
          .single();
        
        if (error) {
          // If we get error 23505, it means the row ALREADY exists!
          // We should just fetch it and use it.
          if (error.code === '23505') {
            console.log("Conversation already exists (duplicate key), fetching existing ID...");
            
            const { data: existingData, error: fetchError } = await supabase
              .from('conversations')
              .select('id')
              .eq('connection_id', conn.id)
              .single();
              
            if (fetchError || !existingData) {
               console.error("Critical error: Could not fetch existing chat", fetchError);
               throw fetchError;
            }
            conversationId = existingData.id;
          } else {
            throw error;
          }
        } else if (data) {
          conversationId = data.id;
        }
        
        fetchFriends(); 
      } catch (err) {
        console.error("Failed to prepare chat:", err);
        toast({ title: "Error", description: "Could not start chat.", variant: "destructive" });
        return;
      }
    }

    const updatedConnection = {
      ...conn,
      conversations: [{ id: conversationId }]
    };

    onSelectChat({ 
      type: "user", 
      id: conn.id, 
      data: { ...updatedConnection, otherUser } 
    });
  };

  return (
    <aside className="w-full md:w-1/3 lg:w-1/4 h-full flex flex-col bg-card border-r relative">
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
              
              return (
                <Button
                  key={conn.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-16 gap-3 p-2",
                    activeChatId === conn.id && "bg-secondary"
                  )}
                  onClick={() => handleStartChat(conn)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={otherUser.avatar_url || ''} />
                    <AvatarFallback><UserIcon /></AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="font-semibold text-md truncate w-full text-left">
                      {otherUser.username}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full text-left">
                      Click to chat
                    </span>
                  </div>
                </Button>
              );
            })}
            
            {friends.length === 0 && (
              <div className="text-center p-4 text-muted-foreground text-sm">
                No friends yet. Click the + button to add some!
              </div>
            )}
          </nav>
        )}
      </div>

      <div className="absolute bottom-6 right-6">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-all hover:scale-105"
          onClick={() => setIsNewChatOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <NewChatDialog 
        open={isNewChatOpen} 
        onOpenChange={setIsNewChatOpen}
        currentUser={user}
        onSelectFriend={(conn) => {
          handleStartChat(conn);
          setIsNewChatOpen(false);
        }}
      />
    </aside>
  );
};

export default ChatList;