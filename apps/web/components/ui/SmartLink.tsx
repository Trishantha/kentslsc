'use client';

import { forwardRef } from 'react';
import NextLink from 'next/link';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type SmartLinkProps = React.ComponentPropsWithoutRef<'a'> & {
  href: string;
  openInNewTab?: boolean;
};

function isExternalOrSpecial(href: string) {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  );
}

export const SmartLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  ({ href, openInNewTab, className, children, ...rest }, ref) => {
    if (isExternalOrSpecial(href)) {
      const isExternal = href.startsWith('http') || href.startsWith('//');
      return (
        <a
          ref={ref}
          href={href}
          className={cn(className)}
          {...(isExternal || openInNewTab
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
          {...rest}
        >
          {children}
        </a>
      );
    }

    return (
      <Link ref={ref} href={href} className={cn(className)} {...rest}>
        {children}
      </Link>
    );
  }
);

SmartLink.displayName = 'SmartLink';
