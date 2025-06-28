/*
  # Fix Focus Quality and Distraction Statistics Calculation

  1. Improved Statistics Calculation
    - Fix focus quality to account for actual distraction patterns
    - Ensure distraction count is properly updated
    - Add simple but effective focus quality formula

  2. Enhanced Data Integrity
    - Better handling of incomplete distraction records
    - More accurate time calculations
    - Fallback calculations for edge cases
*/

-- Drop and recreate the statistics calculation function with better logic
DROP FUNCTION IF EXISTS calculate_voyage_statistics(uuid);

CREATE OR REPLACE FUNCTION calculate_voyage_statistics(voyage_id_param uuid)
RETURNS void AS $$
DECLARE
  v_total_distraction_time integer := 0;
  v_distraction_count integer := 0;
  v_resolved_count integer := 0;
  v_avg_duration real := 0;
  v_return_count integer := 0;
  v_most_common_type text;
  v_focus_score integer;
  v_voyage_duration integer;
BEGIN
  -- Get voyage duration in minutes
  SELECT COALESCE(actual_duration, 0) INTO v_voyage_duration
  FROM voyages WHERE id = voyage_id_param;

  -- Count total distraction events (including unresolved ones)
  SELECT COUNT(*) INTO v_distraction_count
  FROM distraction_events 
  WHERE voyage_id = voyage_id_param;

  -- Calculate total distraction time from resolved events
  SELECT 
    COALESCE(SUM(duration_seconds), 0),
    COUNT(*),
    COALESCE(AVG(duration_seconds), 0)
  INTO v_total_distraction_time, v_resolved_count, v_avg_duration
  FROM distraction_events 
  WHERE voyage_id = voyage_id_param AND duration_seconds IS NOT NULL AND duration_seconds > 0;

  -- For unresolved distractions, estimate 30 seconds each (conservative estimate)
  v_total_distraction_time := v_total_distraction_time + ((v_distraction_count - v_resolved_count) * 30);

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

  -- Calculate focus quality score using a simple but effective formula
  -- Start with 100, subtract points for distractions and time lost
  IF v_voyage_duration > 0 THEN
    -- Subtract 5 points per distraction (up to 50 points max)
    -- Subtract points based on distraction time percentage (up to 50 points max)
    v_focus_score := 100 
      - LEAST(50, v_distraction_count * 5)
      - LEAST(50, ROUND((v_total_distraction_time::real / (v_voyage_duration * 60)) * 100));
    
    -- Ensure score is between 0 and 100
    v_focus_score := GREATEST(0, LEAST(100, v_focus_score));
  ELSE
    v_focus_score := 0;
  END IF;

  -- Update voyage with calculated statistics
  UPDATE voyages SET
    distraction_count = v_distraction_count, -- Ensure this matches database count
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
  RAISE NOTICE 'Voyage % stats: duration=%min, distractions=%, time=%s, score=%', 
    voyage_id_param, v_voyage_duration, v_distraction_count, v_total_distraction_time, v_focus_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the assessment data function to handle edge cases better
DROP FUNCTION IF EXISTS get_voyage_assessment_data(uuid);

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

  -- Get distraction events summary with better null handling
  WITH distraction_summary AS (
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(COALESCE(duration_seconds, 0)), 0) as total_time,
      CASE 
        WHEN COUNT(*) FILTER (WHERE duration_seconds IS NOT NULL AND duration_seconds > 0) > 0 
        THEN AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL AND duration_seconds > 0)
        ELSE 0 
      END as avg_duration,
      COALESCE(
        (COUNT(*) FILTER (WHERE user_response = 'return_to_course')::real / NULLIF(COUNT(*), 0) * 100),
        0
      ) as return_rate
    FROM distraction_events 
    WHERE voyage_id = voyage_id_param
  ),
  distraction_types AS (
    SELECT json_object_agg(type, count) as by_type
    FROM (
      SELECT type, COUNT(*) as count
      FROM distraction_events
      WHERE voyage_id = voyage_id_param
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
          'duration_seconds', COALESCE(de.duration_seconds, 0),
          'user_response', de.user_response,
          'position_x', de.position_x,
          'position_y', de.position_y,
          'context_url', de.context_url,
          'is_resolved', de.is_resolved
        ) ORDER BY de.detected_at
      ) FROM distraction_events de WHERE de.voyage_id = voyage_id_param),
      '[]'::json
    ),
    'summary', json_build_object(
      'total_count', ds.total_count,
      'by_type', COALESCE(dt.by_type, '{}'::json),
      'total_time', ds.total_time,
      'avg_duration', ROUND(ds.avg_duration::numeric, 1),
      'return_rate', ROUND(ds.return_rate::numeric, 1)
    )
  ) INTO distraction_data
  FROM distraction_summary ds
  CROSS JOIN distraction_types dt;

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