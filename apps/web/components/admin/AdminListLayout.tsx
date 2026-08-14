import { ReactNode } from 'react';

interface AdminListLayoutProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function AdminListLayout({ title, description, action, children }: AdminListLayoutProps) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-title">{title}</h1>
          {description && (
            <p className="mt-1 text-slate-600 dark:text-slate-400">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
