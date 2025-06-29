/*
  # Apply High Precision Timing to MindBoat Database

  This migration adds the missing columns and functions needed for high precision timing.
  It safely applies all the changes from the peaceful_garden migration.

  1. Schema Changes
    - Add actual_duration_ms, planned_duration_ms, start_time_precise_ms to voyages table
    - Add precision_level column to track data quality
    
  2. New Functions
    - get_voyage_precise_duration: Get duration with millisecond precision
    - get_voyage_planned_duration_precise: Get planned duration with precision
    - calculate_voyage_statistics_precise: Enhanced statistics calculation
    - get_voyage_assessment_data_precise: Enhanced assessment data function
    - format_precise_duration: Format duration for display
    - migrate_legacy_duration_data: Migrate existing data
*/

-- Add high precision timing columns to voyages table
DO $$
BEGIN
  -- Add actual_duration_ms for millisecond precision
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'actual_duration_ms'
  ) THEN
    ALTER TABLE voyages ADD COLUMN actual_duration_ms bigint;
  END IF;

  -- Add planned_duration_ms for millisecond precision  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'planned_duration_ms'
  ) THEN
    ALTER TABLE voyages ADD COLUMN planned_duration_ms bigint;
  END IF;

  -- Add start_time_precise for high precision start timing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'start_time_precise_ms'
  ) THEN
    ALTER TABLE voyages ADD COLUMN start_time_precise_ms bigint;
  END IF;

  -- Add precision_level to track data quality
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voyages' AND column_name = 'precision_level'
  ) THEN
    ALTER TABLE voyages ADD COLUMN precision_level text DEFAULT 'minute' CHECK (precision_level IN ('millisecond', 'second', 'minute'));
  END IF;
END $$;

-- Update existing voyages to have precision_level set
UPDATE voyages 
SET precision_level = 'minute' 
WHERE precision_level IS NULL;

-- Function to get precise duration from voyage (handles both old and new data)
CREATE OR REPLACE FUNCTION get_voyage_precise_duration(voyage_id_param uuid)
RETURNS bigint AS $$
DECLARE
  precise_duration bigint;
  fallback_duration bigint;
  voyage_precision text;
