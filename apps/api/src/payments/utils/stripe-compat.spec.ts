import {
  resolveInvoicePaymentIntentId,
  resolveInvoiceSubscriptionId,
  resolveSubscriptionPeriodEnd
} from './stripe-compat.js';

describe('stripe-compat', () => {
  describe('resolveInvoicePaymentIntentId', () => {
    it('reads the payment intent from the invoice payments list', () => {
      const invoice = {
        payments: { data: [{ payment: { payment_intent: 'pi_new' } }] }
      } as any;
      expect(resolveInvoicePaymentIntentId(invoice)).toBe('pi_new');
    });

    it('falls back to the legacy payment_intent field', () => {
      expect(resolveInvoicePaymentIntentId({ payment_intent: 'pi_legacy' } as any)).toBe('pi_legacy');
      expect(resolveInvoicePaymentIntentId({ payment_intent: { id: 'pi_obj' } } as any)).toBe('pi_obj');
    });

    it('returns null when no payment intent is present', () => {
      expect(resolveInvoicePaymentIntentId(null)).toBeNull();
      expect(resolveInvoicePaymentIntentId({ payments: { data: [] } } as any)).toBeNull();
    });
  });

  describe('resolveInvoiceSubscriptionId', () => {
    it('reads the subscription from invoice.parent', () => {
      const invoice = {
        parent: { subscription_details: { subscription: 'sub_new' } }
      } as any;
      expect(resolveInvoiceSubscriptionId(invoice)).toBe('sub_new');
    });

    it('falls back to the legacy subscription field', () => {
      expect(resolveInvoiceSubscriptionId({ subscription: 'sub_legacy' } as any)).toBe('sub_legacy');
    });

    it('returns null when the invoice is not tied to a subscription', () => {
      expect(resolveInvoiceSubscriptionId({} as any)).toBeNull();
    });
  });

  describe('resolveSubscriptionPeriodEnd', () => {
    it('reads the period end from the subscription item', () => {
      const subscription = { items: { data: [{ current_period_end: 1700000000 }] } } as any;
      expect(resolveSubscriptionPeriodEnd(subscription)).toEqual(new Date(1700000000 * 1000));
    });

    it('falls back to the legacy subscription field', () => {
      const subscription = { items: { data: [{}] }, current_period_end: 1700000000 } as any;
      expect(resolveSubscriptionPeriodEnd(subscription)).toEqual(new Date(1700000000 * 1000));
    });

    it('returns null when no usable timestamp is available', () => {
      expect(resolveSubscriptionPeriodEnd({ items: { data: [] } } as any)).toBeNull();
      expect(resolveSubscriptionPeriodEnd(null)).toBeNull();
    });
  });
});
