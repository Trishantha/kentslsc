/**
 * Auth cookie names. When `isProduction` is true we use the `__Host-` prefix,
 * which forces the browser to enforce `Secure`, `Path=/`, and no `Domain`
 * attribute. In development (where HTTPS is usually unavailable) we fall back to
 * plain names.
 */
export function accessTokenCookieName(isProduction: boolean): string {
  return isProduction ? '__Host-accessToken' : 'accessToken';
}

export function refreshTokenCookieName(isProduction: boolean): string {
  return isProduction ? '__Host-refreshToken' : 'refreshToken';
}

export function csrfTokenCookieName(isProduction: boolean): string {
  return isProduction ? '__Host-csrfToken' : 'csrfToken';
}
