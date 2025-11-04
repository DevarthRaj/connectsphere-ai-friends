import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus } from "lucide-react";
import { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types"; // Import the Tables type

const ConnectionRequests = () => {
  const [searchUsername, setSearchUsername] = useState("");
  // FIX #2: Use a specific TypeScript type instead of 'any'
  const [searchResult, setSearchResult] = useState<Tables<"profiles"> | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const searchUser = async () => {
    if (!searchUsername.trim()) return;
    
    setSearching(true);
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        // FIX #3: Use case-insensitive search for a better user experience
        .ilike("username", searchUsername.trim())
        .single();

      if (error || !profile) {
        toast({
          title: "User not found",
          description: "No user found with that username.",
          variant: "destructive",
        });
        setSearchResult(null);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (profile.id === user?.id) {
          toast({
            title: "That's you!",
            description: "You can't send a connection request to yourself.",
          });
          setSearchResult(null);
        } else {
          setSearchResult(profile);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async () => {
    if (!searchResult) return;
    
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // FIX #1: Add a guard clause to ensure the user is logged in
      if (!user) {
        toast({
          title: "Not Authenticated",
          description: "You must be logged in to send a request.",
          variant: "destructive",
        });
        setSending(false);
        return;
      }
      
      const { error } = await supabase
        .from("connections")
        .insert({
          requester_id: user.id, // Now guaranteed to not be null
          receiver_id: searchResult.id,
          status: "pending"
        });

      if (error) {
        if (error.code === "23505") { // Handles duplicate requests
          toast({
            title: "Request already sent",
            description: "You've already sent a request to this user.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Request sent!",
          description: `Connection request sent to ${searchResult.username}`,
        });
        setSearchResult(null);
        setSearchUsername("");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Connect with Users
        </CardTitle>
        <CardDescription>
          Search for users by username and send connection requests
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search username..."
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && searchUser()}
          />
          <Button onClick={searchUser} disabled={searching}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {searchResult && (
          <Card className="bg-secondary/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{searchResult.username}</p>
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(searchResult.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button onClick={sendRequest} disabled={sending}>
                  {sending ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionRequests;