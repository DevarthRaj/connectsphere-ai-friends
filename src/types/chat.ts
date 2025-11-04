import type { Tables } from "@/integrations/supabase/types"; // Import the auto-generated types

// Define a clean Profile type we can use in our joins
type Profile = Pick<Tables<"profiles">, "id" | "username" | "avatar_url">;

// This is the full connection object we'll pass around
export type ChatConnection = Tables<"connections"> & {
  requester: Profile;
  receiver: Profile;
  conversations: { id: string }[];
  otherUser: Profile; // We'll add this property in ChatList
};

// This is the shared type that breaks the circular dependency
export type ActiveChat = {
  type: "ai" | "user";
  id: string; // "ai" for AI, or the connection_id for a user
  data?: ChatConnection; // Pass the whole connection object
};