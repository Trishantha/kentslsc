import type { Metadata } from 'next';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { PolicyDocumentType, policyDocumentTypeLabels } from '@kentslsc/shared';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { formatDate } from '@/lib/utils';

interface PolicyDoc {
  id: string;
  type: PolicyDocumentType;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
}

interface Props {
  params: Promise<{ locale: string }>;
  docType: PolicyDocumentType;
}

export async function generatePolicyMetadata({ params, docType }: Props): Promise<Metadata> {
  const doc = await fetchWithOriginFallback<PolicyDoc>(`/api/policy-documents/${docType}`);
  const title = doc?.title ?? policyDocumentTypeLabels[docType];
  return { title, description: `${title} — Kent Sri Lankan Social Club` };
}

export default async function PolicyDocumentPage({ params, docType }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const doc = await fetchWithOriginFallback<PolicyDoc>(`/api/policy-documents/${docType}`);

  if (!doc) {
    notFound();
  }

  const paragraphs = doc.content
    .split('\n')
    .map((line, i) => ({ key: i, line }));

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="section-title">{doc.title}</h1>
        <p className="mt-4 text-slate-500 dark:text-slate-400 text-sm">
          Last updated:{' '}
          {formatDate(doc.updatedAt, { month: 'long' })}
        </p>

        <div className="mt-10 glass-card p-6 md:p-10">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {paragraphs.map(({ key, line }) => {
              if (line.startsWith('# ')) {
                return (
                  <h1 key={key} className="mt-6 text-2xl font-bold first:mt-0">
                    {line.slice(2)}
                  </h1>
                );
              }
              if (line.startsWith('## ')) {
                return (
                  <h2 key={key} className="mt-5 text-xl font-bold">
                    {line.slice(3)}
                  </h2>
                );
              }
              if (line.startsWith('### ')) {
                return (
                  <h3 key={key} className="mt-4 text-lg font-semibold">
                    {line.slice(4)}
                  </h3>
                );
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <li key={key} className="ml-4 list-disc text-slate-600 dark:text-slate-400">
                    {line.slice(2)}
                  </li>
                );
              }
              if (line.startsWith('|')) {
                return (
                  <div key={key} className="overflow-x-auto">
                    <pre className="text-xs text-slate-600 dark:text-slate-400">{line}</pre>
                  </div>
                );
              }
              if (line.trim() === '') {
                return <div key={key} className="h-2" />;
              }
              return (
                <p key={key} className="text-slate-600 dark:text-slate-400">
                  {line
                    .replace(/\*\*(.+?)\*\*/g, (_, m) => m)
                    .replace(/\*(.+?)\*/g, (_, m) => m)}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
