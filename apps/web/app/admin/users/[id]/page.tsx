import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UserDetailIndexPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/users/${id}/profile`);
}
