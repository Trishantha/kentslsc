import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CommitteeDetailIndexPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/committee/${id}/details`);
}
