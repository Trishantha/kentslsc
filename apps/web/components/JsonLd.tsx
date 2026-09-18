interface Props {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export default function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      // Browser extensions inject scripts/attributes into the first head tag;
      // without this React hydration errors on every page in dev.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
