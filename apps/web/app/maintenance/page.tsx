import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Maintenance in progress',
  description: 'Kent Sri Lankan Social Club is temporarily unavailable while maintenance is in progress.',
  robots: {
    index: false,
    follow: false
  }
};

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(0,184,148,0.22),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#e0f2fe_48%,#fff7ed_100%)] px-6 py-12 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,rgba(0,184,148,0.18),transparent_34%),linear-gradient(135deg,#020617_0%,#0f172a_52%,#1e293b_100%)] dark:text-slate-100">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200/80 bg-white/85 p-8 text-center shadow-2xl shadow-slate-300/30 backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/30 sm:p-10">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg shadow-slate-300/40 dark:bg-slate-900 dark:shadow-black/30">
          <Image src="/logo.png" alt="Kent Sri Lankan Social Club" width={72} height={72} priority />
        </div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
          Scheduled maintenance
        </p>
        <h1 className="font-futuristic text-4xl leading-tight text-slate-950 dark:text-white sm:text-5xl">
          We will be back shortly
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-700 dark:text-slate-300 sm:text-lg">
          Kent Sri Lankan Social Club is temporarily offline while we update the site. Please check back soon.
        </p>
      </section>
    </main>
  );
}