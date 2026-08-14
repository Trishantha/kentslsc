import type { Metadata } from 'next';
import { PolicyDocumentType } from '@kentslsc/shared';
import PolicyDocumentPage, { generatePolicyMetadata } from '@/components/ui/PolicyDocumentPage';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return generatePolicyMetadata({ params, docType: PolicyDocumentType.PRIVACY_POLICY });
}

export default function Page({ params }: Props) {
  return <PolicyDocumentPage params={params} docType={PolicyDocumentType.PRIVACY_POLICY} />;
}
