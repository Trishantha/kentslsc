import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './EventsPageContent';

const NAMESPACES = ['events', 'eventDetail', 'common'];

export default function EventsPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
