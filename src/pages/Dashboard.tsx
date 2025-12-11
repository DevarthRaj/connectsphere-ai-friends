import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import ChatList from "@/components/ChatList";
import ChatWindow from "@/components/ChatWindow";
import AIChat from "@/components/AIChat";
import { cn } from "@/lib/utils";
import type { ActiveChat } from "@/types/chat"; // Use your new types file
import { Loader2, MessageSquare } from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const navigate = useNavigate(); // Make sure navigate is definedF

  // This is the corrected auth-checking hook
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });
    
    // Also listen for changes (e.g., user signs out in another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]); // Add navigate to the dependency array

  const renderActiveChat = () => {
    if (!activeChat) {
      return (
        <div className="flex flex-col h-full items-center justify-center bg-secondary">
          <MessageSquare className="h-24 w-24 text-muted-foreground/50" />
          <h2 className="mt-4 text-2xl font-semibold text-muted-foreground">
            Select a chat to start
          </h2>
          <p className="text-muted-foreground">
            Choose a friend or the AI Assistant from the list.
          </p>
        </div>
      );
    }

    if (activeChat.type === "ai") {
      return <AIChat />;
    }

    // This guard ensures activeChat.data exists before passing it
    if (activeChat.type === "user" && activeChat.data) {
      return <ChatWindow user={user!} connection={activeChat.data} />;
    }
    
    return null; // Handle potential edge case
  };

  // This guard is CRITICAL. It prevents <ChatList> from rendering
  // until the 'user' object is confirmed to exist.
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // By this point, 'user' is guaranteed to be a valid User object
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ChatList
        user={user}
        onSelectChat={setActiveChat}
        activeChatId={activeChat?.id}
      />
      <main className="flex-1 h-full">
        {renderActiveChat()}
      </main>
    </div>
  );
};

export default Dashboard;