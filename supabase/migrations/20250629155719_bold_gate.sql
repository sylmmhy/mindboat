/*
  # Create voyage assessment RPC functions

  1. RPC Functions
    - `calculate_voyage_statistics_precise` - Calculates and updates voyage statistics
    - `get_voyage_assessment_data_precise` - Returns comprehensive voyage assessment data
  
  2. Purpose
    - Support high-precision voyage analytics and assessment
    - Provide structured data for voyage completion screens
    - Calculate focus quality scores and distraction metrics
*/

-- Function to calculate and update voyage statistics
CREATE OR REPLACE FUNCTION calculate_voyage_statistics_precise(voyage_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_distraction_count integer;
  v_total_distraction_time integer;
  v_avg_distraction_duration real;
  v_most_common_distraction text;
  v_return_to_course_rate real;
  v_focus_quality_score integer;
  v_longest_focus_period integer;
  v_actual_duration integer;
BEGIN
  -- Get basic voyage info
  SELECT actual_duration INTO v_actual_duration
  FROM voyages 
  WHERE id = voyage_id_param;
  
  -- Calculate distraction statistics
  SELECT 
    COUNT(*),
    COALESCE(SUM(duration_seconds), 0),
    COALESCE(AVG(duration_seconds), 0),
    (
      SELECT type 
      FROM distraction_events 
      WHERE voyage_id = voyage_id_param 
      GROUP BY type 
      ORDER BY COUNT(*) DESC 
      LIMIT 1
    ),
    COALESCE(
      (COUNT(CASE WHEN user_response = 'return_to_course' THEN 1 END)::real / 
       NULLIF(COUNT(*), 0)) * 100, 
      100
    )
  INTO v_distraction_count, v_total_distraction_time, v_avg_distraction_duration, 
       v_most_common_distraction, v_return_to_course_rate
  FROM distraction_events 
  WHERE voyage_id = voyage_id_param;
  
  -- Calculate focus quality score (0-100)
  v_focus_quality_score := CASE 
    WHEN v_actual_duration = 0 THEN 100
    WHEN v_distraction_count = 0 THEN 100
    ELSE GREATEST(0, 100 - (v_distraction_count * 10) - LEAST(50, (v_total_distraction_time * 100 / (v_actual_duration * 60))))
  END;
  
  -- Calculate longest focus period (simplified)
  v_longest_focus_period := COALESCE(v_actual_duration * 60 / GREATEST(1, v_distraction_count + 1), v_actual_duration * 60);
  
  -- Update voyage record
  UPDATE voyages 
  SET 
    distraction_count = v_distraction_count,
    total_distraction_time = v_total_distraction_time,
    avg_distraction_duration = v_avg_distraction_duration,
    most_common_distraction = v_most_common_distraction,
    return_to_course_rate = v_return_to_course_rate,
    focus_quality_score = v_focus_quality_score,
    longest_focus_period = v_longest_focus_period
  WHERE id = voyage_id_param;
END;
$$;

-- Function to get comprehensive voyage assessment data
CREATE OR REPLACE FUNCTION get_voyage_assessment_data_precise(voyage_id_param uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  -- Get voyage data with destination
  WITH voyage_data AS (
    SELECT 
      v.*,
      d.destination_name,
      d.description as destination_description,
      d.original_task,
      d.color_theme,
      d.related_apps
    FROM voyages v
    LEFT JOIN destinations d ON v.destination_id = d.id
    WHERE v.id = voyage_id_param
  ),
  distraction_summary AS (
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(duration_seconds), 0) as total_time,
      COALESCE(AVG(duration_seconds), 0) as avg_duration,
      COALESCE(
        (COUNT(CASE WHEN user_response = 'return_to_course' THEN 1 END)::real / 
         NULLIF(COUNT(*), 0)) * 100, 
        100
      ) as return_rate,
      json_object_agg(
        COALESCE(type, 'unknown'), 
        type_count
      ) as by_type
    FROM (
      SELECT 
        type,
        duration_seconds,
        user_response,
        COUNT(*) as type_count
      FROM distraction_events 
      WHERE voyage_id = voyage_id_param
      GROUP BY type, duration_seconds, user_response
    ) t
  ),
  distraction_events AS (
    SELECT json_agg(
      json_build_object(
        'id', id,
        'type', type,
        'detected_at', detected_at,
        'duration_seconds', COALESCE(duration_seconds, 0),
        'user_response', COALESCE(user_response, ''),
        'position_x', COALESCE(position_x, 0),
        'position_y', COALESCE(position_y, 0),
        'context_url', COALESCE(context_url, ''),
        'is_resolved', COALESCE(is_resolved, false)
      )
    ) as events
    FROM distraction_events 
    WHERE voyage_id = voyage_id_param
    ORDER BY detected_at
  ),
  exploration_notes AS (
    SELECT json_agg(
      json_build_object(
        'id', id,
        'content', content,
        'type', type,
        'created_at', created_at
      )
    ) as notes
    FROM exploration_notes 
    WHERE voyage_id = voyage_id_param
    ORDER BY created_at
  )
  SELECT json_build_object(
    'voyage', json_build_object(
      'voyage', row_to_json(vd.*),
      'destination', json_build_object(
        'destination_name', vd.destination_name,
        'description', vd.destination_description,
        'original_task', vd.original_task,
        'color_theme', vd.color_theme,
        'related_apps', vd.related_apps
      )
    ),
    'distractions', json_build_object(
      'events', COALESCE(de.events, '[]'::json),
      'summary', json_build_object(
        'total_count', COALESCE(ds.total_count, 0),
        'by_type', COALESCE(ds.by_type, '{}'::json),
        'total_time', COALESCE(ds.total_time, 0),
        'avg_duration', COALESCE(ds.avg_duration, 0),
        'return_rate', COALESCE(ds.return_rate, 100)
      )
    ),
    'exploration_notes', COALESCE(en.notes, '[]'::json)
  )
  INTO result
  FROM voyage_data vd
  CROSS JOIN distraction_summary ds
  CROSS JOIN distraction_events de
  CROSS JOIN exploration_notes en;
  
  RETURN result;
END;
$$;