import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './BlogPageContent';

const NAMESPACES = ['blog', 'common'];

export default function BlogPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
