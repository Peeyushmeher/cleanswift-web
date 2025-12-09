// Type definitions for Detailer Dashboard

export type BookingStatus = 
  | 'pending'
  | 'requires_payment'
  | 'paid'
  | 'offered'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus = 
  | 'unpaid'
  | 'requires_payment'
  | 'processing'
  | 'paid'
  | 'refunded'
  | 'failed';

export interface Booking {
  id: string;
  receipt_id: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end?: string | null;
  scheduled_start?: string;
  scheduled_end?: string;
  total_amount: number;
  service_price: number;
  addons_total: number;
  tax_amount: number;
  detailer_id?: string | null;
  organization_id?: string | null;
  team_id?: string | null;
  service?: {
    id: string;
    name: string;
    price: number;
    duration_minutes?: number;
  };
  car?: {
    id: string;
    make: string;
    model: string;
    year: string;
    license_plate: string;
  };
  user?: {
    id: string;
    full_name: string;
    phone: string;
    email: string;
  };
  detailer?: {
    id: string;
    full_name: string;
  };
  team?: {
    id: string;
    name: string;
  };
  address_line1?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  location_notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface Review {
  id: string;
  booking_id: string;
  user_id: string;
  detailer_id: string;
  rating: number;
  review_text?: string;
  tip_amount?: number;
  created_at: string;
  user?: {
    full_name: string;
  };
  booking?: {
    receipt_id: string;
    service?: {
      name: string;
    };
  };
}

export interface BookingNote {
  id: string;
  booking_id: string;
  note_text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BookingTimeline {
  id: string;
  booking_id: string;
  status_from?: string;
  status_to: string;
  changed_by: string;
  changed_at: string;
  notes?: string;
}

export interface JobPhoto {
  id: string;
  booking_id: string;
  photo_url: string;
  photo_type: 'before' | 'after';
  uploaded_by: string;
  uploaded_at: string;
}

export interface ServiceArea {
  id: string;
  detailer_id: string;
  area_name: string;
  city: string;
  province: string;
  postal_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Detailer {
  id: string;
  full_name: string;
  avatar_url?: string;
  rating: number;
  review_count: number;
  years_experience: number;
  is_active: boolean;
  pricing_model?: 'subscription' | 'percentage' | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_connect_account_id?: string | null;
}

export interface EarningsSummary {
  total_earnings: number;
  pending_payouts: number;
  today_earnings: number;
  week_earnings: number;
  month_earnings: number;
}

export interface DashboardStats {
  upcoming: number;
  inProgress: number;
  completed: number;
  totalEarnings: number;
}

export interface DetailerTransfer {
  id: string;
  booking_id: string;
  detailer_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  stripe_transfer_id: string | null;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'retry_pending';
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  booking?: {
    id: string;
    receipt_id: string;
    total_amount: number;
    completed_at: string;
    service?: { name: string };
  };
}

export interface TransferStats {
  totalTransferred: number;
  pendingTransfers: number;
  failedTransfers: number;
}

