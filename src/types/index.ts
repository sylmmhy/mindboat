export interface User {
  id: string;
  email: string;
  lighthouse_goal?: string;
  created_at: string;
  updated_at: string;
}

export interface Destination {
  id: string;
  user_id: string;
  original_task: string;
  destination_name: string;
  description: string;
  related_apps: string[];
  color_theme: string;
  created_at: string;
}

export interface Voyage {
  id: string;
  user_id: string;
  destination_id: string;
  destination?: Destination;
  start_time: string;
  end_time?: string;
  planned_duration?: number; // minutes
  actual_duration?: number; // minutes
  distraction_count: number;
  status: 'active' | 'completed' | 'abandoned';
  weather_mood: string;
  created_at: string;
}

export interface DistractionEvent {
  id: string;
  voyage_id: string;
  detected_at: string;
  duration_seconds?: number;
  type: 'tab_switch' | 'idle' | 'camera_distraction';
  user_response?: 'return_to_course' | 'exploring' | 'ignored';
}

export interface DailyReflection {
  id: string;
  user_id: string;
  date: string;
  reflection_text?: string;
  total_focus_time: number; // minutes
  voyage_count: number;
  generated_at: string;
}

export interface DistractionDetectionEvent {
  type: 'tab_switch' | 'window_switch' | 'new_tab_opened' | 'tab_closed' |
        'social_media' | 'entertainment' | 'shopping' | 'news_browsing' | 'irrelevant_browsing' |
        'camera_absence' | 'looking_away' | 'phone_usage' | 'eating_drinking' | 'conversation' |
        'idle' | 'extended_break' | 'task_switching' |
        'notification_popup' | 'external_interruption' |
        'camera_distraction' | 'blacklisted_content'; // Legacy types
  timestamp: number;
  duration?: number;
}

export interface PermissionState {
  camera: boolean;
  microphone: boolean;
  screen: boolean;
}