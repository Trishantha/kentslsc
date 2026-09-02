'use client';

import { ProfileCard } from '@/components/dashboard/ProfileCard';

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="section-title">My Profile</h1>
      <p className="mt-4 text-slate-700 dark:text-slate-400">
        Update your personal details and contact information.
      </p>

      <div className="mt-8">
        <ProfileCard />
      </div>
    </div>
  );
}
