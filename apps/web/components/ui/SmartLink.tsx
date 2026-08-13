import { Link } from '@/i18n/routing';
import type { ReactNode } from 'react';

interface SmartLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}

export function SmartLink({ href, className, children, prefetch }: SmartLinkProps) {
  return (
    <Link href={href} className={className} prefetch={prefetch}>
      {children}
    </Link>
  );
}
