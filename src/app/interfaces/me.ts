// interfaces/me.ts
export type SubscriptionStatus = 'activa' | 'vencida' | 'suspendida' | 'sin_plan';

export interface AccountMeResponse {
  user: {
    id?: number;
    firebase_uid: string;
    email: string | null;
    display_name: string | null;
    role: string;
    estadoUser: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  subscription: {
    status: SubscriptionStatus;
    plan: null | {
      id: number;
      name: string;
      cost: number | null;
      duration_days: number | null;
      description: string | null;
      is_active: boolean;
    };
    start_date: string | null;
    end_date: string | null;
    meta?: {
      user_plan_id?: number;
      assigned_at?: string | null;
    };
  };
}

