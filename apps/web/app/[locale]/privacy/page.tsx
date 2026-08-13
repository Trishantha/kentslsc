import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

const collectKeys = [
  'accountData',
  'membershipData',
  'eventData',
  'contactData',
  'technicalData'
] as const;

const useKeys = ['membership', 'communications', 'payments', 'enquiries', 'legal'] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription')
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'privacy' });

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="section-title">{t('title')}</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          {t('lastUpdated', { date: '6 August 2026' })}
        </p>

        <div className="mt-10 space-y-8">
          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.intro.title')}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{t('sections.intro.text')}</p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.dataController.title')}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              {t('sections.dataController.text')}{' '}
              <a href="mailto:info@kentslsc.org" className="text-neon-blue hover:underline">
                info@kentslsc.org
              </a>
              .
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.whatWeCollect.title')}</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              {collectKeys.map((key) => (
                <li key={key}>
                  <strong>{t(`sections.whatWeCollect.${key}.label`)}:</strong>{' '}
                  {t(`sections.whatWeCollect.${key}.text`)}
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.howWeUse.title')}</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              {useKeys.map((key) => (
                <li key={key}>{t(`sections.howWeUse.${key}`)}</li>
              ))}
            </ul>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.legalBasis.title')}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{t('sections.legalBasis.text')}</p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.sharing.title')}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{t('sections.sharing.text')}</p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.retention.title')}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{t('sections.retention.text')}</p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.yourRights.title')}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              {t('sections.yourRights.text')}{' '}
              <a href="mailto:info@kentslsc.org" className="text-neon-blue hover:underline">
                info@kentslsc.org
              </a>
              .
            </p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.cookies.title')}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{t('sections.cookies.text')}</p>
          </section>

          <section className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold">{t('sections.changes.title')}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{t('sections.changes.text')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
