/*
  # MindBoat Database Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, references auth.users)
      - `lighthouse_goal` (text, user's long-term goal)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `destinations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `original_task` (text, user's input task)
      - `destination_name` (text, AI-generated destination name)
      - `description` (text, AI-generated description)
      - `related_apps` (text array, suggested applications)
      - `color_theme` (text, hex color for UI)
      - `created_at` (timestamp)
    
    - `voyages`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `destination_id` (uuid, references destinations)
      - `start_time` (timestamp)
      - `end_time` (timestamp, nullable)
      - `planned_duration` (integer, minutes)
      - `actual_duration` (integer, minutes)
      - `distraction_count` (integer)
      - `status` (enum: active, completed, abandoned)
      - `weather_mood` (text, for visual theming)
      - `created_at` (timestamp)
    
    - `distraction_events`
      - `id` (uuid, primary key)
      - `voyage_id` (uuid, references voyages)
      - `detected_at` (timestamp)
      - `duration_seconds` (integer, nullable)
      - `type` (text, distraction type)
      - `user_response` (text, nullable)
    
    - `daily_reflections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `date` (date)
      - `reflection_text` (text, AI-generated reflection)
      - `total_focus_time` (integer, minutes)
      - `voyage_count` (integer)
      - `generated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Ensure data isolation between users

  3. Indexes
    - Add performance indexes for common queries
    - Optimize for user-specific data retrieval
*/

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid REFERENCES auth.users PRIMARY KEY,
  lighthouse_goal text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create destinations table
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

-- Create voyages table
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

-- Create distraction events table
CREATE TABLE IF NOT EXISTS distraction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id uuid REFERENCES voyages NOT NULL,
  detected_at timestamptz DEFAULT now(),
  duration_seconds integer,
  type text NOT NULL,
  user_response text
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
ALTER TABLE daily_reflections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for destinations
CREATE POLICY "Users can manage own destinations"
  ON destinations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for voyages
CREATE POLICY "Users can manage own voyages"
  ON voyages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for distraction_events
CREATE POLICY "Users can manage distraction events for own voyages"
  ON distraction_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM voyages 
      WHERE voyages.id = distraction_events.voyage_id 
      AND voyages.user_id = auth.uid()
    )
  );

-- RLS Policies for daily_reflections
CREATE POLICY "Users can manage own reflections"
  ON daily_reflections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_destinations_user_id ON destinations(user_id);
CREATE INDEX IF NOT EXISTS idx_voyages_user_id ON voyages(user_id);
CREATE INDEX IF NOT EXISTS idx_voyages_destination_id ON voyages(destination_id);
CREATE INDEX IF NOT EXISTS idx_distraction_events_voyage_id ON distraction_events(voyage_id);
CREATE INDEX IF NOT EXISTS idx_daily_reflections_user_date ON daily_reflections(user_id, date);

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