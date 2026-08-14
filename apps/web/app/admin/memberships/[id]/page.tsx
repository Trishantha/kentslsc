import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MembershipDetailIndexPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/memberships/${id}/details`);
}
