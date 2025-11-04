import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User as UserIcon, UserPlus, Check, X, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

// Define the types we'll be working with
type Profile = Tables<"profiles">;
// We need to create a custom type because our query will join the 'profiles' table
type ConnectionWithProfiles = Tables<"connections"> & {
  requester: Profile;
  receiver: Profile;
};

const Connections = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionWithProfiles[]>([]);
  const [friends, setFriends] = useState<ConnectionWithProfiles[]>([]);

  const { toast } = useToast();
  const navigate = useNavigate();

  // --- 1. DATA FETCHING ---

  // Fetch all connection data on page load
  useEffect(() => {
    const fetchUserAndConnections = async () => {
      setLoading(true);
      // First, get the current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      
      // Now, fetch all connections related to this user
      const { data: connections, error } = await supabase
        .from("connections")
        .select("*, requester:profiles(*), receiver:profiles(*)")
        .or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);

      if (error) {
        toast({ title: "Error", description: "Failed to load connections.", variant: "destructive" });
      } else if (connections) {
        // Sort the connections into two lists
        const pending: ConnectionWithProfiles[] = [];
        // === THIS TYPO IS NOW FIXED === //
        const accepted: ConnectionWithProfiles[] = []; 
        
        connections.forEach(conn => {
          if (conn.status === 'accepted') {
            accepted.push(conn as ConnectionWithProfiles);
          } else if (conn.status === 'pending' && conn.receiver_id === session.user.id) {
            // Only show pending requests where *I* am the receiver
            pending.push(conn as ConnectionWithProfiles);
          }
        });

        setFriends(accepted);
        setPendingRequests(pending);
      }
      setLoading(false);
    };

    fetchUserAndConnections();
  }, [navigate, toast]);

  // --- 2. ACTION HANDLERS ---

  // Search for users
  const handleSearch = async () => {
    if (searchTerm.length < 3) {
      toast({ title: "Search too short", description: "Please enter at least 3 characters." });
      return;
    }
    if (!user) return; // Should never happen, but a good guard

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .like("username", `%${searchTerm}%`)
      .neq("id", user.id) // Don't show myself in search results
      .limit(10);

    if (error) {
      toast({ title: "Search Error", description: error.message, variant: "destructive" });
    } else {
      setSearchResults(data);
    }
  };

  // Send a new friend request
  const sendRequest = async (receiverId: string) => {
    if (!user) return;

    // Check if we already have a connection (pending or accepted)
    const existingConnection = [...friends, ...pendingRequests].find(
      conn => (conn.requester_id === user.id && conn.receiver_id === receiverId) ||
              (conn.receiver_id === user.id && conn.requester_id === receiverId)
    );
    
    if (existingConnection) {
      toast({ title: "Already Connected", description: "You are already friends or have a pending request.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("connections")
      .insert({
        requester_id: user.id,
        receiver_id: receiverId,
        // 'status' defaults to 'pending' from your SQL
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Friend request sent!" });
      setSearchResults(prev => prev.filter(p => p.id !== receiverId)); // Remove from search results
    }
  };

  // Accept a friend request
  const acceptRequest = async (connectionId: string) => {
    // === THIS TYPO IS NOW FIXED === //
    const { error } = await supabase
      .from("connections")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", connectionId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Friend Added!", description: "You are now connected." });
      // Move the connection from 'pending' to 'friends'
      const acceptedRequest = pendingRequests.find(req => req.id === connectionId);
      if (acceptedRequest) {
        setPendingRequests(prev => prev.filter(req => req.id !== connectionId));
        setFriends(prev => [...prev, { ...acceptedRequest, status: 'accepted' }]);
      }
    }
  };

  // Decline a friend request or remove a friend
  const removeConnection = async (connectionId: string) => {
    const { error } = await supabase
      .from("connections")
      .delete()
      .eq("id", connectionId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Connection Removed" });
      // Remove from both lists, just in case
      setPendingRequests(prev => prev.filter(req => req.id !== connectionId));
      setFriends(prev => prev.filter(friend => friend.id !== connectionId));
    }
  };

  // --- 3. RENDER ---

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Helper to get the *other* person in a connection
  const getOtherUser = (connection: ConnectionWithProfiles): Profile => {
    return connection.requester_id === user.id ? connection.receiver : connection.requester;
  };

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-6">Manage Connections</h1>

      <Tabs defaultValue="friends">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            <Users className="mr-2 h-4 w-4" /> Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            <UserPlus className="mr-2 h-4 w-4" /> Requests ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" /> Find People
          </TabsTrigger>
        </TabsList>

        {/* --- FRIENDS TAB --- */}
        <TabsContent value="friends">
          <Card>
            <CardHeader>
              <CardTitle>My Friends</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {friends.length > 0 ? (
                friends.map(conn => (
                  <div key={conn.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={getOtherUser(conn).avatar_url || ''} />
                        <AvatarFallback><UserIcon /></AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{getOtherUser(conn).username}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/chat/${conn.id}`)}>
                        Message
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => removeConnection(conn.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center">Your friends list is empty. Go find some!</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- PENDING REQUESTS TAB --- */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingRequests.length > 0 ? (
                pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={req.requester.avatar_url || ''} />
                        <AvatarFallback><UserIcon /></AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{req.requester.username}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => acceptRequest(req.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => removeConnection(req.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center">No pending friend requests.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- SEARCH TAB --- */}
        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle>Find New People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Search by username..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}><Search className="h-4 w-4" /></Button>
              </div>
              <Separator />
              <div className="space-y-4">
                {searchResults.map(profile => (
                  <div key={profile.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={profile.avatar_url || ''} />
                        <AvatarFallback><UserIcon /></AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{profile.username}</span>
                    </div>
                    <Button size="sm" onClick={() => sendRequest(profile.id)}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Connections;