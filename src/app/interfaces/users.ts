export interface users {
    idTweetUser: string
    TweetUser: string
    nameUser: string
    tipeUser: string
}
export interface user {

id: string
username: string
name: string

}


export interface AdminUserSubscription {
  id: number;
  user_id: number;
  plan_id: number;
  plan_name: string;
  plan_cost: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  assigned_at?: string | null;
  status: 'vigente' | 'vencida' | 'programada';
}

export interface AdminUserSubscriptionsResponse {
  ok: boolean;
  user_id: number;
  total: number;
  subscriptions: AdminUserSubscription[];
}



