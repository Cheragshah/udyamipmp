export type AppRole = 'admin' | 'coach' | 'participant' | 'ecommerce' | 'finance';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  assigned_coach_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface AppSettings {
  id: string;
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  created_at: string;
  updated_at: string;
}

export interface JourneyStage {
  id: string;
  name: string;
  description: string | null;
  stage_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  stage_id: string | null;
  title: string;
  description: string | null;
  guidelines: string | null;
  task_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ParticipantProgress {
  id: string;
  user_id: string;
  stage_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TaskSubmission {
  id: string;
  user_id: string;
  task_id: string;
  submission_notes: string | null;
  attachment_url: string | null;
  status: 'not_started' | 'in_progress' | 'submitted' | 'verified' | 'rejected';
  verified_by: string | null;
  verification_notes: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  document_type: 'iec' | 'gst' | 'rcmc' | 'udyam_aadhar' | 'shop_act' | 'pan_card' | 'other';
  document_name: string;
  file_url: string | null;
  status: 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  reviewed_by: string | null;
  review_notes: string | null;
  expiry_date: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  attendance_type: 'daily' | 'session';
  session_name: string | null;
  check_in_time: string;
  check_out_time: string | null;
  date: string;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  trade_type: 'export' | 'import';
  product_service: string;
  country: string;
  state: string | null;
  amount: number;
  currency: string;
  trade_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  name: string;
  description: string | null;
  session_type: 'offline_orientation' | 'online_orientation' | 'special_session' | 'ohm_meet';
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
}
