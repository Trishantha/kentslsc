/**
 * Read a runtime environment variable.
 *
 * Uses dynamic property access so the bundler cannot evaluate the lookup at
 * build/module-load time. This is essential in unified/shared-hosting
 * deployments where environment files are loaded after the build.
 */
export function readEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Public frontend origin.
 *
 * Evaluated at call time, not at import time, so CI/build-time defaults do not
 * leak into production deployments.
 */
export function getFrontendUrl(): string {
  return (
    (
      readEnv('FRONTEND_URL') ??
      readEnv('NEXT_PUBLIC_FRONTEND_URL') ??
      'http://localhost:3000'
    ).replace(/\/+$/, '')
  );
}
