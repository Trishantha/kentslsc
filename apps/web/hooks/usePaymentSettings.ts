import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PublicPaymentSettings {
  provider: 'stripe' | 'paypal' | 'gocardless';
  processingFeeEnabled: boolean;
  processingFeePercent: number;
  processingFeeFixed: number;
}

export function usePaymentSettings() {
  return useQuery<PublicPaymentSettings>({
    queryKey: ['payments-public-settings'],
    queryFn: async () => (await api.get('/payments/public-settings')).data,
    staleTime: 5 * 60 * 1000
  });
}
