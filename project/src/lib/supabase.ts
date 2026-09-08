import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type NeedType = 'rescue' | 'medical' | 'shelter' | 'food';
export type ReportStatus = 'pending' | 'triaged' | 'resolved' | 'assigned';
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';
export type CredibilityLevel = 'high' | 'medium' | 'low';

export interface Report {
  id: string;
  location: string;
  description: string;
  need_type: NeedType;
  photo_url: string | null;
  status: ReportStatus;
  urgency: UrgencyLevel | null;
  credibility: CredibilityLevel | null;
  reasoning: string | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  assigned_resource_id: string | null;
}

export interface Resource {
  id: string;
  name: string;
  type: NeedType;
  location: string;
  available: boolean;
  lat: number | null;
  lng: number | null;
}
