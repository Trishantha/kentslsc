import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { FundraiserOverviewForm } from './FundraiserOverviewForm';
import type { AdminFundraiser } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getFundraiser(id: string): Promise<AdminFundraiser | null> {
  return fetchWithOriginFallback(`/api/fundraisers/${id}`);
}

export default async function FundraiserOverviewPage({ params }: Props) {
  const { id } = await params;
  const fundraiser = await getFundraiser(id);
  if (!fundraiser) notFound();

  return (
    <div className="max-w-3xl">
      <FundraiserOverviewForm fundraiser={fundraiser} fundraiserId={id} />
    </div>
  );
}
