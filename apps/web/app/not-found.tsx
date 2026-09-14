'use client';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        The page you are looking for does not exist.
      </p>
      <a href="/" className="btn-primary mt-8">
        Go home
      </a>
    </div>
  );
}
