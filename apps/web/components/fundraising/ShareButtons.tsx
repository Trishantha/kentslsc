'use client';

import { useState } from 'react';
import { Copy, Check, Mail, MessageCircle, Share2 } from 'lucide-react';

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
    <path d="M13.5 22v-8.5h2.9l.4-3.3h-3.3V3.9c0-.95.3-1.6 1.6-1.6h1.7V.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.2v2.4H7.4v3.3h2.8V22h3.3Z" />
  </svg>
);

const X_ICON = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.265 5.638 5.899-5.638Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface Props {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(`Support "${title}" on Kent SLSC`);

  const shares = [
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodedTitle}%20${encoded}`,
      icon: <MessageCircle className="h-4 w-4" />,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      icon: <FacebookIcon />,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      label: 'X',
      href: `https://x.com/intent/post?text=${encodedTitle}&url=${encoded}`,
      icon: <X_ICON />,
      color: 'bg-black hover:bg-slate-800'
    },
    {
      label: 'Email',
      href: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A${encoded}`,
      icon: <Mail className="h-4 w-4" />,
      color: 'bg-slate-600 hover:bg-slate-700'
    }
  ];

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <Share2 className="h-4 w-4" />
        Share this campaign
      </p>
      <div className="flex flex-wrap gap-2">
        {shares.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white transition-colors ${s.color}`}
          >
            {s.icon}
            {s.label}
          </a>
        ))}
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
