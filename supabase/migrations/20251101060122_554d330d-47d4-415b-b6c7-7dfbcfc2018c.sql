
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.conversations;
DROP TABLE IF EXISTS public.connections;
DROP TABLE IF EXISTS public.profiles;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  banner_url TEXT,
  github_link TEXT,
  linkedin_link TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~* '^[a-zA-Z0-9_]+$'),
  CONSTRAINT github_link_format CHECK (github_link IS NULL OR github_link ~* '^https?://(www\.)?github\.com/[a-zA-Z0-9_-]+/?$'),
  CONSTRAINT linkedin_link_format CHECK (linkedin_link IS NULL OR linkedin_link ~* '^https?://(www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?$'),
  CONSTRAINT bio_length CHECK (bio IS NULL OR char_length(bio) <= 500)
);

-- CONNECTIONS
CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(requester_id, receiver_id),
  CHECK (requester_id != receiver_id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;



ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(connection_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ==========================================
-- 3. POLICIES (RLS)
-- ==========================================

-- PROFILES Policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- CONNECTIONS Policies
CREATE POLICY "Users can view their own connections" ON public.connections FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create connection requests" ON public.connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update connection requests" ON public.connections FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

-- CONVERSATIONS Policies
CREATE POLICY "Users can view conversations" ON public.conversations FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.connections
    WHERE connections.id = conversations.connection_id
    AND (connections.requester_id = auth.uid() OR connections.receiver_id = auth.uid())
    AND connections.status = 'accepted'
  )
);

-- MESSAGES Policies
CREATE POLICY "Users can view messages" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    JOIN public.connections ON connections.id = conversations.connection_id
    WHERE conversations.id = messages.conversation_id
    AND (connections.requester_id = auth.uid() OR connections.receiver_id = auth.uid())
    AND connections.status = 'accepted'
  )
);

CREATE POLICY "Users can create messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.conversations
    JOIN public.connections ON connections.id = conversations.connection_id
    WHERE conversations.id = messages.conversation_id
    AND (connections.requester_id = auth.uid() OR connections.receiver_id = auth.uid())
    AND connections.status = 'accepted'
  )
);

-- ==========================================
-- 1. CLEANUP (Drop old tables/functions to start fresh)
-- ==========================================

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.create_conversation_on_accept();
DROP FUNCTION IF EXISTS public.update_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_connection_accepted ON public.connections;
DROP TRIGGER IF EXISTS update_connections_updated_at ON public.connections;

-- ==========================================
-- 4. FUNCTIONS & TRIGGERS
-- ==========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || substring(NEW.id::text, 1, 8)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create Conversation on Connection Accept
CREATE OR REPLACE FUNCTION public.create_conversation_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    INSERT INTO public.conversations (connection_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_connection_accepted
  AFTER UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.create_conversation_on_accept();