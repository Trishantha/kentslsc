import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './DirectoryPageContent';

const NAMESPACES = ['directory', 'common'];

export default function DirectoryPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
