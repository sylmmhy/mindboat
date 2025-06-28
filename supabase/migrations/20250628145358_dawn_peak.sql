/*
  # Add exploration notes functionality

  1. New Tables
    - `exploration_notes`
      - `id` (uuid, primary key)
      - `voyage_id` (uuid, foreign key to voyages)
      - `content` (text)
      - `type` (text) - 'text' or 'voice'
      - `created_at` (timestamp)

  2. Functions
    - Update `get_voyage_assessment_data` to include exploration notes
    - Fix distraction summary calculation

  3. Security
    - Enable RLS on `exploration_notes` table
    - Add policy for users to manage notes for their own voyages
*/

-- Create exploration_notes table
CREATE TABLE IF NOT EXISTS exploration_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id uuid NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'voice')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE exploration_notes ENABLE ROW LEVEL SECURITY;

-- Create policy for exploration notes
CREATE POLICY "Users can manage exploration notes for own voyages"
  ON exploration_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM voyages 
      WHERE voyages.id = exploration_notes.voyage_id 
      AND voyages.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exploration_notes_voyage_id 
  ON exploration_notes(voyage_id);

CREATE INDEX IF NOT EXISTS idx_exploration_notes_created_at 
  ON exploration_notes(created_at);

-- Update the assessment data function to include exploration notes and fix distraction summary
DROP FUNCTION IF EXISTS get_voyage_assessment_data(uuid);

CREATE OR REPLACE FUNCTION get_voyage_assessment_data(voyage_id_param uuid)
RETURNS json AS $$
DECLARE
  voyage_data json;
  distraction_data json;
  exploration_data json;
  assessment_data json;
BEGIN
  -- Get main voyage data with destination
  SELECT json_build_object(
    'voyage', row_to_json(v.*),
    'destination', row_to_json(d.*)
  ) INTO voyage_data
  FROM voyages v
  LEFT JOIN destinations d ON v.destination_id = d.id
  WHERE v.id = voyage_id_param;

  -- Get distraction events summary with improved calculation
  WITH distraction_events_with_duration AS (
    SELECT 
      *,
      -- Use duration_seconds if available, otherwise estimate 30 seconds for unresolved distractions
      CASE 
        WHEN duration_seconds IS NOT NULL AND duration_seconds > 0 THEN duration_seconds
        WHEN is_resolved = false THEN 30
        ELSE 0
      END as effective_duration
    FROM distraction_events 
    WHERE voyage_id = voyage_id_param
  ),
  distraction_summary AS (
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(effective_duration), 0) as total_time,
      CASE 
        WHEN COUNT(*) > 0 THEN AVG(effective_duration)
        ELSE 0 
      END as avg_duration,
      COALESCE(
        (COUNT(*) FILTER (WHERE user_response = 'return_to_course')::real / NULLIF(COUNT(*), 0) * 100),
        0
      ) as return_rate
    FROM distraction_events_with_duration
  ),
  distraction_types AS (
    SELECT COALESCE(json_object_agg(type, count), '{}'::json) as by_type
    FROM (
      SELECT type, COUNT(*) as count
      FROM distraction_events_with_duration
      GROUP BY type
    ) t
  )
  SELECT json_build_object(
    'events', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', de.id,
          'type', de.type,
          'detected_at', de.detected_at,
          'duration_seconds', de.effective_duration,
          'user_response', de.user_response,
          'position_x', de.position_x,
          'position_y', de.position_y,
          'context_url', de.context_url,
          'is_resolved', de.is_resolved
        ) ORDER BY de.detected_at
      ) FROM distraction_events_with_duration de),
      '[]'::json
    ),
    'summary', json_build_object(
      'total_count', ds.total_count,
      'by_type', dt.by_type,
      'total_time', ds.total_time,
      'avg_duration', ROUND(ds.avg_duration::numeric, 1),
      'return_rate', ROUND(ds.return_rate::numeric, 1)
    )
  ) INTO distraction_data
  FROM distraction_summary ds
  CROSS JOIN distraction_types dt;

  -- Get exploration notes
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', en.id,
        'content', en.content,
        'type', en.type,
        'created_at', en.created_at
      ) ORDER BY en.created_at
    ),
    '[]'::json
  ) INTO exploration_data
  FROM exploration_notes en
  WHERE en.voyage_id = voyage_id_param;

  -- Combine all data
  SELECT json_build_object(
    'voyage', voyage_data,
    'distractions', distraction_data,
    'exploration_notes', exploration_data
  ) INTO assessment_data;

  RETURN assessment_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the statistics calculation function to use the same logic
