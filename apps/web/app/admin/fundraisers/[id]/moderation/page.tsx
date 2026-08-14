import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { FundraiserModeration } from './FundraiserModeration';
import type { AdminFundraiser } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getFundraiser(id: string): Promise<AdminFundraiser | null> {
  return fetchWithOriginFallback(`/api/fundraisers/${id}`);
}

export default async function FundraiserModerationPage({ params }: Props) {
  const { id } = await params;
  const fundraiser = await getFundraiser(id);
  if (!fundraiser) notFound();

  return <FundraiserModeration fundraiser={fundraiser} fundraiserId={id} />;
}
