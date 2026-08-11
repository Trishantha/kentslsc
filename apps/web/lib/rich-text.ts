export function stripRichText(input?: string | null): string {
  if (!input) return '';

  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasRichTextContent(input?: string | null): boolean {
  return stripRichText(input).length > 0;
}

export function summarizeRichText(input: string | null | undefined, maxLength = 160): string {
  const text = stripRichText(input);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}
