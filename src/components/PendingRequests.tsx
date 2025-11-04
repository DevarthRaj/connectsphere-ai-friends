import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserCheck, Loader2, User as UserIcon } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// This interface now matches the data from our 'select' query
interface PendingRequest {
  id: string;
  status: string;
  created_at: string;
  requester: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

const PendingRequests = ({ user }: { user: User }) => {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRequests = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("connections")
          .select(`
            id,
            status,
            created_at,
            requester:requester_id (
              id,
              username,
              avatar_url
            )
          `)
          .eq("receiver_id", user.id)
          .eq("status", "pending");

        if (error) throw error;
        setRequests(data as unknown as PendingRequest[] || []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load requests: " + error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [user, toast]);

  // THIS IS THE CORRECTED LINE - The stray 'D' is removed
  const handleRequest = async (connectionId: string, status: "accepted" | "declined") => {
    try {
      const { error: updateError } = await supabase
        .from("connections")
        .update({ status: status === "accepted" ? "accepted" : "declined" }) // Use the status directly
        .eq("id", connectionId);

      if (updateError) throw updateError;
      
      // If declining, we actually want to delete the connection record
      if (status === "declined") {
        await supabase.from("connections").delete().eq("id", connectionId);
      }

      toast({
        title: status === "accepted" ? "Request accepted!" : "Request declined",
        description: status === "accepted" 
          ? "You can now chat with this user." 
          : "The request has been removed.",
      });

      setRequests((prev) => prev.filter((req) => req.id !== connectionId));

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="shadow-medium">
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          Pending Requests
        </CardTitle>
        <CardDescription>
          Review and respond to connection requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No pending requests
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={request.id} className="bg-secondary/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={request.requester.avatar_url || ''} />
                        <AvatarFallback>
                          <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{request.requester.username}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleRequest(request.id, "accepted")}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRequest(request.id, "declined")}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
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

export default PendingRequests;