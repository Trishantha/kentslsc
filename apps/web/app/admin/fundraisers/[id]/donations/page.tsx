'use client';

import { useParams } from 'next/navigation';
import { FundraiserDonations } from './FundraiserDonations';

export default function FundraiserDonationsPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;
  return <FundraiserDonations fundraiserId={id} />;
}
