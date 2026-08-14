'use client';

import { use } from 'react';
import { FundraiserUpdatesManager } from './FundraiserUpdatesManager';

interface Props {
  params: Promise<{ id: string }>;
}

export default function FundraiserUpdatesPage({ params }: Props) {
  const { id } = use(params);
  return <FundraiserUpdatesManager fundraiserId={id} />;
}
