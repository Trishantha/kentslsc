import { z } from 'zod';

export enum PolicyDocumentType {
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  TERMS_CONDITIONS = 'TERMS_CONDITIONS',
  MEMBERSHIP_POLICY = 'MEMBERSHIP_POLICY',
  DISCLAIMER = 'DISCLAIMER',
  GDPR_POLICY = 'GDPR_POLICY',
  COOKIE_POLICY = 'COOKIE_POLICY'
}

export const policyDocumentTypeLabels: Record<PolicyDocumentType, string> = {
  [PolicyDocumentType.PRIVACY_POLICY]: 'Privacy Policy',
  [PolicyDocumentType.TERMS_CONDITIONS]: 'Terms & Conditions',
  [PolicyDocumentType.MEMBERSHIP_POLICY]: 'Membership Policy',
  [PolicyDocumentType.DISCLAIMER]: 'Disclaimer',
  [PolicyDocumentType.GDPR_POLICY]: 'GDPR Compliance Statement',
  [PolicyDocumentType.COOKIE_POLICY]: 'Cookie Policy'
};

export const policyDocumentTypeSlug: Record<PolicyDocumentType, string> = {
  [PolicyDocumentType.PRIVACY_POLICY]: 'privacy-policy',
  [PolicyDocumentType.TERMS_CONDITIONS]: 'terms-and-conditions',
  [PolicyDocumentType.MEMBERSHIP_POLICY]: 'membership-policy',
  [PolicyDocumentType.DISCLAIMER]: 'disclaimer',
  [PolicyDocumentType.GDPR_POLICY]: 'gdpr',
  [PolicyDocumentType.COOKIE_POLICY]: 'cookie-policy'
};

export const updatePolicyDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  isPublished: z.boolean().optional()
});

export type UpdatePolicyDocumentInput = z.infer<typeof updatePolicyDocumentSchema>;

export const gdprSettingsSchema = z.object({
  cookieConsentEnabled: z.boolean().optional(),
  cookieConsentMessage: z.string().max(500).optional(),
  cookiePolicyUrl: z.string().url().optional().or(z.literal('')),
  privacyPolicyUrl: z.string().url().optional().or(z.literal('')),
  analyticsEnabled: z.boolean().optional(),
  marketingCookiesEnabled: z.boolean().optional(),
  dataRetentionDays: z.number().int().min(30).max(3650).optional(),
  dpoName: z.string().max(200).optional().or(z.literal('')),
  dpoEmail: z.string().email().optional().or(z.literal('')),
  dpoPhone: z.string().max(50).optional().or(z.literal('')),
  gdprNotes: z.string().max(5000).optional().or(z.literal(''))
});

export type GdprSettingsInput = z.infer<typeof gdprSettingsSchema>;
