import { redirect } from 'next/navigation';

export default function TicketScanRedirectPage() {
  redirect('/admin/events');
}
