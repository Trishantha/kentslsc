'use client';

import { use } from 'react';
import { FundraiserDonations } from './FundraiserDonations';

interface Props {
  params: Promise<{ id: string }>;
}

export default function FundraiserDonationsPage({ params }: Props) {
  const { id } = use(params);
  return <FundraiserDonations fundraiserId={id} />;
}
