'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-100 py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-lg font-bold gradient-text">Kent Sri Lankan Social Club</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Building community, celebrating culture, and creating connections across Kent.
            </p>
          </div>
          <div>
            <h4 className="font-semibold">Quick Links</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href="/events">Events</Link></li>
              <li><Link href="/directory">Directory</Link></li>
              <li><Link href="/membership">Membership</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Contact</h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              info@kentslsc.org<br />
              Kent, United Kingdom
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Kent Sri Lankan Social Club. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
