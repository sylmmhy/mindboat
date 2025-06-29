/*
  # MindBoat Analytics Functions - Complete Implementation

  1. Voyage Statistics Functions
    - calculate_voyage_statistics: Calculate focus quality and distraction metrics
    - get_voyage_assessment_data: Comprehensive voyage data for completion screen
    - get_user_voyage_stats: User-level statistics aggregation
    - get_destinations_with_stats: Destinations with usage analytics

  2. Distraction Analysis Functions
    - increment_distraction_count: Atomic distraction counter updates
    - get_distraction_patterns: User distraction patterns and trends
    - get_voyage_distraction_summary: Per-voyage distraction analysis

  3. Utility Functions
    - get_voyage_stats_by_date: Date range statistics
    - cleanup_old_distraction_events: Maintenance function

  4. Analytics View
    - voyage_analytics: Comprehensive voyage insights dashboard
*/

-- Function to calculate comprehensive voyage statistics
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive voyage assessment data
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

-- Function to get user voyage statistics
CREATE OR REPLACE FUNCTION get_user_voyage_stats(p_user_id UUID)
RETURNS TABLE (
  total_voyages BIGINT,
  total_focus_time BIGINT,
  average_focus_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_voyages,
    COALESCE(SUM(actual_duration), 0) as total_focus_time,
    COALESCE(AVG(actual_duration), 0) as average_focus_time
  FROM voyages
  WHERE voyages.user_id = p_user_id
    AND status = 'completed'
    AND actual_duration IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get destinations with voyage statistics
CREATE OR REPLACE FUNCTION get_destinations_with_stats(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  original_task TEXT,
  destination_name TEXT,
  description TEXT,
  related_apps TEXT[],
  color_theme TEXT,
  created_at TIMESTAMPTZ,
  voyage_count BIGINT,
  total_focus_time BIGINT,
  last_visited TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.user_id,
    d.original_task,
    d.destination_name,
    d.description,
    d.related_apps,
    d.color_theme,
    d.created_at,
    COALESCE(COUNT(v.id), 0) as voyage_count,
    COALESCE(SUM(v.actual_duration), 0) as total_focus_time,
    MAX(v.end_time) as last_visited
  FROM destinations d
  LEFT JOIN voyages v ON d.id = v.destination_id AND v.status = 'completed'
  WHERE d.user_id = p_user_id
  GROUP BY d.id, d.user_id, d.original_task, d.destination_name, 
           d.description, d.related_apps, d.color_theme, d.created_at
  ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment distraction count atomically
CREATE OR REPLACE FUNCTION increment_distraction_count(p_voyage_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE voyages 
  SET distraction_count = distraction_count + 1 
  WHERE id = p_voyage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get distraction patterns
CREATE OR REPLACE FUNCTION get_distraction_patterns(p_user_id UUID, p_days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  most_common_type TEXT,
  average_duration NUMERIC,
  peak_distraction_hours INTEGER[],
  improvement_trend NUMERIC
) AS $$
DECLARE
  start_date TIMESTAMPTZ;
BEGIN
  start_date := NOW() - (p_days_back || ' days')::INTERVAL;
  
  RETURN QUERY
  WITH distraction_data AS (
    SELECT 
      de.type,
      de.duration_seconds,
      EXTRACT(HOUR FROM de.detected_at) as hour_of_day,
      DATE(de.detected_at) as event_date
    FROM distraction_events de
    JOIN voyages v ON de.voyage_id = v.id
    WHERE v.user_id = p_user_id
      AND de.detected_at >= start_date
  ),
  type_counts AS (
    SELECT type, COUNT(*) as count
    FROM distraction_data
    GROUP BY type
    ORDER BY count DESC
    LIMIT 1
  ),
  hourly_patterns AS (
    SELECT hour_of_day, COUNT(*) as distraction_count
    FROM distraction_data
    GROUP BY hour_of_day
    ORDER BY distraction_count DESC
    LIMIT 3
  ),
  weekly_trends AS (
    SELECT 
      DATE_TRUNC('week', event_date) as week,
      COUNT(*) as weekly_count
    FROM distraction_data
    GROUP BY DATE_TRUNC('week', event_date)
    ORDER BY week
  )
  SELECT 
    (SELECT type FROM type_counts LIMIT 1) as most_common_type,
    (SELECT AVG(duration_seconds) FROM distraction_data WHERE duration_seconds IS NOT NULL) as average_duration,
    ARRAY(SELECT hour_of_day::INTEGER FROM hourly_patterns) as peak_distraction_hours,
    CASE 
      WHEN (SELECT COUNT(*) FROM weekly_trends) >= 2 THEN
        (SELECT 
          (LAST_VALUE(weekly_count) OVER (ORDER BY week ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) - 
           FIRST_VALUE(weekly_count) OVER (ORDER BY week ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING))::NUMERIC /
          NULLIF(FIRST_VALUE(weekly_count) OVER (ORDER BY week ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING), 0) * 100
         FROM weekly_trends LIMIT 1)
      ELSE 0
    END as improvement_trend;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get voyage distraction summary
CREATE OR REPLACE FUNCTION get_voyage_distraction_summary(p_voyage_id UUID)
RETURNS TABLE (
  total_distractions BIGINT,
  by_type JSONB,
  total_distraction_time BIGINT,
  return_to_course_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH distraction_events_data AS (
    SELECT 
      type,
      duration_seconds,
      user_response
    FROM distraction_events
    WHERE voyage_id = p_voyage_id
  ),
  distraction_stats AS (
    SELECT 
      COUNT(*) as total_count,
      SUM(COALESCE(duration_seconds, 0)) as total_seconds,
      SUM(CASE WHEN user_response = 'return_to_course' THEN 1 ELSE 0 END) as returned_count
    FROM distraction_events_data
  ),
  type_aggregation AS (
    SELECT 
      COALESCE(
        jsonb_object_agg(type, type_count) FILTER (WHERE type IS NOT NULL),
        '{}'::JSONB
      ) as type_breakdown
    FROM (
      SELECT 
        type,
        COUNT(*) as type_count
      FROM distraction_events_data
      WHERE type IS NOT NULL
      GROUP BY type
    ) type_counts
  )
  SELECT 
    COALESCE(ds.total_count, 0) as total_distractions,
    ta.type_breakdown as by_type,
    COALESCE(ds.total_seconds, 0) as total_distraction_time,
    CASE 
      WHEN COALESCE(ds.total_count, 0) > 0 THEN (COALESCE(ds.returned_count, 0)::NUMERIC / ds.total_count * 100)
      ELSE 0
    END as return_to_course_rate
  FROM distraction_stats ds
  CROSS JOIN type_aggregation ta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get voyage statistics by date range
CREATE OR REPLACE FUNCTION get_voyage_stats_by_date(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_voyages BIGINT,
  total_focus_time BIGINT,
  average_duration NUMERIC,
  total_distractions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(v.id) as total_voyages,
    COALESCE(SUM(v.actual_duration), 0) as total_focus_time,
    COALESCE(AVG(v.actual_duration), 0) as average_duration,
    COALESCE(SUM(v.distraction_count), 0) as total_distractions
  FROM voyages v
  WHERE v.user_id = p_user_id
    AND v.status = 'completed'
    AND v.start_time >= p_start_date
    AND v.start_time <= p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old distraction events (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_distraction_events(p_days_to_keep INTEGER DEFAULT 90)
RETURNS BIGINT AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM distraction_events
    WHERE detected_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for voyage analytics dashboard
-- Note: Views automatically inherit RLS from underlying tables
CREATE OR REPLACE VIEW voyage_analytics AS
SELECT 
  v.id,
  v.user_id,
  v.start_time,
  v.end_time,
  v.actual_duration,
  v.distraction_count,
  v.status,
  d.destination_name,
  d.color_theme,
  EXTRACT(HOUR FROM v.start_time) as start_hour,
  EXTRACT(DOW FROM v.start_time) as day_of_week,
  CASE 
    WHEN v.actual_duration >= 60 THEN 'long'
    WHEN v.actual_duration >= 25 THEN 'medium'
    ELSE 'short'
  END as session_length,
  CASE 
    WHEN v.distraction_count = 0 THEN 'excellent'
    WHEN v.distraction_count <= 2 THEN 'good'
    WHEN v.distraction_count <= 5 THEN 'fair'
    ELSE 'needs_improvement'
  END as focus_quality
FROM voyages v
JOIN destinations d ON v.destination_id = d.id
WHERE v.status = 'completed';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION calculate_voyage_statistics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_assessment_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_voyage_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_destinations_with_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_distraction_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_distraction_patterns(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_distraction_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_stats_by_date(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT SELECT ON voyage_analytics TO authenticated;