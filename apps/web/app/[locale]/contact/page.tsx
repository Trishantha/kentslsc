import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './ContactPageContent';

const NAMESPACES = ['contact', 'auth'];

export default function ContactPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
