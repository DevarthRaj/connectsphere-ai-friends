import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search } from "lucide-react";
// Ensure this path matches your project structure. 
// If this fails, check if 'src/integrations/supabase/client.ts' exists.
import { supabase } from "../integrations/supabase/client";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFriend: (connection: any) => void;
  currentUser: any; // Changed to 'any' to fix build error
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
    return friendProfile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) || "";
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

export default NewChatDialog;