import sanitizeHtml from 'sanitize-html';
import { cn } from '@/lib/utils';
import { hasRichTextContent } from '@/lib/rich-text';

interface RichTextContentProps {
  html?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}

const COLOR_REGEX =
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$|^rgb(a?)\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$|^[a-zA-Z][a-zA-Z0-9\s]*$/;
const SIZE_REGEX = /^\d+(\.\d+)?(px|em|rem|pt|%)$/;
const LENGTH_REGEX = /^\d+(\.\d+)?(px|em|rem|%|pt|cm|mm|in)$/;
const PADDING_REGEX =
  /^\d+(\.\d+)?(px|em|rem|%|pt)(\s+\d+(\.\d+)?(px|em|rem|%|pt))*$/;
const FONT_FAMILY_REGEX = /^['"a-zA-Z0-9\s,-]+$/;
const BORDER_REGEX = /^[\d\w\s#(),.-]+$/;

export const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'div',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'strike',
    'span',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'img',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td'
  ],
  allowedAttributes: {
    '*': ['style', 'class'],
    a: ['href', 'target', 'rel', 'style'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    table: ['border', 'width', 'style', 'cellpadding', 'cellspacing'],
    tr: ['style', 'align', 'valign'],
    td: ['colspan', 'rowspan', 'style', 'width', 'align', 'valign'],
    th: ['colspan', 'rowspan', 'style', 'width', 'align', 'valign'],
    ol: ['type', 'start', 'style'],
    ul: ['type', 'style'],
    li: ['style'],
    p: ['style', 'align'],
    h1: ['style', 'align'],
    h2: ['style', 'align'],
    h3: ['style', 'align'],
    h4: ['style', 'align'],
    h5: ['style', 'align'],
    h6: ['style', 'align']
  },
  allowedStyles: {
    '*': {
      color: [COLOR_REGEX],
      'background-color': [COLOR_REGEX],
      'font-size': [SIZE_REGEX],
      'font-family': [FONT_FAMILY_REGEX],
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^normal|bold|bolder|lighter|\d+$/],
      'font-style': [/^normal|italic|oblique$/],
      'text-decoration': [/^none|underline|line-through|overline$/],
      'text-transform': [/^none|capitalize|uppercase|lowercase$/],
      'margin-left': [LENGTH_REGEX],
      'padding-left': [LENGTH_REGEX]
    },
    table: {
      border: [BORDER_REGEX],
      'border-collapse': [/^(collapse|separate)$/],
      width: [LENGTH_REGEX],
      height: [LENGTH_REGEX]
    },
    tr: {
      border: [BORDER_REGEX],
      height: [LENGTH_REGEX]
    },
    td: {
      border: [BORDER_REGEX],
      width: [LENGTH_REGEX],
      height: [LENGTH_REGEX],
      padding: [PADDING_REGEX],
      'vertical-align': [/^(top|middle|bottom|baseline|sub|super)$/],
      'text-align': [/^(left|right|center|justify)$/],
      'background-color': [COLOR_REGEX]
    },
    th: {
      border: [BORDER_REGEX],
      width: [LENGTH_REGEX],
      height: [LENGTH_REGEX],
      padding: [PADDING_REGEX],
      'vertical-align': [/^(top|middle|bottom|baseline|sub|super)$/],
      'text-align': [/^(left|right|center|justify)$/],
      'background-color': [COLOR_REGEX]
    }
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  selfClosing: ['img', 'br', 'hr'],
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