DROP FUNCTION IF EXISTS calculate_voyage_statistics(uuid);

CREATE OR REPLACE FUNCTION calculate_voyage_statistics(voyage_id_param uuid)
RETURNS void AS $$
DECLARE
  v_total_distraction_time integer := 0;
  v_distraction_count integer := 0;
  v_avg_duration real := 0;
  v_return_count integer := 0;
  v_most_common_type text;
  v_focus_score integer;
  v_voyage_duration integer;
BEGIN
  -- Get voyage duration in minutes
  SELECT COALESCE(actual_duration, 0) INTO v_voyage_duration
  FROM voyages WHERE id = voyage_id_param;

  -- Count total distraction events and calculate effective durations
  WITH effective_durations AS (
    SELECT 
      CASE 
        WHEN duration_seconds IS NOT NULL AND duration_seconds > 0 THEN duration_seconds
        WHEN is_resolved = false THEN 30
        ELSE 0
      END as effective_duration,
      user_response,
      type
    FROM distraction_events 
    WHERE voyage_id = voyage_id_param
  )
  SELECT 
    COUNT(*),
    COALESCE(SUM(effective_duration), 0),
    COALESCE(AVG(effective_duration), 0),
    COUNT(*) FILTER (WHERE user_response = 'return_to_course')
  INTO v_distraction_count, v_total_distraction_time, v_avg_duration, v_return_count
  FROM effective_durations;

  -- Find most common distraction type
  SELECT type INTO v_most_common_type
  FROM distraction_events 
  WHERE voyage_id = voyage_id_param
  GROUP BY type 
  ORDER BY COUNT(*) DESC 
  LIMIT 1;

  -- Calculate focus quality score using a simple but effective formula
  IF v_voyage_duration > 0 THEN
    -- Start with 100, subtract points for distractions and time lost
    v_focus_score := 100 
      - LEAST(50, v_distraction_count * 5)  -- Max 50 points for frequency
      - LEAST(50, ROUND((v_total_distraction_time::real / (v_voyage_duration * 60)) * 100)); -- Max 50 points for time lost
    
    -- Ensure score is between 0 and 100
    v_focus_score := GREATEST(0, LEAST(100, v_focus_score));
  ELSE
    v_focus_score := 100; -- Perfect score for zero duration (shouldn't happen)
  END IF;

  -- Update voyage with calculated statistics
  UPDATE voyages SET
    distraction_count = v_distraction_count,
    total_distraction_time = v_total_distraction_time,
    focus_quality_score = v_focus_score,
    avg_distraction_duration = v_avg_duration,
    return_to_course_rate = CASE 
      WHEN v_distraction_count > 0 THEN (v_return_count::real / v_distraction_count * 100)
      ELSE 100
    END,
    most_common_distraction = v_most_common_type
  WHERE id = voyage_id_param;

  -- Log the calculation for debugging
  RAISE NOTICE 'Voyage % stats: duration=%min, distractions=%, total_time=%s, avg_duration=%s, score=%', 
    voyage_id_param, v_voyage_duration, v_distraction_count, v_total_distraction_time, v_avg_duration, v_focus_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON exploration_notes TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_voyage_statistics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_assessment_data(uuid) TO authenticated;