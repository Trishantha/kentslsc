/**
 * Extract a cookie value from a `Cookie` header (or `document.cookie`) string.
 * The cookie name is regex-escaped so names containing special characters
 * still match. Returns the decoded value, or undefined when absent.
 */
export function getCookieValue(cookieHeader: string, name: string): string | undefined {
  const escapedName = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1');
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + escapedName + '=([^;]*)'));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
