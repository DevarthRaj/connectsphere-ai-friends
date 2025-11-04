import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserCheck } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface Connection {
  id: string;
  requester: {
    id: string;
    username: string;
  };
  status: string;
  created_at: string;
}

const PendingRequests = () => {
  const [requests, setRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("connections")
        .select(`
          id,
          status,
          created_at,
          requester:requester_id (
            id,
            username
          )
        `)
        .eq("receiver_id", user?.id)
        .eq("status", "pending");

      if (error) throw error;
      setRequests(data as any || []);
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
    fetchRequests();
  }, []);

  const handleRequest = async (connectionId: string, status: "accepted" | "declined") => {
    try {
      const { error: updateError } = await supabase
        .from("connections")
        .update({ status })
        .eq("id", connectionId);

      if (updateError) throw updateError;

      if (status === "accepted") {
        const { error: convError } = await supabase
          .from("conversations")
          .insert({ connection_id: connectionId });
        
        if (convError) throw convError;
      }

      toast({
        title: status === "accepted" ? "Request accepted!" : "Request declined",
        description: status === "accepted" 
          ? "You can now chat with this user." 
          : "Request has been declined.",
      });

      fetchRequests();
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
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
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
                    <div>
                      <p className="font-semibold">{request.requester.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
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
