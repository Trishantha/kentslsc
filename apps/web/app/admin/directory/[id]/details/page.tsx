import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { BusinessDetailsForm } from './BusinessDetailsForm';
import type { AdminBusiness } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getBusiness(id: string): Promise<AdminBusiness | null> {
  return fetchWithOriginFallback(`/api/directory/businesses/${id}`);
}

export default async function DirectoryDetailsPage({ params }: Props) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  return (
    <div className="max-w-3xl">
      <BusinessDetailsForm business={business} businessId={id} />
    </div>
  );
}