BEGIN
  -- Try to get high precision duration first
  SELECT actual_duration_ms, precision_level INTO precise_duration, voyage_precision
  FROM voyages 
  WHERE id = voyage_id_param;
  
  -- If precise duration is available, return it
  IF precise_duration IS NOT NULL AND precise_duration > 0 THEN
    RETURN precise_duration;
  END IF;
  
  -- Otherwise, calculate from actual_duration (minutes) and mark precision level
  SELECT COALESCE(actual_duration, 0) * 60000 INTO fallback_duration
  FROM voyages 
  WHERE id = voyage_id_param;
  
  RETURN COALESCE(fallback_duration, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get planned duration with precision
CREATE OR REPLACE FUNCTION get_voyage_planned_duration_precise(voyage_id_param uuid)
RETURNS bigint AS $$
DECLARE
  precise_planned bigint;
  fallback_planned bigint;
BEGIN
  -- Try to get high precision planned duration first
  SELECT planned_duration_ms INTO precise_planned
  FROM voyages 
  WHERE id = voyage_id_param;
  
  -- If precise duration is available, return it
  IF precise_planned IS NOT NULL AND precise_planned > 0 THEN
    RETURN precise_planned;
  END IF;
  
  -- Otherwise, calculate from planned_duration (minutes)
  SELECT COALESCE(planned_duration, 0) * 60000 INTO fallback_planned
  FROM voyages 
  WHERE id = voyage_id_param;
  
  RETURN COALESCE(fallback_planned, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced statistics calculation with high precision
CREATE OR REPLACE FUNCTION calculate_voyage_statistics_precise(voyage_id_param uuid)
RETURNS void AS $$
DECLARE
  v_total_distraction_time integer := 0;
  v_distraction_count integer := 0;
  v_avg_duration real := 0;
  v_return_count integer := 0;
  v_most_common_type text;
  v_focus_score integer;
  v_voyage_duration_ms bigint;
BEGIN
  -- Get precise voyage duration in milliseconds
  SELECT get_voyage_precise_duration(voyage_id_param) INTO v_voyage_duration_ms;

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

  -- Calculate focus quality score using precise duration
  IF v_voyage_duration_ms > 0 THEN
    -- Convert voyage duration to seconds for comparison
    v_focus_score := 100 
      - LEAST(50, v_distraction_count * 5)  -- Max 50 points for frequency
      - LEAST(50, ROUND((v_total_distraction_time::real / (v_voyage_duration_ms::real / 1000)) * 100)); -- Max 50 points for time lost
    
    -- Ensure score is between 0 and 100
    v_focus_score := GREATEST(0, LEAST(100, v_focus_score));
  ELSE
    v_focus_score := 100;
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced assessment data function with precision timing
CREATE OR REPLACE FUNCTION get_voyage_assessment_data_precise(voyage_id_param uuid)
RETURNS json AS $$
DECLARE
  voyage_data json;
  distraction_data json;
  exploration_data json;
  assessment_data json;
  precise_duration bigint;
  planned_duration_precise bigint;
  voyage_precision text;
BEGIN
  -- Get precise durations and precision level
  SELECT 
    get_voyage_precise_duration(voyage_id_param),
    get_voyage_planned_duration_precise(voyage_id_param),
    COALESCE(precision_level, 'minute')
  INTO precise_duration, planned_duration_precise, voyage_precision;

  -- Get main voyage data with destination and precise timing
  SELECT json_build_object(
    'voyage', json_build_object(
      'id', v.id,
      'user_id', v.user_id,
      'destination_id', v.destination_id,
      'start_time', v.start_time,
      'end_time', v.end_time,
      'planned_duration', v.planned_duration,
      'actual_duration', v.actual_duration,
      'planned_duration_ms', planned_duration_precise,
      'actual_duration_ms', precise_duration,
      'precision_level', voyage_precision,
      'distraction_count', v.distraction_count,
      'status', v.status,
      'weather_mood', v.weather_mood,
      'created_at', v.created_at,
      'total_distraction_time', v.total_distraction_time,
      'focus_quality_score', v.focus_quality_score,
      'avg_distraction_duration', v.avg_distraction_duration,
      'return_to_course_rate', v.return_to_course_rate,
      'most_common_distraction', v.most_common_distraction
    ),
    'destination', row_to_json(d.*)
  ) INTO voyage_data
  FROM voyages v
  LEFT JOIN destinations d ON v.destination_id = d.id
  WHERE v.id = voyage_id_param;

  -- Get distraction events summary with type classification
  WITH distraction_events_with_duration AS (
    SELECT 
      *,
      CASE 
        WHEN duration_seconds IS NOT NULL AND duration_seconds > 0 THEN duration_seconds
        WHEN is_resolved = false THEN 30
        ELSE 0
      END as effective_duration,
      -- Classify distraction types for better analytics
      CASE 
        WHEN type IN ('tab_switch', 'window_switch', 'new_tab_opened', 'tab_closed') THEN 'navigation'
        WHEN type IN ('social_media', 'entertainment', 'shopping', 'news_browsing') THEN 'content'
        WHEN type IN ('camera_absence', 'looking_away', 'phone_usage', 'conversation') THEN 'physical'
        WHEN type IN ('idle', 'extended_break', 'task_switching') THEN 'activity'
        WHEN type IN ('notification_popup', 'external_interruption') THEN 'environmental'
        ELSE 'other'
      END as distraction_category
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
  ),
  distraction_categories AS (
    SELECT COALESCE(json_object_agg(distraction_category, count), '{}'::json) as by_category
    FROM (
      SELECT distraction_category, COUNT(*) as count
      FROM distraction_events_with_duration
      GROUP BY distraction_category
    ) c
  )
  SELECT json_build_object(
    'events', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', de.id,
          'type', de.type,
          'category', de.distraction_category,
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
      'by_category', dc.by_category,
      'total_time', ds.total_time,
      'avg_duration', ROUND(ds.avg_duration::numeric, 1),
      'return_rate', ROUND(ds.return_rate::numeric, 1)
    )
  ) INTO distraction_data
  FROM distraction_summary ds
  CROSS JOIN distraction_types dt
  CROSS JOIN distraction_categories dc;

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

  -- Combine all data with precision metadata
  SELECT json_build_object(
    'voyage', voyage_data,
    'distractions', distraction_data,
    'exploration_notes', exploration_data,
    'precision', json_build_object(
      'level', voyage_precision,
      'has_millisecond_data', precise_duration IS NOT NULL,
      'duration_ms', precise_duration,
      'planned_duration_ms', planned_duration_precise
    )
  ) INTO assessment_data;

  RETURN assessment_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to format precise duration for display
CREATE OR REPLACE FUNCTION format_precise_duration(duration_ms bigint)
RETURNS text AS $$
DECLARE
  total_seconds numeric;
  minutes integer;
  seconds numeric;
BEGIN
  IF duration_ms IS NULL OR duration_ms = 0 THEN
    RETURN '00:00.00';
  END IF;
  
  total_seconds := duration_ms::numeric / 1000.0;
  minutes := floor(total_seconds / 60);
  seconds := total_seconds - (minutes * 60);
  
  RETURN to_char(minutes, 'FM00') || ':' || to_char(seconds, 'FM00.00');
END;
$$ LANGUAGE plpgsql;

-- Function to migrate legacy duration data to precise format
CREATE OR REPLACE FUNCTION migrate_legacy_duration_data()
RETURNS integer AS $$
DECLARE
  migration_count integer := 0;
BEGIN
  -- Update voyages that have actual_duration but no actual_duration_ms
  UPDATE voyages 
  SET 
    actual_duration_ms = actual_duration * 60000,
    planned_duration_ms = CASE 
      WHEN planned_duration IS NOT NULL THEN planned_duration * 60000
      ELSE NULL
    END,
    precision_level = 'minute'
  WHERE actual_duration IS NOT NULL 
    AND actual_duration_ms IS NULL;
  
  GET DIAGNOSTICS migration_count = ROW_COUNT;
  
  RETURN migration_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_voyages_actual_duration_ms ON voyages(actual_duration_ms);
CREATE INDEX IF NOT EXISTS idx_voyages_planned_duration_ms ON voyages(planned_duration_ms);
CREATE INDEX IF NOT EXISTS idx_voyages_precision_level ON voyages(precision_level);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_voyage_precise_duration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_planned_duration_precise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_voyage_statistics_precise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_assessment_data_precise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION format_precise_duration(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_legacy_duration_data() TO authenticated;

-- Migrate existing data to have precision metadata
SELECT migrate_legacy_duration_data();