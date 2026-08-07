import Link from 'next/link';
import { RegistrationWizard } from '@/components/auth/RegistrationWizard';

export default function RegisterPage() {
  return (
    <div className="min-h-[80vh] px-4 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold md:text-3xl">Become a member</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Complete a few steps to join the Kent SLSC community.
          </p>
        </div>

        <RegistrationWizard />

        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-neon-blue hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
