import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './FundraisersPageContent';

const NAMESPACES = ['fundraisers', 'common'];

export default function FundraisersPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
