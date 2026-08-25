'use client';

import { useParams } from 'next/navigation';
import { FundraiserUpdatesManager } from './FundraiserUpdatesManager';

export default function FundraiserUpdatesPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;
  return <FundraiserUpdatesManager fundraiserId={id} />;
}
