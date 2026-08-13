import { SiteLogoLoader } from '@/components/ui/SiteLogoLoader';

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <SiteLogoLoader />
    </div>
  );
}
