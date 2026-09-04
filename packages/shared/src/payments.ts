export interface ProcessingFeeConfig {
  enabled?: boolean;
  /** Percentage fee (e.g. 1.5 for 1.5%). */
  percent: number;
  /** Fixed fee in pence (e.g. 20 for £0.20). */
  fixed: number;
}

export interface ProcessingFeeResult {
  /** Net/advertised amount in pence. */
  net: number;
  /** Processing fee added on top, in pence. */
  fee: number;
  /** Total gross amount to charge, in pence. */
  gross: number;
}

/**
 * Calculate a processing fee to add on top of a net amount.
 * The fee is rounded up to the nearest whole penny so the club
 * is never short-changed by fractional pence.
 */
export function calculateProcessingFee(
  netPence: number,
  config: ProcessingFeeConfig
): ProcessingFeeResult {
  if (!config.enabled) {
    return { net: netPence, fee: 0, gross: netPence };
  }

  const percent = config.percent ?? 0;
  const fixed = config.fixed ?? 0;
  const fee = Math.ceil(netPence * (percent / 100) + fixed);

  return {
    net: netPence,
    fee,
    gross: netPence + fee
  };
}

/** Default Stripe UK blended rate: 1.5% + 20p per transaction. */
export const DEFAULT_PROCESSING_FEE: Required<ProcessingFeeConfig> = {
  enabled: true,
  percent: 1.5,
  fixed: 20
};

/**
 * Payer-selectable payment methods shown at member-facing checkouts.
 * 'card' is processed by Stripe; the bank payment methods by GoCardless.
 */
export type PaymentMethodOption = 'card' | 'direct_debit' | 'instant_bank_pay';

export type PaymentMethodProvider = 'stripe' | 'gocardless';

/** Which platform processes the given payment method. */
export function methodToProvider(method: PaymentMethodOption): PaymentMethodProvider {
  return method === 'card' ? 'stripe' : 'gocardless';
}

/** Which payment methods are configured and may be offered to payers. */
export interface AvailablePaymentMethods {
  card: boolean;
  directDebit: boolean;
}
