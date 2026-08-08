import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Kent Sri Lankan Social Club',
  description: 'How the Kent Sri Lankan Social Club collects, uses, and protects your personal data.'
};

export default function PrivacyPage() {
  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="section-title">Privacy Policy</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Last updated: 6 August 2026
        </p>

        <div className="mt-10 space-y-8">
          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">1. Introduction</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Kent Sri Lankan Social Club (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your
              privacy. This policy explains how we collect, use, store, and protect your personal data
              when you use our website and services.
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">2. Data Controller</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              The data controller is Kent Sri Lankan Social Club. If you have any questions about this
              policy or how we handle your data, please contact us at{' '}
              <a href="mailto:info@kentslsc.org" className="text-neon-blue hover:underline">
                info@kentslsc.org
              </a>.
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">3. What Data We Collect</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                <strong>Account data:</strong> name, email address, phone number, and address when you
                register or become a member.
              </li>
              <li>
                <strong>Membership data:</strong> membership type, status, dependants, and payment
                information handled by our payment processor.
              </li>
              <li>
                <strong>Event data:</strong> ticket purchases, attendance, and related communications.
              </li>
              <li>
                <strong>Contact data:</strong> messages you send through our contact form.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, browser type, and cookies for analytics and
                security.
              </li>
            </ul>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">4. How We Use Your Data</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              <li>To provide membership, events, ticketing, and fundraising services.</li>
              <li>To communicate with you about club news, events, and updates.</li>
              <li>To process payments and donations.</li>
              <li>To respond to your enquiries and improve our services.</li>
              <li>To comply with legal and regulatory obligations.</li>
            </ul>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">5. Legal Basis for Processing</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              We process your personal data on the basis of your consent, the necessity to perform a
              contract with you, compliance with legal obligations, or our legitimate interests in
              operating the club.
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">6. Sharing Your Data</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              We do not sell your personal data. We may share data with trusted service providers
              (such as payment processors, email services, and hosting providers) only to the extent
              necessary to deliver our services.
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">7. Data Retention</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              We keep your data only for as long as necessary to fulfil the purposes for which it was
              collected, or as required by law. Soft-deleted records are retained for audit purposes
              and removed in line with our retention schedule.
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">8. Your Rights</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Under the UK GDPR, you have the right to access, correct, erase, restrict, or object to
              the processing of your personal data, and the right to data portability. To exercise any
              of these rights, please contact us at{' '}
              <a href="mailto:info@kentslsc.org" className="text-neon-blue hover:underline">
                info@kentslsc.org
              </a>.
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">9. Cookies</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              We use cookies and similar technologies to operate the website, remember your
              preferences, and analyse traffic. You can manage cookies through your browser settings.
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">10. Changes to This Policy</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              We may update this privacy policy from time to time. Any changes will be posted on this
              page with an updated effective date.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
