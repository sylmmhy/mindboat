/*
  # Enhanced Voyage Data Collection

  1. Tables Modified
    - `distraction_events` - Added position tracking and enhanced metadata
    - `voyages` - Added comprehensive assessment data fields
    
  2. New Fields
    - Position tracking (x, y coordinates) for distraction events
    - Total distraction time calculation
    - Focus quality metrics
    - Detailed voyage statistics for assessment
    
  3. Security
    - Maintain existing RLS policies
    - Ensure data integrity with appropriate constraints
*/

-- Add new columns to distraction_events table for enhanced tracking
DO $$
BEGIN
  -- Add position tracking for distraction events
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distraction_events' AND column_name = 'position_x'
  ) THEN
    ALTER TABLE distraction_events ADD COLUMN position_x real;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distraction_events' AND column_name = 'position_y'
  ) THEN
    ALTER TABLE distraction_events ADD COLUMN position_y real;
  END IF;

  -- Add metadata for better analysis
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distraction_events' AND column_name = 'context_url'
  ) THEN
    ALTER TABLE distraction_events ADD COLUMN context_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distraction_events' AND column_name = 'is_resolved'
  ) THEN
    ALTER TABLE distraction_events ADD COLUMN is_resolved boolean DEFAULT false;
  END IF;
END $$;

-- Add comprehensive assessment fields to voyages table
DO $$
BEGIN
  -- Total distraction time in seconds
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'total_distraction_time'
  ) THEN
    ALTER TABLE voyages ADD COLUMN total_distraction_time integer DEFAULT 0;
  END IF;

  -- Focus quality score (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'focus_quality_score'
  ) THEN
    ALTER TABLE voyages ADD COLUMN focus_quality_score integer;
  END IF;

  -- Average distraction duration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'avg_distraction_duration'
  ) THEN
    ALTER TABLE voyages ADD COLUMN avg_distraction_duration real;
  END IF;

  -- Longest focus period in minutes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'longest_focus_period'
  ) THEN
    ALTER TABLE voyages ADD COLUMN longest_focus_period integer;
  END IF;

  -- Return to course rate (percentage)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'return_to_course_rate'
  ) THEN
    ALTER TABLE voyages ADD COLUMN return_to_course_rate real;
  END IF;

  -- Most common distraction type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'most_common_distraction'
  ) THEN
    ALTER TABLE voyages ADD COLUMN most_common_distraction text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_distraction_events_voyage_id_detected_at 
  ON distraction_events(voyage_id, detected_at);

CREATE INDEX IF NOT EXISTS idx_voyages_user_id_status_created_at 
  ON voyages(user_id, status, created_at);

-- Function to calculate voyage statistics
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
  -- Get voyage duration
  SELECT COALESCE(actual_duration, 0) INTO v_voyage_duration
  FROM voyages WHERE id = voyage_id_param;

  -- Calculate total distraction time and count
  SELECT 
    COALESCE(SUM(duration_seconds), 0),
    COUNT(*),
    COALESCE(AVG(duration_seconds), 0)
  INTO v_total_distraction_time, v_distraction_count, v_avg_duration
  FROM distraction_events 
  WHERE voyage_id = voyage_id_param AND duration_seconds IS NOT NULL;

  -- Count return to course responses
  SELECT COUNT(*) INTO v_return_count
  FROM distraction_events 
  WHERE voyage_id = voyage_id_param AND user_response = 'return_to_course';

  -- Find most common distraction type
  SELECT type INTO v_most_common_type
  FROM distraction_events 
  WHERE voyage_id = voyage_id_param
  GROUP BY type 
  ORDER BY COUNT(*) DESC 
  LIMIT 1;

  -- Calculate focus quality score (0-100)
  IF v_voyage_duration > 0 THEN
    v_focus_score := GREATEST(0, LEAST(100, 
      100 - ((v_total_distraction_time::real / (v_voyage_duration * 60)) * 100)
    ));
  ELSE
    v_focus_score := 0;
  END IF;

  -- Update voyage with calculated statistics
  UPDATE voyages SET
    total_distraction_time = v_total_distraction_time,
    focus_quality_score = v_focus_score,
    avg_distraction_duration = v_avg_duration,
    return_to_course_rate = CASE 
      WHEN v_distraction_count > 0 THEN (v_return_count::real / v_distraction_count * 100)
      ELSE 100
    END,
    most_common_distraction = v_most_common_type
  WHERE id = voyage_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive voyage data for assessment
CREATE OR REPLACE FUNCTION get_voyage_assessment_data(voyage_id_param uuid)
RETURNS json AS $$
DECLARE
  voyage_data json;
  distraction_data json;
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

  -- Get distraction events summary
  SELECT json_build_object(
    'events', COALESCE(json_agg(
      json_build_object(
        'id', de.id,
        'type', de.type,
        'detected_at', de.detected_at,
        'duration_seconds', de.duration_seconds,
        'user_response', de.user_response,
        'position_x', de.position_x,
        'position_y', de.position_y,
        'context_url', de.context_url,
        'is_resolved', de.is_resolved
      ) ORDER BY de.detected_at
    ), '[]'::json),
    'summary', json_build_object(
      'total_count', COUNT(*),
      'by_type', (
        SELECT json_object_agg(type, count)
        FROM (
          SELECT type, COUNT(*) as count
          FROM distraction_events
          WHERE voyage_id = voyage_id_param
          GROUP BY type
        ) t
      ),
      'total_time', COALESCE(SUM(duration_seconds), 0),
      'avg_duration', COALESCE(AVG(duration_seconds), 0),
      'return_rate', (
        COUNT(*) FILTER (WHERE user_response = 'return_to_course')::real /
        NULLIF(COUNT(*), 0) * 100
      )
    )
  ) INTO distraction_data
  FROM distraction_events de
  WHERE de.voyage_id = voyage_id_param;

  -- Combine all data
  SELECT json_build_object(
    'voyage', voyage_data,
    'distractions', distraction_data
  ) INTO assessment_data;

  RETURN assessment_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION calculate_voyage_statistics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_assessment_data(uuid) TO authenticated;