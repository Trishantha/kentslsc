import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './RegisterPageContent';

const NAMESPACES = ['auth', 'common', 'registration'];

export default function RegisterPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
