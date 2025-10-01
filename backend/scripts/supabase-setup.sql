-- Supabase Database Setup for CMS + RAG
-- Run this in your Supabase SQL Editor

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: notes_sections (for Notes app)
CREATE TABLE IF NOT EXISTS notes_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  skills_header text NOT NULL,
  skills_items jsonb NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: map_locations (for Maps app)
CREATE TABLE IF NOT EXISTS map_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  country text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  description text,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: knowledge_base (for RAG)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  embedding vector(1536),
  metadata jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: chat_analytics (anonymous analytics)
CREATE TABLE IF NOT EXISTS chat_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_message text NOT NULL,
  ai_response text NOT NULL,
  tokens_used integer,
  rag_sources jsonb,
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_session ON chat_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_created ON chat_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_locations_active ON map_locations(is_active);

-- Enable Row Level Security
ALTER TABLE notes_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read notes" ON notes_sections;
DROP POLICY IF EXISTS "Public read locations" ON map_locations;
DROP POLICY IF EXISTS "Public read knowledge" ON knowledge_base;
DROP POLICY IF EXISTS "Admin write notes" ON notes_sections;
DROP POLICY IF EXISTS "Admin write locations" ON map_locations;
DROP POLICY IF EXISTS "Admin write knowledge" ON knowledge_base;
DROP POLICY IF EXISTS "Admin read analytics" ON chat_analytics;
DROP POLICY IF EXISTS "Service insert analytics" ON chat_analytics;

-- Public read access policies
CREATE POLICY "Public read notes" ON notes_sections FOR SELECT USING (true);
CREATE POLICY "Public read locations" ON map_locations FOR SELECT USING (is_active = true);
CREATE POLICY "Public read knowledge" ON knowledge_base FOR SELECT USING (is_active = true);

-- Admin write access policies (authenticated users only)
CREATE POLICY "Admin write notes" ON notes_sections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write locations" ON map_locations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write knowledge" ON knowledge_base FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin read analytics" ON chat_analytics FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can insert chat analytics
CREATE POLICY "Service insert analytics" ON chat_analytics FOR INSERT WITH CHECK (true);

-- Function: Vector similarity search for RAG
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    knowledge_base.metadata,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Supabase setup complete! Tables and functions created successfully.';
END $$;
