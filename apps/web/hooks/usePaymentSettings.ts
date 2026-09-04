import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ProcessingFeeConfig {
  enabled: boolean;
  percent: number;
  fixed: number;
}

export interface PublicPaymentSettings {
  provider: 'stripe' | 'paypal' | 'gocardless';
  /** Processing fee per payment method, keyed as the payer selects it. */
  fees: {
    card: ProcessingFeeConfig;
    directDebit: ProcessingFeeConfig;
  };
  /** Which payment methods are configured and may be offered to payers. */
  availableMethods: {
    card: boolean;
    directDebit: boolean;
  };
}

export function usePaymentSettings() {
  return useQuery<PublicPaymentSettings>({
    queryKey: ['payments-public-settings'],
    queryFn: async () => (await api.get('/payments/public-settings')).data,
    staleTime: 5 * 60 * 1000
  });
}
