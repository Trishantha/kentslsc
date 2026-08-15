-- CreateEnum
CREATE TYPE "policy_document_type" AS ENUM ('PRIVACY_POLICY', 'TERMS_CONDITIONS', 'MEMBERSHIP_POLICY', 'DISCLAIMER', 'GDPR_POLICY', 'COOKIE_POLICY');

-- CreateTable
CREATE TABLE "policy_documents" (
    "id" TEXT NOT NULL,
    "type" "policy_document_type" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gdpr_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cookie_consent_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cookie_consent_message" TEXT NOT NULL DEFAULT 'We use cookies to improve your experience on our website. By continuing to browse, you agree to our use of cookies.',
    "cookie_policy_url" TEXT,
    "privacy_policy_url" TEXT,
    "analytics_enabled" BOOLEAN NOT NULL DEFAULT false,
    "marketing_cookies_enabled" BOOLEAN NOT NULL DEFAULT false,
    "data_retention_days" INTEGER NOT NULL DEFAULT 365,
    "dpo_name" TEXT,
    "dpo_email" TEXT,
    "dpo_phone" TEXT,
    "gdpr_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gdpr_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_documents_type_key" ON "policy_documents"("type");

-- CreateIndex
CREATE INDEX "policy_documents_type_idx" ON "policy_documents"("type");

-- Seed default policy documents
INSERT INTO "policy_documents" ("id", "type", "title", "content", "is_published", "updated_at") VALUES
(gen_random_uuid()::text, 'PRIVACY_POLICY', 'Privacy Policy', '# Privacy Policy

**Last updated: ' || TO_CHAR(NOW(), 'DD Month YYYY') || '**

## 1. Introduction

Kent Sri Lankan Social Club ("we", "our", or "us") is committed to protecting your personal data and respecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website and services.

## 2. Data Controller

Kent Sri Lankan Social Club is the data controller responsible for your personal data. You can contact us at info@kentslsc.org with any privacy-related queries.

## 3. What Data We Collect

We may collect and process the following personal data:

- **Account data**: Name, email address, password (hashed)
- **Membership data**: Membership type, payment history, renewal dates
- **Event data**: Ticket purchases, attendance records
- **Contact data**: Messages sent through our contact form
- **Technical data**: IP address, browser type, pages visited (via cookies)

## 4. How We Use Your Data

We use your personal data to:

- Manage your membership and provide club services
- Send important communications about events and club news
- Process payments for memberships and tickets
- Respond to enquiries and support requests
- Comply with legal and regulatory obligations

## 5. Legal Basis for Processing

We process your data on the following legal bases:

- **Contract**: To fulfil our membership obligations
- **Legitimate interests**: To operate and improve our services
- **Legal obligation**: To comply with applicable laws
- **Consent**: Where you have given explicit consent

## 6. Data Sharing

We do not sell your personal data. We may share data with:

- Payment processors (Stripe/PayPal) for transaction processing
- Email service providers for communications
- Legal authorities when required by law

## 7. Data Retention

We retain your personal data for as long as your membership is active, plus 12 months thereafter, unless a longer period is required by law.

## 8. Your Rights

Under GDPR, you have the right to:

- Access your personal data
- Rectify inaccurate data
- Erase your data ("right to be forgotten")
- Restrict processing
- Data portability
- Object to processing

To exercise your rights, contact us at info@kentslsc.org.

## 9. Cookies

We use essential cookies to operate our website and optional analytics cookies (with your consent). See our Cookie Policy for more details.

## 10. Changes to This Policy

We may update this policy from time to time. We will notify members of significant changes via email.', true, NOW()),
(gen_random_uuid()::text, 'TERMS_CONDITIONS', 'Terms & Conditions', '# Terms & Conditions

**Last updated: ' || TO_CHAR(NOW(), 'DD Month YYYY') || '**

## 1. Acceptance of Terms

By accessing and using the Kent Sri Lankan Social Club website and services, you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use our services.

## 2. Membership

### 2.1 Eligibility
Membership is open to individuals aged 18 or over who are interested in Sri Lankan culture and the community.

### 2.2 Application
Membership applications are subject to approval by the club committee. We reserve the right to refuse or revoke membership at our discretion.

### 2.3 Membership Fees
Membership fees are as published on our website and are subject to change. Fees are non-refundable except in exceptional circumstances at the committee''s discretion.

## 3. Use of Services

### 3.1 Account Security
You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately of any unauthorised use.

### 3.2 Acceptable Use
You agree not to use our services to:
- Post unlawful, harmful, or offensive content
- Impersonate other individuals
- Spam or send unsolicited communications
- Violate any applicable laws or regulations

## 4. Events and Tickets

Tickets purchased for events are non-transferable and non-refundable unless an event is cancelled. We reserve the right to refuse entry.

## 5. Intellectual Property

All content on this website, including text, images, and logos, is the property of Kent Sri Lankan Social Club or its licensors and is protected by copyright.

## 6. Limitation of Liability

To the fullest extent permitted by law, we exclude all liability for any loss or damage arising from your use of our services. Our total liability shall not exceed the amount paid by you in membership fees in the preceding 12 months.

## 7. Governing Law

These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.

## 8. Changes to Terms

We may update these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms.

## 9. Contact

For queries about these terms, contact us at info@kentslsc.org.', true, NOW()),
(gen_random_uuid()::text, 'MEMBERSHIP_POLICY', 'Membership Policy', '# Membership Policy

**Last updated: ' || TO_CHAR(NOW(), 'DD Month YYYY') || '**

## 1. Overview

This Membership Policy sets out the rules and expectations for all members of Kent Sri Lankan Social Club. By joining the club, you agree to abide by this policy.

## 2. Membership Categories

We offer several membership categories to suit different needs:

- **Individual Membership**: For single adults aged 18+
- **Family Membership**: For a household including dependants
- **Student Membership**: Discounted rate for full-time students
- **Senior Membership**: Discounted rate for members aged 65+

## 3. Member Responsibilities

As a member, you agree to:

- Treat all members, staff, and guests with respect and dignity
- Uphold the values and reputation of the club
- Pay membership fees promptly
- Keep your contact details up to date
- Not discriminate against others on any protected characteristic
- Comply with all club rules and policies

## 4. Benefits of Membership

Members enjoy:

- Access to all club events at preferential rates
- Use of the member dashboard and digital membership card
- Participation in club forums and community discussions
- Business directory listing (where applicable)
- Voting rights at Annual General Meetings
- Access to member-exclusive content and communications

## 5. Renewals and Cancellations

### 5.1 Renewals
Memberships are valid for 12 months from the date of joining. Members will be notified 30 days before renewal.

### 5.2 Cancellations
Members may cancel at any time by contacting info@kentslsc.org. Refunds are not provided for partial periods unless exceptional circumstances apply.

## 6. Suspension and Termination

The committee reserves the right to suspend or terminate membership if a member:

- Breaches this policy or the club''s code of conduct
- Engages in conduct likely to bring the club into disrepute
- Fails to pay membership fees

Members subject to suspension or termination will be given an opportunity to respond before a final decision is made.

## 7. Data and Privacy

Member data is processed in accordance with our Privacy Policy. We will not share your data with third parties for marketing purposes.

## 8. Contact

For membership queries, contact membership@kentslsc.org or info@kentslsc.org.', true, NOW()),
(gen_random_uuid()::text, 'DISCLAIMER', 'Disclaimer', '# Disclaimer

**Last updated: ' || TO_CHAR(NOW(), 'DD Month YYYY') || '**

## 1. General Disclaimer

The information provided on the Kent Sri Lankan Social Club website is for general informational purposes only. While we strive to keep the information accurate and up to date, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability of the information.

## 2. No Professional Advice

Nothing on this website constitutes legal, financial, medical, or other professional advice. Always seek the advice of a qualified professional for specific advice relevant to your situation.

## 3. External Links

Our website may contain links to external websites. We have no control over the content or availability of those sites and accept no responsibility for them or for any loss or damage that may arise from your use of them.

## 4. Event Information

Event details, times, venues, and ticket prices are subject to change. We will endeavour to notify members of changes but accept no liability for inconvenience caused by changes to event details.

## 5. Limitation of Liability

To the fullest extent permitted by applicable law, Kent Sri Lankan Social Club shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of, or inability to use, our website or services.

## 6. Contact

If you have any questions about this disclaimer, please contact us at info@kentslsc.org.', true, NOW()),
(gen_random_uuid()::text, 'GDPR_POLICY', 'GDPR Compliance Statement', '# GDPR Compliance Statement

**Last updated: ' || TO_CHAR(NOW(), 'DD Month YYYY') || '**

## 1. Our Commitment to GDPR

Kent Sri Lankan Social Club is committed to compliance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. We take the privacy of our members and website visitors seriously.

## 2. Data Controller Information

**Organisation**: Kent Sri Lankan Social Club
**Email**: info@kentslsc.org
**Address**: Kent, United Kingdom

## 3. Data Protection Principles

We adhere to the following principles when processing personal data:

- **Lawfulness, fairness and transparency**: We process data lawfully and transparently
- **Purpose limitation**: Data is collected for specified, explicit, and legitimate purposes
- **Data minimisation**: We only collect data that is necessary
- **Accuracy**: We take reasonable steps to ensure data is accurate
- **Storage limitation**: Data is kept no longer than necessary
- **Integrity and confidentiality**: We use appropriate security measures

## 4. Lawful Bases for Processing

We rely on the following lawful bases:

| Processing Activity | Lawful Basis |
|---|---|
| Membership management | Contract |
| Event bookings | Contract |
| Financial records | Legal obligation |
| Marketing communications | Consent |
| Website analytics | Legitimate interests |
| Forum and community features | Legitimate interests |

## 5. Data Subject Rights

Under UK GDPR, you have the following rights:

- **Right of access**: Request a copy of your personal data
- **Right to rectification**: Correct inaccurate personal data
- **Right to erasure**: Request deletion of your personal data
- **Right to restriction**: Restrict how we process your data
- **Right to data portability**: Receive your data in a portable format
- **Right to object**: Object to certain types of processing
- **Rights related to automated decision-making**

To exercise any of these rights, please submit a Data Subject Access Request to info@kentslsc.org. We will respond within 30 days.

## 6. Data Breaches

In the event of a personal data breach that poses a risk to individuals, we will:

1. Notify the Information Commissioner''s Office (ICO) within 72 hours
2. Notify affected individuals without undue delay where required

## 7. International Transfers

We do not transfer personal data outside the UK/EEA except where appropriate safeguards are in place (e.g., Standard Contractual Clauses with our payment processor).

## 8. Children''s Data

Our services are not directed at children under 13. We do not knowingly collect personal data from children under 13 without parental consent.

## 9. Changes to This Statement

We review this statement annually and update it following any significant changes to our data processing activities.

## 10. Complaints

If you believe your data rights have been violated, you have the right to lodge a complaint with the ICO at www.ico.org.uk.', true, NOW()),
(gen_random_uuid()::text, 'COOKIE_POLICY', 'Cookie Policy', '# Cookie Policy

**Last updated: ' || TO_CHAR(NOW(), 'DD Month YYYY') || '**

## 1. What Are Cookies?

Cookies are small text files stored on your device when you visit a website. They help websites remember information about your visit, such as your preferences and login status.

## 2. How We Use Cookies

We use the following types of cookies:

### Essential Cookies
These cookies are necessary for the website to function properly. They cannot be disabled.

| Cookie | Purpose | Duration |
|---|---|---|
| `session` | Maintains your login session | Session |
| `csrf_token` | Protects against cross-site request forgery | Session |

### Analytics Cookies (Optional)
With your consent, we use analytics cookies to understand how visitors interact with our website.

| Cookie | Purpose | Duration |
|---|---|---|
| `_analytics` | Tracks page views and navigation | 12 months |

### Preference Cookies (Optional)
These cookies remember your preferences, such as language or display settings.

| Cookie | Purpose | Duration |
|---|---|---|
| `cookie_consent` | Remembers your cookie preferences | 12 months |
| `theme` | Remembers your display theme preference | 12 months |

## 3. Managing Cookies

You can control and manage cookies in several ways:

- **Browser settings**: Most browsers allow you to refuse or delete cookies
- **Cookie consent**: Use our cookie consent banner to manage optional cookies
- **Opt-out tools**: Use the opt-out mechanisms provided by analytics services

Please note that disabling certain cookies may affect the functionality of our website.

## 4. Third-Party Cookies

We may use third-party services that set their own cookies, including:

- **Stripe**: For payment processing
- **YouTube**: For embedded videos (if any)

## 5. Contact

If you have questions about our use of cookies, please contact us at info@kentslsc.org.', true, NOW());
