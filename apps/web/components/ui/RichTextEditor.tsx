'use client';

import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Quote, Link2, Unlink } from 'lucide-react';

interface RichTextEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
}

function ToolbarButton({
  onClick,
  title,
  children
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-600 transition hover:bg-white/10 hover:text-slate-800 dark:text-slate-300"
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Write here...',
  minHeightClassName = 'min-h-[180px]'
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const emitChange = () => {
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const run = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const createLink = () => {
    const url = window.prompt('Enter URL (https://...)');
    if (!url) return;
    run('createLink', url);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <div className="flex flex-wrap gap-2 border-b border-white/10 p-2">
        <ToolbarButton title="Bold" onClick={() => run('bold')}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => run('italic')}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Underline" onClick={() => run('underline')}>
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Bullet list" onClick={() => run('insertUnorderedList')}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => run('insertOrderedList')}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Quote" onClick={() => run('formatBlock', '<blockquote>')}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Link" onClick={createLink}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Remove link" onClick={() => run('unlink')}>
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        data-placeholder={placeholder}
        className={`${minHeightClassName} prose prose-sm dark:prose-invert max-w-none px-4 py-3 text-sm outline-none [&:empty:before]:pointer-events-none [&:empty:before]:text-slate-400 [&:empty:before]:content-[attr(data-placeholder)] [&_blockquote]:border-l-4 [&_blockquote]:border-neon-blue/40 [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6`}
      />
    </div>
  );
}
