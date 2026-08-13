import { fetchWithRetry } from '@/lib/server-fetch';
import AboutPageContent, { type CommitteeMember } from './AboutPageContent';
import { getServerApiUrl } from '@/lib/api-base';

const defaultCommitteeItems: CommitteeMember[] = [
  { id: 'president', roleKey: 'president', name: 'TBC', position: 'President', displayOrder: 0 },
  { id: 'vicePresident', roleKey: 'vicePresident', name: 'TBC', position: 'Vice President', displayOrder: 1 },
  { id: 'secretary', roleKey: 'secretary', name: 'TBC', position: 'Secretary', displayOrder: 2 },
  { id: 'treasurer', roleKey: 'treasurer', name: 'TBC', position: 'Treasurer', displayOrder: 3 },
  { id: 'eventsLead', roleKey: 'eventsLead', name: 'TBC', position: 'Events Lead', displayOrder: 4 },
  { id: 'youthCoordinator', roleKey: 'youthCoordinator', name: 'TBC', position: 'Youth Coordinator', displayOrder: 5 }
];

async function fetchCommittee(): Promise<CommitteeMember[]> {
  const res = await fetchWithRetry(`${getServerApiUrl()}/api/committee`, {
    next: { revalidate: 60 }
  });
  if (!res || !res.ok) return defaultCommitteeItems;
  const data = (await res.json()) as CommitteeMember[];
  if (!Array.isArray(data) || data.length === 0) return defaultCommitteeItems;
  return data;
}

export default async function AboutPage() {
  const committeeItems = await fetchCommittee();
  return <AboutPageContent committeeItems={committeeItems} />;
}
