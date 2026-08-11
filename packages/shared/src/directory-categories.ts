export interface DirectorySubcategory {
  name: string;
}

export interface DirectoryCategoryGroup {
  name: string;
  emoji: string;
  subcategories: DirectorySubcategory[];
}

export const directoryCategoryGroups: DirectoryCategoryGroup[] = [
  {
    name: 'Professional, Legal & Financial Services',
    emoji: '🏢',
    subcategories: [
      { name: 'Solicitors' },
      { name: 'Barristers' },
      { name: 'Notaries' },
      { name: 'Accountants' },
      { name: 'Bookkeepers' },
      { name: 'Financial Advisors' },
      { name: 'Mortgage Brokers' },
      { name: 'Management Consultants' },
      { name: 'HR & Recruitment Agencies' },
      { name: 'Virtual Assistants' },
      { name: 'Business Coaching' },
      { name: 'Chartered Surveyors' },
      { name: 'Estate Agents' },
      { name: 'Letting Agents' },
      { name: 'Conveyancers' }
    ]
  },
  {
    name: 'Trades, Construction & Property Maintenance',
    emoji: '🛠️',
    subcategories: [
      { name: 'Builders' },
      { name: 'Roofing' },
      { name: 'Groundworks' },
      { name: 'Plastering' },
      { name: 'Electricians' },
      { name: 'Gas Engineers' },
      { name: 'Heating Engineers' },
      { name: 'Air Conditioning' },
      { name: 'Carpenters' },
      { name: 'Kitchen Fitters' },
      { name: 'Bathroom Fitters' },
      { name: 'Double Glazing' },
      { name: 'Landscapers' },
      { name: 'Tree Surgeons' },
      { name: 'Fencing' },
      { name: 'Garden Maintenance' }
    ]
  },
  {
    name: 'Retail & Consumer Goods',
    emoji: '🛒',
    subcategories: [
      { name: 'Clothing' },
      { name: 'Electronics' },
      { name: 'Furniture' },
      { name: 'DIY & Hardware' },
      { name: 'Jewellers' },
      { name: 'Pet Shops' },
      { name: 'Vape Shops' },
      { name: 'Charity Shops' },
      { name: 'Butchers' },
      { name: 'Greengrocers' },
      { name: 'Off-Licences' },
      { name: 'Supermarkets' }
    ]
  },
  {
    name: 'Food, Drink & Hospitality',
    emoji: '🍽️',
    subcategories: [
      { name: 'Restaurants' },
      { name: 'Cafés' },
      { name: 'Takeaways' },
      { name: 'Bakeries' },
      { name: 'Hotels' },
      { name: 'B&Bs' },
      { name: 'Holiday Parks' },
      { name: 'Pubs & Bars' },
      { name: 'Caterers' },
      { name: 'Mobile Food Vans' }
    ]
  },
  {
    name: 'Health, Medical & Care Services',
    emoji: '🧑‍⚕️',
    subcategories: [
      { name: 'GP Practices' },
      { name: 'Dental Clinics' },
      { name: 'Opticians' },
      { name: 'Pharmacies' },
      { name: 'Physiotherapy' },
      { name: 'Osteopathy' },
      { name: 'Chiropractic' },
      { name: 'Counselling & Psychotherapy' },
      { name: 'Care Homes' },
      { name: 'Domiciliary Care' },
      { name: 'Learning Disability Support' },
      { name: 'Mental Health Services' }
    ]
  },
  {
    name: 'Beauty, Grooming & Personal Care',
    emoji: '🧑‍🦰',
    subcategories: [
      { name: 'Hair Salons' },
      { name: 'Barbers' },
      { name: 'Nail Salons' },
      { name: 'Beauty Clinics' },
      { name: 'Spas & Massage' },
      { name: 'Tattoo & Piercing Studios' }
    ]
  },
  {
    name: 'Automotive & Transport',
    emoji: '🚗',
    subcategories: [
      { name: 'Garages' },
      { name: 'MOT Centres' },
      { name: 'Tyre Shops' },
      { name: 'Car Wash & Valeting' },
      { name: 'Car Dealerships' },
      { name: 'Van Hire' },
      { name: 'Taxi & Private Hire' },
      { name: 'Chauffeur Services' },
      { name: 'Couriers' },
      { name: 'Haulage' },
      { name: 'Removals' }
    ]
  },
  {
    name: 'Pets & Animals',
    emoji: '🐾',
    subcategories: [
      { name: 'Vets' },
      { name: 'Pet Grooming' },
      { name: 'Pet Boarding / Kennels' },
      { name: 'Pet Training' },
      { name: 'Pet Shops' }
    ]
  },
  {
    name: 'Education, Training & Childcare',
    emoji: '🎓',
    subcategories: [
      { name: 'Schools' },
      { name: 'Nurseries' },
      { name: 'Tutors' },
      { name: 'Colleges & Universities' },
      { name: 'Adult Education' },
      { name: 'Driving Schools' }
    ]
  },
  {
    name: 'Home Services',
    emoji: '🏡',
    subcategories: [
      { name: 'Cleaning Services' },
      { name: 'Pest Control' },
      { name: 'Home Security' },
      { name: 'Locksmiths' },
      { name: 'Removals & Storage' },
      { name: 'Waste Removal' }
    ]
  },
  {
    name: 'Events, Media & Creative',
    emoji: '🎉',
    subcategories: [
      { name: 'Event Planners' },
      { name: 'Photographers' },
      { name: 'Videographers' },
      { name: 'DJs & Bands' },
      { name: 'Venues' },
      { name: 'Graphic Designers' },
      { name: 'Web Designers' }
    ]
  },
  {
    name: 'Manufacturing, Industrial & Engineering',
    emoji: '🏭',
    subcategories: [
      { name: 'Manufacturers' },
      { name: 'Fabricators' },
      { name: 'Engineering Firms' },
      { name: 'Packaging' },
      { name: 'Warehousing' }
    ]
  },
  {
    name: 'Public Sector, Government & Community',
    emoji: '🧾',
    subcategories: [
      { name: 'Local Councils' },
      { name: 'Libraries' },
      { name: 'Social Services' },
      { name: 'Charities & Non-profits' },
      { name: 'Community Centres' },
      { name: 'Religious Organisations' }
    ]
  },
  {
    name: 'Digital, IT & SaaS',
    emoji: '💻',
    subcategories: [
      { name: 'IT Support' },
      { name: 'Cybersecurity' },
      { name: 'Software Development' },
      { name: 'Cloud Services' },
      { name: 'SaaS Platforms' },
      { name: 'Data & Analytics' }
    ]
  }
];

export const directoryCategoryValues = directoryCategoryGroups.flatMap((group) =>
  group.subcategories.map((sub) => sub.name)
);

export function getDirectoryCategoryGroup(category?: string | null): DirectoryCategoryGroup | undefined {
  if (!category) return undefined;
  return directoryCategoryGroups.find((group) =>
    group.subcategories.some((sub) => sub.name === category)
  );
}

export function getDirectoryCategoryLabel(category?: string | null): string {
  if (!category) return '';
  const group = getDirectoryCategoryGroup(category);
  return group ? `${group.emoji} ${category}` : category;
}
