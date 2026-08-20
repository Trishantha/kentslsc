import sanitizeHtml from 'sanitize-html';
import { cn } from '@/lib/utils';
import { hasRichTextContent } from '@/lib/rich-text';

interface RichTextContentProps {
  html?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}

export const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'h2',
    'h3',
    'h4'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: '_blank'
      }
    })
  }
};

export function RichTextContent({ html, className, fallback = null }: RichTextContentProps) {
  if (!hasRichTextContent(html)) return <>{fallback}</>;

  const sanitized = sanitizeHtml(html ?? '', sanitizeOptions);

  return (
    <div
      className={cn(
        'prose prose-slate max-w-none dark:prose-invert [&_blockquote]:border-l-4 [&_blockquote]:border-neon-blue/40 [&_blockquote]:pl-4',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
