/*
  # Fix voyage assessment data functions

  1. New Functions
    - `calculate_voyage_statistics_precise` - Calculates voyage statistics with proper aggregation
    - `get_voyage_assessment_data_precise` - Returns complete voyage assessment data
  
  2. Purpose
    - Fix SQL GROUP BY errors in voyage assessment queries
    - Provide proper data structure for VoyageComplete component
    - Handle distraction events aggregation correctly
  
  3. Security
    - Functions respect RLS policies
    - Only return data for authenticated users' own voyages
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS calculate_voyage_statistics_precise(uuid);
DROP FUNCTION IF EXISTS get_voyage_assessment_data_precise(uuid);

-- Function to calculate voyage statistics with proper aggregation
CREATE OR REPLACE FUNCTION calculate_voyage_statistics_precise(voyage_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_distraction_count integer;
  v_total_distraction_time integer;
  v_avg_distraction_duration real;
  v_return_to_course_rate real;
  v_most_common_distraction text;
  v_focus_quality_score integer;
  v_longest_focus_period integer;
  v_voyage_duration integer;
BEGIN
  -- Check if voyage exists and belongs to current user
  IF NOT EXISTS (
    SELECT 1 FROM voyages 
    WHERE id = voyage_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Voyage not found or access denied';
  END IF;

  -- Calculate distraction statistics
  SELECT 
    COUNT(*),
    COALESCE(SUM(duration_seconds), 0),
    COALESCE(AVG(duration_seconds), 0),
    COALESCE(COUNT(*) FILTER (WHERE is_resolved = true)::real / NULLIF(COUNT(*), 0), 0) * 100
  INTO 
    v_distraction_count,
    v_total_distraction_time,
    v_avg_distraction_duration,
    v_return_to_course_rate
  FROM distraction_events
  WHERE voyage_id = voyage_id_param;

  -- Find most common distraction type
  SELECT type
  INTO v_most_common_distraction
  FROM distraction_events
  WHERE voyage_id = voyage_id_param
  GROUP BY type
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Get voyage duration for focus quality calculation
  SELECT 
    COALESCE(actual_duration, planned_duration, 0)
  INTO v_voyage_duration
  FROM voyages
  WHERE id = voyage_id_param;

  -- Calculate focus quality score (0-100)
  IF v_voyage_duration > 0 THEN
    v_focus_quality_score := GREATEST(0, 
      100 - (v_total_distraction_time::real / (v_voyage_duration * 60) * 100)::integer
    );
  ELSE
    v_focus_quality_score := 100;
  END IF;

  -- Calculate longest focus period (simplified - time between distractions)
  WITH distraction_gaps AS (
    SELECT 
      EXTRACT(EPOCH FROM (detected_at - LAG(detected_at) OVER (ORDER BY detected_at))) as gap_seconds
    FROM distraction_events
    WHERE voyage_id = voyage_id_param
  )
  SELECT COALESCE(MAX(gap_seconds)::integer, v_voyage_duration * 60)
  INTO v_longest_focus_period
  FROM distraction_gaps;

  -- Update voyage with calculated statistics
  UPDATE voyages
  SET 
    distraction_count = v_distraction_count,
    total_distraction_time = v_total_distraction_time,
    avg_distraction_duration = v_avg_distraction_duration,
    return_to_course_rate = v_return_to_course_rate,
    most_common_distraction = v_most_common_distraction,
    focus_quality_score = v_focus_quality_score,
    longest_focus_period = v_longest_focus_period
  WHERE id = voyage_id_param;
END;
$$;

-- Function to get comprehensive voyage assessment data
CREATE OR REPLACE FUNCTION get_voyage_assessment_data_precise(voyage_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  voyage_data json;
  distraction_data json;
  notes_data json;
BEGIN
  -- Check if voyage exists and belongs to current user
  IF NOT EXISTS (
    SELECT 1 FROM voyages 
    WHERE id = voyage_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Voyage not found or access denied';
  END IF;

  -- Get voyage and destination data
  SELECT json_build_object(
    'voyage', row_to_json(v.*),
    'destination', row_to_json(d.*)
  )
  INTO voyage_data
  FROM voyages v
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.id = voyage_id_param;

  -- Get distraction events and summary (fixing GROUP BY issue)
  WITH distraction_summary AS (
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(duration_seconds), 0) as total_time,
      COALESCE(AVG(duration_seconds), 0) as avg_duration,
      COALESCE(COUNT(*) FILTER (WHERE is_resolved = true)::real / NULLIF(COUNT(*), 0), 0) * 100 as return_rate
    FROM distraction_events
    WHERE voyage_id = voyage_id_param
  ),
  distraction_by_type AS (
    SELECT json_object_agg(type, type_count) as by_type
    FROM (
      SELECT type, COUNT(*) as type_count
      FROM distraction_events
      WHERE voyage_id = voyage_id_param
      GROUP BY type
    ) t
  ),
  distraction_events_array AS (
    SELECT json_agg(
      json_build_object(
        'id', id,
        'type', type,
        'detected_at', detected_at,
        'duration_seconds', duration_seconds,
        'user_response', user_response,
        'position_x', position_x,
        'position_y', position_y,
        'context_url', context_url,
        'is_resolved', is_resolved
      )
      ORDER BY detected_at
    ) as events
    FROM distraction_events
    WHERE voyage_id = voyage_id_param
  )
  SELECT json_build_object(
    'events', COALESCE(dea.events, '[]'::json),
    'summary', json_build_object(
      'total_count', ds.total_count,
      'by_type', COALESCE(dbt.by_type, '{}'::json),
      'total_time', ds.total_time,
      'avg_duration', ds.avg_duration,
      'return_rate', ds.return_rate
    )
  )
  INTO distraction_data
  FROM distraction_summary ds
  CROSS JOIN distraction_by_type dbt
  CROSS JOIN distraction_events_array dea;

  -- Get exploration notes
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'content', content,
      'type', type,
      'created_at', created_at
    )
    ORDER BY created_at
  ), '[]'::json)
  INTO notes_data
  FROM exploration_notes
  WHERE voyage_id = voyage_id_param;

  -- Combine all data
  result := json_build_object(
    'voyage', voyage_data,
    'distractions', distraction_data,
    'exploration_notes', notes_data
  );

  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION calculate_voyage_statistics_precise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_assessment_data_precise(uuid) TO authenticated;