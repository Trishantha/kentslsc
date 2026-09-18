import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import Content from './LoginPageContent';

const NAMESPACES = ['auth'];

export default function LoginPage() {
  return (
    <ServerMessagesProvider namespaces={NAMESPACES}>
      <Content />
    </ServerMessagesProvider>
  );
}
