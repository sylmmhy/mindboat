/*
  # MindBoat Database Schema - Safe Migration

  This migration safely applies the complete MindBoat schema without conflicts.
  It checks for existing objects before creating them to avoid duplicate errors.

  1. Core Tables
    - `user_profiles` - User preferences and lighthouse goals
    - `destinations` - AI-generated sailing destinations from user tasks
    - `voyages` - Focus sessions with comprehensive tracking
    - `distraction_events` - Detailed distraction tracking with position and metadata
    - `exploration_notes` - Notes captured during exploration mode
    - `daily_reflections` - AI-generated daily insights

  2. Enhanced Features
    - Comprehensive voyage statistics (focus quality, distraction patterns)
    - Position tracking for distraction events
    - Exploration mode with note-taking capabilities
    - Advanced analytics and reporting

  3. Security
    - Row Level Security enabled on all tables
    - Policies for authenticated users to manage their own data
    - Data isolation between users
*/

-- Create user profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid REFERENCES auth.users PRIMARY KEY,
  lighthouse_goal text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create destinations table with enhanced features if it doesn't exist
CREATE TABLE IF NOT EXISTS destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  original_task text NOT NULL,
  destination_name text NOT NULL,
  description text DEFAULT '',
  related_apps text[] DEFAULT '{}',
  color_theme text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- Add user_id default if not already set
DO $$
BEGIN
  ALTER TABLE destinations ALTER COLUMN user_id SET DEFAULT auth.uid();
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Create voyages table with enhanced tracking if it doesn't exist
CREATE TABLE IF NOT EXISTS voyages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  destination_id uuid REFERENCES destinations NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  planned_duration integer,
  actual_duration integer,
  distraction_count integer DEFAULT 0,
  status text CHECK (status IN ('active', 'completed', 'abandoned')) DEFAULT 'active',
  weather_mood text DEFAULT 'sunny',
  created_at timestamptz DEFAULT now()
);

-- Add enhanced voyage statistics columns if they don't exist
DO $$
BEGIN
  -- Add total_distraction_time if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'total_distraction_time'
  ) THEN
    ALTER TABLE voyages ADD COLUMN total_distraction_time integer DEFAULT 0;
  END IF;

  -- Add focus_quality_score if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'focus_quality_score'
  ) THEN
    ALTER TABLE voyages ADD COLUMN focus_quality_score integer;
  END IF;

  -- Add avg_distraction_duration if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'avg_distraction_duration'
  ) THEN
    ALTER TABLE voyages ADD COLUMN avg_distraction_duration real;
  END IF;

  -- Add longest_focus_period if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'longest_focus_period'
  ) THEN
    ALTER TABLE voyages ADD COLUMN longest_focus_period integer;
  END IF;

  -- Add return_to_course_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'return_to_course_rate'
  ) THEN
    ALTER TABLE voyages ADD COLUMN return_to_course_rate real;
  END IF;

  -- Add most_common_distraction if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'most_common_distraction'
  ) THEN
    ALTER TABLE voyages ADD COLUMN most_common_distraction text;
  END IF;
END $$;

-- Create distraction events table with enhanced tracking if it doesn't exist
CREATE TABLE IF NOT EXISTS distraction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id uuid REFERENCES voyages NOT NULL,
  detected_at timestamptz DEFAULT now(),
  duration_seconds integer,
  type text NOT NULL,
  user_response text
);

-- Add enhanced tracking fields to distraction_events if they don't exist
DO $$
BEGIN
  -- Add position_x if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distraction_events' AND column_name = 'position_x'
  ) THEN
    ALTER TABLE distraction_events ADD COLUMN position_x real;
  END IF;

  -- Add position_y if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distraction_events' AND column_name = 'position_y'
  ) THEN
    ALTER TABLE distraction_events ADD COLUMN position_y real;
  END IF;

  -- Add context_url if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distraction_events' AND column_name = 'context_url'
  ) THEN
    ALTER TABLE distraction_events ADD COLUMN context_url text;
  END IF;

  -- Add is_resolved if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distraction_events' AND column_name = 'is_resolved'
  ) THEN
    ALTER TABLE distraction_events ADD COLUMN is_resolved boolean DEFAULT false;
  END IF;
END $$;

-- Create exploration notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS exploration_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id uuid NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'voice')),
  created_at timestamptz DEFAULT now()
);

-- Create daily reflections table if it doesn't exist
CREATE TABLE IF NOT EXISTS daily_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  reflection_text text,
  total_focus_time integer DEFAULT 0,
  voyage_count integer DEFAULT 0,
  generated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security (safe operation)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyages ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE exploration_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reflections ENABLE ROW LEVEL SECURITY;

-- Safely create RLS policies (drop existing ones first to avoid conflicts)

-- RLS Policies for user_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for destinations
DROP POLICY IF EXISTS "Users can manage own destinations" ON destinations;
CREATE POLICY "Users can manage own destinations"
  ON destinations FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for voyages
DROP POLICY IF EXISTS "Users can manage own voyages" ON voyages;
CREATE POLICY "Users can manage own voyages"
  ON voyages FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for distraction_events
DROP POLICY IF EXISTS "Users can manage distraction events for own voyages" ON distraction_events;
CREATE POLICY "Users can manage distraction events for own voyages"
  ON distraction_events FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM voyages 
      WHERE voyages.id = distraction_events.voyage_id 
      AND voyages.user_id = auth.uid()
    )
  );

-- RLS Policies for exploration_notes
DROP POLICY IF EXISTS "Users can manage exploration notes for own voyages" ON exploration_notes;
CREATE POLICY "Users can manage exploration notes for own voyages"
  ON exploration_notes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM voyages 
      WHERE voyages.id = exploration_notes.voyage_id 
      AND voyages.user_id = auth.uid()
    )
  );

-- RLS Policies for daily_reflections
DROP POLICY IF EXISTS "Users can manage own reflections" ON daily_reflections;
CREATE POLICY "Users can manage own reflections"
  ON daily_reflections FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_destinations_user_id ON destinations(user_id);
CREATE INDEX IF NOT EXISTS idx_voyages_user_id ON voyages(user_id);
CREATE INDEX IF NOT EXISTS idx_voyages_destination_id ON voyages(destination_id);
CREATE INDEX IF NOT EXISTS idx_voyages_user_status ON voyages(user_id, status);
CREATE INDEX IF NOT EXISTS idx_voyages_start_time ON voyages(start_time);
CREATE INDEX IF NOT EXISTS idx_voyages_user_id_status_created_at ON voyages(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_distraction_events_voyage_id ON distraction_events(voyage_id);
CREATE INDEX IF NOT EXISTS idx_distraction_events_detected_at ON distraction_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_distraction_events_type ON distraction_events(type);
CREATE INDEX IF NOT EXISTS idx_distraction_events_voyage_id_type ON distraction_events(voyage_id, type);
CREATE INDEX IF NOT EXISTS idx_distraction_events_voyage_id_detected_at ON distraction_events(voyage_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_exploration_notes_voyage_id ON exploration_notes(voyage_id);
CREATE INDEX IF NOT EXISTS idx_exploration_notes_created_at ON exploration_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_reflections_user_date ON daily_reflections(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_reflections_date ON daily_reflections(date);

-- Create function to update updated_at timestamp (OR REPLACE is safe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Safely create trigger for user_profiles (drop if exists first)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();