import { api } from './api';

export type PayoutMatchStatus = 'matched' | 'unmatched' | 'partial';

export interface PayoutReconciliationRow {
  payoutId: string;
  arrivalDate: string;
  status: string;
  currency: string;
  gross: number;
  fees: number;
  net: number;
  expectedLedgerNet: number;
  matchedPaymentCount: number;
  unmatchedTxnCount: number;
  unmatchedAmount: number;
  variance: number;
}

export interface PayoutReconciliationResponse {
  rows: PayoutReconciliationRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  aggregates: {
    gross: number;
    fees: number;
    net: number;
    expectedLedgerNet: number;
    variance: number;
  };
}

export interface PayoutDetailTransaction {
  transactionId: string;
  type: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  availableOn: string;
  created: string;
  description: string | null;
  sourceId: string | null;
  sourcePaymentIntentId: string | null;
  matchedPayment: {
    receiptNumber: string | null;
    sourceType: string;
    payerName: string | null;
    grossAmount: number;
    processingFee: number;
    netAmount: number;
  } | null;
}

export interface PayoutDetailResponse {
  payout: {
    payoutId: string;
    arrivalDate: string;
    status: string;
    currency: string;
    amount: number;
    method: string;
    type: string;
    description: string | null;
  };
  transactions: PayoutDetailTransaction[];
}

export interface BalanceSummaryResponse {
  available: { currency: string; amount: number }[];
  pending: { currency: string; amount: number }[];
  daily: { date: string; charges: number; refunds: number; fees: number; payouts: number }[];
}

export interface PayoutSyncResult {
  payoutsUpserted: number;
  transactionsUpserted: number;
  errors: string[];
}

export async function fetchPayoutReconciliation(filters: {
  from?: string;
  to?: string;
  status?: string;
  matchStatus?: PayoutMatchStatus | '';
  page?: number;
  limit?: number;
}): Promise<PayoutReconciliationResponse> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.status) params.set('status', filters.status);
  if (filters.matchStatus) params.set('matchStatus', filters.matchStatus);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 50));
  const { data } = await api.get(`/payments/reports/payouts?${params.toString()}`);
  return data;
}

export async function fetchPayoutDetail(payoutId: string): Promise<PayoutDetailResponse> {
  const { data } = await api.get(`/payments/reports/payouts/${payoutId}`);
  return data;
}

export async function fetchBalanceSummary(): Promise<BalanceSummaryResponse> {
  const { data } = await api.get('/payments/reports/balance');
  return data;
}

export async function syncPayouts(from?: string): Promise<PayoutSyncResult> {
  const { data } = await api.post('/payments/reports/sync-payouts', { from: from || undefined });
  return data;
}
