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

// --- INTERNAL COMPONENT: NewChatDialog (Deep Glass Style) ---
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
          receiver:receiver_id(id, username, avatar_url),
          conversations(id)
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
      {/* Glass Dialog Content */}
      <DialogContent className="sm:max-w-[425px] bg-[#1a1a2e]/90 border-white/10 text-white backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Select a Friend</DialogTitle>
        </DialogHeader>
        
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
          <Input
            placeholder="Search friends..."
            className="pl-8 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-purple-500 focus-visible:border-purple-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <ScrollArea className="h-[300px] mt-4 pr-4">
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center text-sm text-white/50 p-4">Loading friends...</div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center text-sm text-white/50 p-4">
                {searchQuery ? "No friends found." : "No friends yet. Go to 'Connections' to add people!"}
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
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors text-left group"
                  >
                    <Avatar className="border border-white/10 group-hover:border-purple-500/50 transition-colors">
                      <AvatarImage src={friendProfile?.avatar_url} />
                      <AvatarFallback className="bg-purple-900/50 text-purple-200">
                        {friendProfile?.username?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-medium truncate text-white group-hover:text-purple-300 transition-colors">
                        {friendProfile?.username}
                      </h4>
                      <p className="text-xs text-white/50">Click to start chatting</p>
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

// --- MAIN COMPONENT: ChatList (Deep Glass Style) ---

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

  // FIX: Self-Healing Chat Logic with "Check First" Strategy
  const handleStartChat = async (conn: any) => {
    const otherUser = conn.requester_id === user.id ? conn.receiver : conn.requester;
    let conversationId = conn.conversations?.[0]?.id;

    if (!conversationId) {
      try {
        // 1. Check if conversation already exists (avoids 409 Conflict)
        const { data: existingConvo, error: fetchError } = await supabase
          .from('conversations')
          .select('id')
          .eq('connection_id', conn.id)
          .maybeSingle(); // maybeSingle returns null instead of error if not found

        if (existingConvo) {
            conversationId = existingConvo.id;
        } else {
            // 2. If not found, THEN create it
            const { data: newConvo, error: createError } = await supabase
            .from('conversations')
            .insert({ connection_id: conn.id })
            .select()
            .single();
            
            if (createError) {
                // If we hit a race condition (extremely rare), catch it here
                if (createError.code === '23505') {
                    const { data: retryConvo } = await supabase
                        .from('conversations')
                        .select('id')
                        .eq('connection_id', conn.id)
                        .single();
                    if (retryConvo) conversationId = retryConvo.id;
                } else {
                    throw createError;
                }
            } else if (newConvo) {
                conversationId = newConvo.id;
            }
        }
        
        fetchFriends(); // Refresh local list
      } catch (err) {
        console.error("Failed to prepare chat:", err);
        toast({ title: "Error", description: "Could not start chat.", variant: "destructive" });
        return;
      }
    }

    if (conversationId) {
        onSelectChat({ 
            type: "user", 
            id: conn.id, 
            data: { ...conn, conversations: [{ id: conversationId }], otherUser } 
        });
    }
  };

  return (
    // Sidebar Container - Glass Effect
    <aside className="w-full md:w-1/3 lg:w-1/4 h-full flex flex-col bg-black/20 backdrop-blur-xl border-r border-white/10 relative">
      <header className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ConnectSphere
          </h1>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate("/connections")}>
              <Users className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate("/profile")}>
              <UserCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
        ) : (
          <nav className="p-2 space-y-1">
            {/* AI Assistant Button */}
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start h-16 gap-3 p-2 rounded-xl border border-transparent transition-all duration-200",
                activeChatId === "ai" 
                  ? "bg-purple-600/20 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] text-white" 
                  : "text-white/80 hover:bg-white/5 hover:border-white/5 hover:text-white"
              )}
              onClick={() => onSelectChat({ type: "ai", id: "ai" })}
            >
              <Avatar className="h-10 w-10 ring-2 ring-purple-500/20">
                <AvatarFallback className="bg-gradient-to-tr from-indigo-500 to-purple-500 text-white">
                  <Bot className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-md">AI Assistant</span>
                <span className="text-xs text-white/50 font-normal">Always here to help</span>
              </div>
            </Button>

            <div className="text-xs font-semibold text-white/40 px-2 pt-2 mb-2 uppercase tracking-wider">
              Friends
            </div>

            {/* Friend List */}
            {friends.map((conn) => {
              const otherUser = getOtherUser(conn);
              
              return (
                <Button
                  key={conn.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-16 gap-3 p-2 rounded-xl border border-transparent transition-all duration-200",
                    activeChatId === conn.id 
                        ? "bg-white/10 border-white/10 shadow-lg backdrop-blur-md text-white" 
                        : "text-white/80 hover:bg-white/5 hover:border-white/5 hover:text-white"
                  )}
                  onClick={() => handleStartChat(conn)}
                >
                  <Avatar className="h-10 w-10 border border-white/10">
                    <AvatarImage src={otherUser.avatar_url || ''} />
                    <AvatarFallback className="bg-indigo-900/50 text-indigo-200">
                      <UserIcon className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start overflow-hidden w-full">
                    <span className="font-semibold text-md truncate w-full text-left">
                      {otherUser.username}
                    </span>
                    <span className="text-xs text-white/50 truncate w-full text-left font-normal">
                      Click to chat
                    </span>
                  </div>
                </Button>
              );
            })}
            
            {friends.length === 0 && (
              <div className="text-center p-6 text-white/40 text-sm italic">
                No friends yet.<br/>Click the + button to add some!
              </div>
            )}
          </nav>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-6 right-6 z-10">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all hover:scale-110 hover:shadow-purple-500/25 border border-white/10"
          onClick={() => setIsNewChatOpen(true)}
        >
          <Plus className="h-6 w-6 text-white" />
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