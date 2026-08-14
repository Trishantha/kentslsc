import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DirectoryDetailIndexPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/directory/${id}/details`);
}
