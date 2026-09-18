import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './BlogGalleryPageContent';

const NAMESPACES = ['blog', 'common'];

export default function BlogGalleryPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
