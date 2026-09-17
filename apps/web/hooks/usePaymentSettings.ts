import { useQuery } from '@tanstack/react-query';
import type { AvailablePaymentMethods, PaymentPlatform, ProcessingFeeConfig } from '@kentslsc/shared';
import { api } from '@/lib/api';

interface PublicPaymentSettings {
  provider: PaymentPlatform;
  /** Processing fee per payment method, keyed as the payer selects it. */
  fees: {
    card: ProcessingFeeConfig;
    directDebit: ProcessingFeeConfig;
  };
  /** Which payment methods are configured and may be offered to payers. */
  availableMethods: AvailablePaymentMethods;
}

export function usePaymentSettings() {
  return useQuery<PublicPaymentSettings>({
    queryKey: ['payments-public-settings'],
    queryFn: async () => (await api.get('/payments/public-settings')).data,
    staleTime: 5 * 60 * 1000
  });
}
