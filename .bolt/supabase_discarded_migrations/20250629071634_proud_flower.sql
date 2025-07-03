/*
  # MindBoat Database Schema - Complete Setup

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

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid REFERENCES auth.users PRIMARY KEY,
  lighthouse_goal text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create destinations table with user_id default
CREATE TABLE IF NOT EXISTS destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  original_task text NOT NULL,
  destination_name text NOT NULL,
  description text DEFAULT '',
  related_apps text[] DEFAULT '{}',
  color_theme text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- Create voyages table with enhanced tracking
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
  created_at timestamptz DEFAULT now(),
  -- Enhanced voyage statistics
  total_distraction_time integer DEFAULT 0,
  focus_quality_score integer,
  avg_distraction_duration real,
  longest_focus_period integer,
  return_to_course_rate real,
  most_common_distraction text
);

-- Create distraction events table with enhanced tracking
CREATE TABLE IF NOT EXISTS distraction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id uuid REFERENCES voyages NOT NULL,
  detected_at timestamptz DEFAULT now(),
  duration_seconds integer,
  type text NOT NULL,
  user_response text,
  -- Enhanced tracking fields
  position_x real,
  position_y real,
  context_url text,
  is_resolved boolean DEFAULT false
);

-- Create exploration notes table
CREATE TABLE IF NOT EXISTS exploration_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id uuid NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'voice')),
  created_at timestamptz DEFAULT now()
);

-- Create daily reflections table
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

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyages ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE exploration_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reflections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for destinations
CREATE POLICY "Users can manage own destinations"
  ON destinations FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for voyages
CREATE POLICY "Users can manage own voyages"
  ON voyages FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for distraction_events
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
CREATE POLICY "Users can manage own reflections"
  ON daily_reflections FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();