import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, User as UserIcon, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const ConnectionRequests = () => {
  const [searchUsername, setSearchUsername] = useState("");
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
          requester_id: user.id,
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
    <Card className="w-full shadow-lg border-border/50 bg-card/95 backdrop-blur-sm transition-all duration-300 hover:shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-full shrink-0">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Connect with Users</CardTitle>
            <CardDescription className="mt-1">
              Search for peers by username to expand your network
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Search Bar Area */}
        <div className="flex gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
            <Input
              placeholder="Search username..."
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && searchUser()}
              className="pl-9 bg-background/50 border-input transition-all duration-200 focus:bg-background focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button 
            onClick={searchUser} 
            disabled={searching || !searchUsername.trim()}
            className="shadow-sm active:scale-95 transition-transform"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {/* Search Result Card */}
        {searchResult && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-secondary/50 to-secondary/10 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  {/* Avatar Placeholder */}
                  <div className="h-12 w-12 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 shadow-sm">
                    <UserIcon className="h-6 w-6 text-muted-foreground/70" />
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-lg truncate text-foreground">
                        {searchResult.username}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                      Joined {new Date(searchResult.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Action Button */}
                  <Button 
                    onClick={sendRequest} 
                    disabled={sending}
                    size="sm"
                    className="gap-2 shadow-sm shrink-0"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="sr-only sm:not-sr-only">Sending</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Connect</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State / Helper */}
        {!searchResult && !searching && (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center text-muted-foreground/60 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                <p className="text-sm">Enter a username above to find people.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionRequests;