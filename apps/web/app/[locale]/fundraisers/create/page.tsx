import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './CreateFundraiserPageContent';

const NAMESPACES = ['fundraisers'];

export default function CreateFundraiserPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
