import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Directory',
  description: 'Discover Sri Lankan businesses and job opportunities in Kent.'
};

export default function DirectoryLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
