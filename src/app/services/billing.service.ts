import { environment } from '../../environments/environment';

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  map,
} from 'rxjs';

export interface BillingPlan {
  id: number;
  name: string;
  cost: number | string;
  duration_days: number;
  description?: string | null;
  is_active?: number | boolean | string | null;
  currency?: string | null;
}

export type QrPaymentStatus =
  | 'PENDIENTE'
  | 'PAGADO'
  | 'EXPIRADO'
  | 'CANCELADO'
  | 'ERROR';

export interface QrPayment {
  payment_id: string;
  reference: string;
  status: QrPaymentStatus;
  amount: number;
  currency: 'BOB';
  expires_at: string | null;
  qr_base64: string;
  plan_id: number;
}

export interface UpcomingUserPlan {
  user_plan_id: number;
  plan_id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
}



export interface QrPaymentCheck {
  payment_id: string;
  reference: string;
  status: QrPaymentStatus;
  paid_at?: string | null;
  subscription_activated?: boolean;
  dismissed?: boolean;
  cancelled_by_provider?: boolean;
  message?: string;
}


interface CobraFacilQrResponse {
  success: boolean;
  data?: {
    paymentId: string;
    orderId: string;
    qrId?: string;
    qrImageBase64: string;
    status: string;
    expiresAt?: string | null;
    amount: number;
    currency: string;
  };
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class BillingService {

  private readonly flaskBaseUrl =
    environment.apiUrl;

  private readonly baseUrl =
    `${this.flaskBaseUrl}/api/billing`;

  constructor(private readonly http: HttpClient) {}

  // =====================================
  // OBTENER PLANES
  // =====================================

  getPlans(): Observable<{ plans: BillingPlan[] }> {

    return this.http.get<
        BillingPlan[] | { plans: BillingPlan[] }
      >(
        `${this.flaskBaseUrl}/get_plans`
      ).pipe(
        map(response => {

          const raw = Array.isArray(response)
            ? response
            : response.plans;

          if (!Array.isArray(raw)) {
            throw new Error(
              'Formato inválido de planes'
            );
          }

          return {
            plans: raw.map(plan => ({
              ...plan,
              id: Number(plan.id),
              cost: Number(plan.cost),
              duration_days: Number(plan.duration_days),
              currency: plan.currency
                ? String(plan.currency).toUpperCase()
                : null
            }))
          };
        })
    );
  }

  // =====================================
  // GENERAR QR COBRAFÁCIL
  // =====================================

  createQr(planId: number): Observable<QrPayment> {
  return this.http.post<QrPayment>(
      `${this.baseUrl}/payments/qr`,
      { plan_id: planId }
  );
}


  // =====================================
  // CONSULTAR PAGO
  // Pendiente de implementar en Flask
  // =====================================

  getPayment(paymentId: string): Observable<QrPaymentCheck> {
    return this.http.get<QrPaymentCheck>(
        `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}`
    );
  }

  // =====================================
  // CANCELAR QR
  // Pendiente de implementar en Flask
  // =====================================

  cancelPayment(paymentId: string): Observable<QrPaymentCheck> {
    return this.http.post<QrPaymentCheck>(
        `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/cancel`,
        {}
    );
  }

  // =====================================
  // OBTENER PRÓXIMA RENOVACIÓN
  // =====================================

  getUpcomingSubscription(): Observable<{
    upcoming: UpcomingUserPlan | null
  }> {
    return this.http.get<{
        upcoming: UpcomingUserPlan | null
      }>(
        `${this.baseUrl}/subscription/upcoming`
    );
  }

  
}
