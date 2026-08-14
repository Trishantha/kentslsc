import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FundraiserDetailIndexPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/fundraisers/${id}/overview`);
}
