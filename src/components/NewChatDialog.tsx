import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MessageSquarePlus, User, Loader2 } from "lucide-react";
// [NOTE] Uncomment this import in your real project:
// import { supabase } from "../integrations/supabase/client";

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
    if (open) {
      fetchFriends();
    }
  }, [open, currentUser]);

  const fetchFriends = async () => {
    setIsLoading(true);
    try {
      // --- SUPABASE LOGIC (Uncomment this block in your real project) ---
      /*
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
      */

      // --- MOCK DATA FOR PREVIEW (Remove this block in your real project) ---
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
      const mockId = currentUser?.id || "current-user-id";
      setFriends([
        {
          id: "1",
          requester_id: mockId,
          receiver_id: "friend1",
          status: "accepted",
          receiver: { id: "friend1", username: "Sarah Parker", avatar_url: null },
          requester: { id: mockId, username: "Me", avatar_url: null }
        },
        {
          id: "2",
          requester_id: "friend2",
          receiver_id: mockId,
          status: "accepted",
          receiver: { id: mockId, username: "Me", avatar_url: null },
          requester: { id: "friend2", username: "Mike Johnson", avatar_url: null }
        },
        {
          id: "3",
          requester_id: mockId,
          receiver_id: "friend3",
          status: "accepted",
          receiver: { id: "friend3", username: "Alex Chen", avatar_url: null },
          requester: { id: mockId, username: "Me", avatar_url: null }
        }
      ]);
      // ------------------------------------------------------------

    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredFriends = friends.filter((friend) => {
    // Logic to determine which profile is the "friend" (not the current user)
    const currentId = currentUser?.id || "current-user-id";
    const friendProfile = friend.requester_id === currentId
      ? friend.receiver 
      : friend.requester;
      
    return friendProfile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) || "";
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden border-border/60 shadow-2xl bg-card/95 backdrop-blur-md">
        
        {/* Header Section */}
        <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-full shrink-0">
               <MessageSquarePlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">New Message</DialogTitle>
              <DialogDescription>
                Select a friend to start a conversation.
              </DialogDescription>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search friends..."
              className="pl-9 bg-secondary/30 border-border/50 focus:bg-background transition-all duration-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </DialogHeader>

        {/* Friends List */}
        <ScrollArea className="h-[320px]">
          <div className="p-3 space-y-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                <span className="text-sm font-medium">Loading your connections...</span>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
                <div className="h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
                  <User className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground/80">
                  {searchQuery ? "No matching friends found." : "No friends yet."}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                  {searchQuery 
                    ? "Try a different spelling." 
                    : "Go to the 'Connections' tab to add people to your network!"}
                </p>
              </div>
            ) : (
              filteredFriends.map((connection) => {
                const currentId = currentUser?.id || "current-user-id";
                const isRequester = connection.requester_id === currentId;
                const friendProfile = isRequester ? connection.receiver : connection.requester;
                // Generate consistent initials
                const initials = friendProfile?.username?.slice(0, 2).toUpperCase() || "??";

                return (
                  <button
                    key={connection.id}
                    onClick={() => {
                      onSelectFriend(connection);
                      onOpenChange(false);
                    }}
                    className="w-full group flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/20 text-left border border-transparent hover:border-border/40"
                  >
                    <Avatar className="h-10 w-10 border border-border/50 group-hover:border-primary/30 transition-colors">
                      <AvatarImage src={friendProfile?.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-medium text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                          {friendProfile?.username}
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground truncate opacity-80 group-hover:opacity-100 transition-opacity">
                        Click to start chatting
                      </p>
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

export default NewChatDialog;