/*
  # Database Functions for MindBoat Analytics

  1. Performance Functions
    - get_user_voyage_stats: User statistics aggregation
    - get_destinations_with_stats: Destinations with usage data
    - get_distraction_patterns: Distraction analytics
    - increment_distraction_count: Atomic counter updates
    - get_voyage_distraction_summary: Voyage distraction details
    - get_voyage_stats_by_date: Date range statistics
    - cleanup_old_distraction_events: Maintenance function

  2. Views
    - voyage_analytics: Comprehensive voyage insights with categorization

  3. Indexes
    - Performance indexes for common queries

  4. Security
    - SECURITY DEFINER functions with proper grants
    - Proper parameter naming to avoid conflicts
*/

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
  ),
  trend_calculation AS (
    SELECT 
      weekly_count,
      ROW_NUMBER() OVER (ORDER BY week) as week_num,
      COUNT(*) OVER () as total_weeks
    FROM weekly_trends
  )
  SELECT 
    (SELECT type FROM type_counts LIMIT 1) as most_common_type,
    (SELECT AVG(duration_seconds) FROM distraction_data WHERE duration_seconds IS NOT NULL) as average_duration,
    ARRAY(SELECT hour_of_day::INTEGER FROM hourly_patterns) as peak_distraction_hours,
    CASE 
      WHEN (SELECT COUNT(*) FROM weekly_trends) >= 2 THEN
        (SELECT 
          ((SELECT weekly_count FROM trend_calculation WHERE week_num = total_weeks) - 
           (SELECT weekly_count FROM trend_calculation WHERE week_num = 1))::NUMERIC /
          NULLIF((SELECT weekly_count FROM trend_calculation WHERE week_num = 1), 0) * 100
         FROM trend_calculation LIMIT 1)
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
  WITH distraction_stats AS (
    SELECT 
      COUNT(*) as total_count,
      SUM(COALESCE(duration_seconds, 0)) as total_seconds,
      SUM(CASE WHEN user_response = 'return_to_course' THEN 1 ELSE 0 END) as returned_count,
      COALESCE(
        jsonb_object_agg(
          type, 
          COUNT(*) ORDER BY type
        ) FILTER (WHERE type IS NOT NULL),
        '{}'::JSONB
      ) as type_breakdown
    FROM distraction_events
    WHERE voyage_id = p_voyage_id
    GROUP BY ()
  )
  SELECT 
    COALESCE(total_count, 0) as total_distractions,
    COALESCE(type_breakdown, '{}'::JSONB) as by_type,
    COALESCE(total_seconds, 0) as total_distraction_time,
    CASE 
      WHEN COALESCE(total_count, 0) > 0 THEN (COALESCE(returned_count, 0)::NUMERIC / total_count * 100)
      ELSE 0
    END as return_to_course_rate
  FROM distraction_stats;
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_voyage_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_destinations_with_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_distraction_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_distraction_patterns(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_distraction_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voyage_stats_by_date(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_distraction_events(INTEGER) TO service_role;

-- Create indexes for performance (if not already exists)
CREATE INDEX IF NOT EXISTS idx_voyages_user_status ON voyages(user_id, status);
CREATE INDEX IF NOT EXISTS idx_voyages_start_time ON voyages(start_time);
CREATE INDEX IF NOT EXISTS idx_distraction_events_detected_at ON distraction_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_distraction_events_type ON distraction_events(type);
CREATE INDEX IF NOT EXISTS idx_daily_reflections_date ON daily_reflections(date);
CREATE INDEX IF NOT EXISTS idx_distraction_events_voyage_id_type ON distraction_events(voyage_id, type);

-- Create a view for voyage analytics dashboard
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

-- Grant access to the view
GRANT SELECT ON voyage_analytics TO authenticated;