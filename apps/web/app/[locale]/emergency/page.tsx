import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import EmergencyPageContent from './EmergencyPageContent';

export default function EmergencyPage() {
  return (
    <ServerMessagesProvider namespaces={['emergency']}>
      <EmergencyPageContent />
    </ServerMessagesProvider>
  );
}
