'use client';

import type { PaymentMethodOption } from '@kentslsc/shared';

interface AvailablePaymentMethods {
  card: boolean;
  directDebit: boolean;
}

interface PaymentMethodSelectorProps {
  value: PaymentMethodOption;
  onChange: (method: PaymentMethodOption) => void;
  availableMethods: AvailablePaymentMethods;
  disabled?: boolean;
}

const OPTIONS: { value: PaymentMethodOption; label: string; helper: string }[] = [
  { value: 'card', label: 'Card', helper: 'Visa, Mastercard etc.' },
  { value: 'direct_debit', label: 'Direct Debit', helper: 'Pay from your UK bank account by Direct Debit' },
  { value: 'instant_bank_pay', label: 'Instant Bank Pay', helper: 'Pay instantly from your UK bank account' }
];

/** The method selected by default: card when available, otherwise Direct Debit. */
export function defaultPaymentMethod(availableMethods: AvailablePaymentMethods): PaymentMethodOption {
  return availableMethods.card ? 'card' : 'direct_debit';
}

/**
 * Payer-facing choice of payment method. Renders nothing when fewer than two
 * methods are configured — with a single platform there is no real choice and
 * the checkout behaves as if the method were omitted.
 */
export function PaymentMethodSelector({
  value,
  onChange,
  availableMethods,
  disabled = false
}: PaymentMethodSelectorProps) {
  const availableCount = (availableMethods.card ? 1 : 0) + (availableMethods.directDebit ? 1 : 0);
  if (availableCount < 2) return null;

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        Payment method
      </legend>
      <div className="space-y-2">
        {OPTIONS.map((option) => {
          const available =
            option.value === 'card' ? availableMethods.card : availableMethods.directDebit;
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                checked
                  ? 'border-neon-blue bg-neon-blue/10'
                  : 'border-slate-200 hover:border-neon-blue/40 dark:border-slate-700'
              } ${!available || disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="payment-method"
                value={option.value}
                checked={checked}
                disabled={!available || disabled}
                onChange={() => onChange(option.value)}
                className="mt-0.5 h-4 w-4 accent-neon-blue"
              />
              <span>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {option.label}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {option.helper}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
