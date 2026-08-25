'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorInnerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
}

function parseMinHeight(css: string): number {
  const bracketMatch = css.match(/min-h-\[(\d+)px\]/);
  if (bracketMatch?.[1]) return parseInt(bracketMatch[1], 10);
  const fallback = css.match(/(\d+)/);
  if (fallback?.[1]) return parseInt(fallback[1], 10);
  return 180;
}

const PLUGINS = [
  'advlist',
  'autolink',
  'lists',
  'link',
  'image',
  'charmap',
  'preview',
  'anchor',
  'searchreplace',
  'visualblocks',
  'code',
  'fullscreen',
  'insertdatetime',
  'media',
  'table',
  'help',
  'wordcount'
];

const TOOLBAR =
  'undo redo | formatselect | fontselect fontsizeselect | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link unlink | blockquote | hr | table | removeformat | code';

const MENUBAR = 'file edit view insert format tools table';

export function RichTextEditorInner({
  value = '',
  onChange,
  placeholder = 'Write here...',
  minHeightClassName = 'min-h-[180px]'
}: RichTextEditorInnerProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const height = useMemo(() => parseMinHeight(minHeightClassName), [minHeightClassName]);

  if (!resolvedTheme) {
    return (
      <div
        className="animate-pulse rounded-xl border border-white/10 bg-white/5"
        style={{ minHeight: height }}
        aria-label="Loading editor"
      />
    );
  }

  return (
    <Editor
      key={theme}
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      licenseKey="gpl"
      value={value}
      onEditorChange={onChange}
      init={{
        base_url: '/tinymce',
        skin: theme === 'dark' ? 'oxide-dark' : 'oxide',
        content_css: theme === 'dark' ? 'dark' : 'default',
        min_height: height,
        placeholder,
        menubar: MENUBAR,
        plugins: PLUGINS,
        toolbar: TOOLBAR,
        toolbar_sticky: true,
        branding: false,
        promotion: false,
        a11y_advanced_options: true,
        image_advtab: true,
        link_default_target: '_blank',
        link_default_protocol: 'https',
        relative_urls: false,
        remove_script_host: false,
        convert_urls: false,
        contextmenu:
          'cut copy paste | bold italic underline strikethrough | link | alignleft aligncenter alignright alignjustify | removeformat',
        content_style:
          'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; font-size: 16px; line-height: 1.6; }',
        statusbar: false,
        resize: true
      }}
    />
  );
}
