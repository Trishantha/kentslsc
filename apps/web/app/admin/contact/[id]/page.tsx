import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailIndexPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/contact/${id}/message`);
}
