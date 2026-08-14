import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BlogDetailIndexPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/blog/${id}/content`);
}
