import { prisma } from '@kentslsc/database';

/**
 * Converts the plain-text briefs (with • bullets and numbered lists) into
 * the HTML subset expected by the RichTextContent component. Headings are
 * detected heuristically as short, single-line blocks without trailing
 * punctuation; everything else becomes paragraphs, bullet lists or ordered
 * lists. Markdown-style links are converted to <a> tags.
 */
function toRichTextHtml(text: string): string {
  const raw = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = raw.split(/\n\s*\n/).filter(Boolean);

  const parts: string[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (lines.every((l) => l.startsWith('•'))) {
      const items = lines.map((l) => `<li>${inlineHtml(l.replace(/^•\s*/, ''))}</li>`).join('');
      parts.push(`<ul>${items}</ul>`);
      continue;
    }

    if (lines.every((l) => /^\d+\.\s/.test(l))) {
      const items = lines.map((l) => `<li>${inlineHtml(l.replace(/^\d+\.\s*/, ''))}</li>`).join('');
      parts.push(`<ol>${items}</ol>`);
      continue;
    }

    const isHeading =
      lines.length === 1 &&
      lines[0].length < 80 &&
      !/[.!?]$/.test(lines[0]) &&
      !lines[0].startsWith('•') &&
      !/^\d+\.\s/.test(lines[0]) &&
      !lines[0].includes(':');

    if (isHeading) {
      parts.push(`<h2>${inlineHtml(lines[0])}</h2>`);
      continue;
    }

    const para = lines.map(inlineHtml).join('<br>');
    parts.push(`<p>${para}</p>`);
  }

  return parts.join('\n');
}

function inlineHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

interface BlogSeed {
  title: string;
  slug: string;
  metaDescription: string;
  tags: string[];
  content: string;
}

const posts: BlogSeed[] = [
  {
    title: 'Welcome to Kent Sri Lankan Social Club: Uniting Our Community Across Kent',
    slug: 'welcome-to-kent-sri-lankan-social-club',
    metaDescription:
      'Discover the Kent Sri Lankan Social Club — a vibrant community hub connecting Sri Lankans in Kent through culture, events, business, and fellowship. Join us today!',
    tags: [
      'Kent Sri Lankan Social Club',
      'Sri Lankan community Kent',
      'Sri Lankan social club UK',
      'Sri Lankan events Gravesend',
      'Sri Lankan culture Kent',
      'About KSLSC',
      'Join us',
      'Sri Lankan diaspora UK',
      'Gravesend Sri Lankans'
    ],
    content: `The Kent Sri Lankan Social Club (KSLSC) is more than just a social organisation — we are a living, breathing community built on the pillars of Unity, Heritage, and Community. Based in Gravesend, Kent, at 119 Dover Road, our club exists to bring together Sri Lankans from all walks of life who now call this beautiful corner of England home.

Who We Are

Founded with a clear vision to preserve Sri Lankan traditions while embracing British multiculturalism, the Kent Sri Lankan Social Club serves as a central hub for the Sri Lankan diaspora in Kent and surrounding areas. Whether you have recently arrived from Colombo, Galle, Jaffna, or Kandy, or your family has been in the UK for generations, there is a place for you here.

Our motto, "The Gene of Humanity," reflects our belief that cultural identity and human connection transcend borders. We exist not only to celebrate what makes us Sri Lankan, but also to strengthen the bonds that make us a compassionate, thriving community in Kent.

What We Offer

Cultural Events & Gatherings

From Sinhala and Tamil New Year celebrations to Vesak lantern festivals and Christmas dinners, our events calendar is packed with occasions that bring the flavours, sounds, and colours of Sri Lanka to Kent. These gatherings are where friendships are forged, business partnerships are born, and children grow up understanding the richness of their heritage.

Business Directory & Networking

Our community directory connects Sri Lankan-owned businesses with customers across Kent. Whether you are looking for a Sri Lankan restaurant in Gravesend, a solicitor who understands your background, or a tradesperson you can trust, our directory makes it easy to support one another.

Fundraising & Social Causes

Giving back is at the heart of everything we do. We organise regular fundraising initiatives to support both local Kent charities and causes back home in Sri Lanka. When our community thrives, we believe in lifting others with us.

Family-Friendly Activities

With a growing number of young Sri Lankan families in Kent, we place special emphasis on events that welcome children and teenagers. From cricket tournaments to cultural dance classes, we ensure the next generation stays connected to their roots.

Join Us

Membership is open to all Sri Lankans and friends of Sri Lanka living in Kent and beyond. By joining the Kent Sri Lankan Social Club, you gain access to exclusive events, networking opportunities, and a support network that genuinely cares.

Visit [kentslsc.org](https://kentslsc.org) to become a member today.

Together, we are not just preserving a culture — we are building a legacy.`
  },
  {
    title: 'Kent Sri Lankan Social Club Holds Historic Inaugural General Meeting',
    slug: 'kent-sri-lankan-social-club-inaugural-general-meeting',
    metaDescription:
      'Relive the historic Inaugural General Meeting of the Kent Sri Lankan Social Club. See photos, highlights, and what this milestone means for Sri Lankans in Kent.',
    tags: [
      'Kent Sri Lankan Social Club inaugural meeting',
      'Sri Lankan community event Kent',
      'KSLSC first meeting',
      'Sri Lankan social club Gravesend',
      'Sri Lankan gathering UK',
      'Inaugural Meeting',
      'KSLSC News',
      'Community Event',
      'Club Milestone'
    ],
    content: `On a warm evening in Kent, history was made. The Kent Sri Lankan Social Club (KSLSC) convened its Inaugural General Meeting — a landmark moment that officially brought together Sri Lankans from across Gravesend, Dartford, Maidstone, and beyond under one united banner.

A Night to Remember

The atmosphere was electric with anticipation. Community members arrived dressed in their finest — elegant saris, sharp suits, and vibrant traditional attire that filled the hall with the colours of Sri Lanka. The room buzzed with conversation in Sinhala, Tamil, and English, a beautiful reflection of the multicultural identity we all share.

The evening began with the traditional lighting of the oil lamp — a deeply symbolic ritual in Sri Lankan culture that signifies the dispelling of darkness and the welcoming of wisdom and unity. Watching a young member of our community, guided by an elder, carefully light the brass lamp was a poignant reminder that this club belongs to every generation.

Key Moments from the Meeting

Forming the Committee

One of the most significant outcomes of the evening was the formal establishment of the KSLSC committee. Elected members took to the podium to share their vision for the club, outlining plans for cultural events, community outreach, youth engagement, and charitable initiatives. The enthusiasm in the room was palpable — this was not just a meeting, but the birth of a movement.

Community Voices

The floor was opened to attendees, and what followed was a heartfelt exchange of stories. Long-time residents of Kent spoke about the challenges of maintaining cultural identity while raising British-born children. Newer arrivals shared their hopes of finding a support network in an unfamiliar country. Every voice reinforced the same message: we are stronger together.

The Next Generation

One of the most heartwarming sights of the evening was seeing so many children and young people in attendance. Posing together on stage, their bright smiles captured the spirit of what KSLSC aims to protect — a sense of belonging, pride in heritage, and the joy of community. These children represent the future of Sri Lankan culture in Kent.

What This Means for Kent's Sri Lankan Community

For years, Sri Lankans living in Kent have gathered informally — at temples, at each other's homes, at cricket matches. The Inaugural General Meeting transformed that informal network into something official, structured, and sustainable. We now have a platform to:

• Advocate for the Sri Lankan community within Kent's civic landscape
• Organise larger, better-funded cultural and social events
• Support new arrivals with practical advice and emotional solidarity
• Preserve language, religion, cuisine, and traditions for future generations
• Celebrate our dual identity as Sri Lankans and Britons

Looking Ahead

The success of our first general meeting has set the tone for everything that follows. The committee is already planning a calendar of events that will include cultural festivals, family fun days, business networking evenings, and fundraising galas. We invite every Sri Lankan in Kent — whether you have been here for decades or just arrived last week — to get involved.

This is only the beginning. The Kent Sri Lankan Social Club has officially opened its doors, and the welcome mat is out for you.`
  },
  {
    title: 'Keeping Sri Lankan Culture Alive in Kent: Traditions, Food & Festivals',
    slug: 'keeping-sri-lankan-culture-alive-kent',
    metaDescription:
      'Discover how the Kent Sri Lankan Social Club preserves Sri Lankan culture in Kent through traditional festivals, authentic cuisine, dance, and community events.',
    tags: [
      'Sri Lankan culture Kent',
      'Sri Lankan festivals UK',
      'Sri Lankan food Kent',
      'Sinhala Tamil New Year UK',
      'Sri Lankan traditions Britain',
      'Sri Lankan Culture',
      'Festivals',
      'New Year',
      'Vesak',
      'Food',
      'Heritage',
      'Tamil Culture',
      'Sinhala Culture'
    ],
    content: `Living thousands of miles from the teardrop island does not mean leaving its soul behind. For the Sri Lankan community in Kent, culture is not just remembered — it is lived, breathed, and passed on with intention and joy. At the Kent Sri Lankan Social Club, keeping our heritage alive is at the very heart of our mission.

Why Cultural Preservation Matters

For first-generation immigrants, Sri Lankan culture is woven into daily life — the aroma of curry leaves frying in coconut oil, the sound of temple bells on Poya day, the rhythm of baila music at family gatherings. But for British-born Sri Lankan children, these experiences can feel distant without deliberate effort.

Cultural preservation is about more than nostalgia. It is about:

• Identity — helping young people understand who they are and where they come from
• Mental wellbeing — studies show that strong cultural identity improves confidence and resilience in immigrant communities
• Community cohesion — shared traditions create bonds that last lifetimes
• Passing it forward — ensuring that the next generation inherits more than just recipes, but values, stories, and pride

How KSLSC Celebrates Sri Lankan Culture

Sinhala and Tamil New Year (Aluth Avurudda / Puthandu)

Perhaps the most important date on our calendar, the Sri Lankan New Year is celebrated with gusto at KSLSC. We host traditional games like kana mutti bideema (pot-breaking), onchili pedeema (swinging), and banis kema (treating children to sweetmeats). Families dress in new clothes, cook kiribath (milk rice), and gather for the nekath (auspicious times) — all right here in Kent.

Vesak Festival

The Buddhist festival of Vesak, commemorating the birth, enlightenment, and passing of Lord Buddha, is observed with lantern-making competitions for children, dansal (free food offerings), and serene evening processions. The glow of handmade paper lanterns reminds us that light can be found even far from home.

Tamil Harvest Festival (Pongal / Thai Pongal)

For our Tamil Hindu community members, Pongal is celebrated with traditional cooking of the sweet rice dish, kolam (rice flour art), and prayers of gratitude for the harvest. It is a beautiful expression of Tamil identity and faith.

Christmas & Other Celebrations

Sri Lankan Christians, Buddhists, Hindus, and Muslims have always celebrated each other's festivals with mutual respect. KSLSC continues this tradition of interfaith harmony by hosting inclusive events during Christmas, Ramadan, and Deepavali.

The Flavours of Home

No discussion of Sri Lankan culture is complete without mentioning food. Our events feature authentic dishes prepared by community members — from hoppers and string hoppers to lamprais, kottu roti, and an array of curries that would make any Colombo street vendor proud.

Food is our universal language. It is how we welcome newcomers, comfort the homesick, and teach children about their heritage. At KSLSC, the kitchen is always open.

Dance, Music & Arts

From Kandyan dance performances to baila nights that get everyone on their feet, our cultural events are never short of music and movement. We are also exploring workshops in Bharatanatyam, traditional drumming (geta bera), and Sri Lankan folk arts for children and adults alike.

Join the Cultural Journey

Whether you are a Sri Lankan who has lived in Kent for decades or someone who has just arrived, there is always room for you at our table — literally and figuratively. Help us keep the traditions of our island alive in this corner of England.

Explore upcoming cultural events at [kentslsc.org/events](https://kentslsc.org/events)`
  },
  {
    title: 'How to Join the Kent Sri Lankan Social Club: Membership Benefits & Community Perks',
    slug: 'how-to-join-kent-sri-lankan-social-club',
    metaDescription:
      'Thinking of joining the Kent Sri Lankan Social Club? Discover membership benefits, how to sign up, and why becoming a member connects you to Kent\'s Sri Lankan community.',
    tags: [
      'Join Kent Sri Lankan Social Club',
      'KSLSC membership',
      'Sri Lankan club membership Kent',
      'Sri Lankan community membership UK',
      'KSLSC member benefits',
      'Membership',
      'Join KSLSC',
      'Member Benefits',
      'Sign Up',
      'Community',
      'Sri Lankan Network Kent'
    ],
    content: `Are you a Sri Lankan living in Kent — or simply someone who loves Sri Lankan culture? The Kent Sri Lankan Social Club (KSLSC) welcomes you. Becoming a member is your gateway to a vibrant community, exclusive events, meaningful connections, and the warm familiarity of home, right here in Gravesend and beyond.

Who Can Join?

Membership is open to:

• Sri Lankans of all ethnicities — Sinhala, Tamil, Muslim, Malay, Burgher, and everyone in between
• British-born Sri Lankans looking to reconnect with their roots
• Families who want their children to grow up with Sri Lankan culture and values
• Friends of Sri Lanka who appreciate our culture, food, and community spirit
• Students and professionals newly arrived in Kent who need a support network
• Business owners looking to connect with the Sri Lankan market in Kent

There is no strict geographic boundary — while we are based in Gravesend, our members come from Dartford, Maidstone, Canterbury, and even London.

Membership Benefits

1. Access to Exclusive Events

Members receive priority invitations and discounted entry to all KSLSC events, including:

• Cultural festivals (Sinhala/Tamil New Year, Vesak, Christmas, Deepavali)
• Family fun days and children's activities
• Dinner dances and social evenings
• Sports events and cricket tournaments
• Fundraising galas and charity nights

2. Business Directory Listing

Sri Lankan business owners can list their services in our community directory — a trusted resource used by hundreds of families in Kent. Whether you run a restaurant, accounting firm, or plumbing service, our directory puts you in front of your community.

3. Networking Opportunities

Connect with fellow professionals, entrepreneurs, and community leaders. Our networking events are designed to foster business partnerships, mentorship, and career growth within the Sri Lankan community.

4. Family & Youth Programmes

We run dedicated programmes for children and teenagers, including:

• Sinhala and Tamil language classes
• Cultural dance and music workshops
• Youth cricket and sports
• Leadership and volunteering opportunities

5. Support for New Arrivals

If you are new to the UK, KSLSC can help with practical advice on housing, schooling, healthcare, and employment — all from people who have walked the same path.

6. Forum & Online Community

Members gain access to our live forum, where you can ask questions, share recommendations, post announcements, and stay connected between events.

7. Giving Back

As a member, you will have the opportunity to participate in our fundraising and charitable initiatives, both in the UK and Sri Lanka. There is no greater feeling than helping others alongside your community.

How to Sign Up

Joining KSLSC is simple:

1. Visit [kentslsc.org](https://kentslsc.org) and click "Become a Member"
2. Fill out the membership form with your details
3. Pay the annual membership fee (details available on the website)
4. Receive your welcome pack and member ID
5. Start enjoying all the benefits immediately

Membership fees are kept affordable to ensure no one is excluded from our community.

What Members Say

"Joining KSLSC was the best decision we made after moving to Kent. Our children now have Sri Lankan friends, and my wife and I have a social circle that feels like family." — Member, Gravesend

"As a business owner, the directory listing alone has paid for my membership ten times over. But the real value is the community." — Member, Dartford

Ready to Join?

Do not wait for the next big event to feel at home. Become a member of the Kent Sri Lankan Social Club today and step into a community that will welcome you like family.

[Become a Member Now →](https://kentslsc.org)`
  },
  {
    title: 'Sri Lankan Family Events in Kent: Building Community for the Next Generation',
    slug: 'sri-lankan-family-events-kent',
    metaDescription:
      'Find family-friendly Sri Lankan events in Kent. From kids\' activities to cultural workshops, the Kent Sri Lankan Social Club brings families together.',
    tags: [
      'Sri Lankan family events Kent',
      'Sri Lankan kids activities UK',
      'family-friendly Sri Lankan community Kent',
      'Sri Lankan children events Gravesend',
      'KSLSC family day',
      'Family Events',
      'Children',
      'Kids Activities',
      'Bicultural Parenting',
      'Sri Lankan Families Kent',
      'Next Generation'
    ],
    content: `Raising children between two cultures is one of the most rewarding — and sometimes challenging — experiences for Sri Lankan families in the UK. At the Kent Sri Lankan Social Club (KSLSC), we believe that a strong community makes this journey not just easier, but truly joyful. Our family events are designed to bring Sri Lankan parents, children, and grandparents together in spaces where heritage meets happiness.

Why Family Events Matter

For British-born Sri Lankan children, questions of identity are natural. "Where do I come from?" "Why do we do things differently?" "What does it mean to be Sri Lankan?"

Our family events provide the answers — not through lectures, but through lived experience. When a child dances to baila music, tastes their grandmother's watalappan, or learns to light an oil lamp, they are not just participating in an activity. They are absorbing their heritage through joy.

For parents, these events offer something equally valuable: a support network of families who understand the same joys and struggles of bicultural parenting.

Family Events at KSLSC

Children's Cultural Workshops

We run regular workshops where children can learn:

• Sinhala and Tamil language basics through songs, stories, and games
• Traditional Sri Lankan arts & crafts — vesak lantern making, kolam drawing, mask painting
• Dance — introductory classes in Kandyan, Bharatanatyam, and folk dance
• Cooking — simple, child-friendly Sri Lankan recipes they can make at home

These workshops are designed to be fun first, educational second. When children associate Sri Lankan culture with enjoyment, the learning happens naturally.

Family Fun Days

Our quarterly family fun days are highlights of the KSLSC calendar. Think bouncing castles, face painting, tug-of-war, sack races, and Sri Lankan street food stalls — all set to a soundtrack of Sinhala pop and baila classics. Parents relax with a cup of plain tea, children run around with new friends, and everyone goes home with full bellies and fuller hearts.

Sports & Outdoor Activities

Cricket is in our DNA. KSLSC organises family cricket days where dads can relive their schoolboy glory, mums can show off their hidden talents, and children can learn the game that unites our island. We also plan picnics, nature walks, and outdoor gatherings during the British summer.

Intergenerational Gatherings

Some of our most touching events are those that deliberately bring together three generations. Grandparents share stories of life in Sri Lanka, parents translate and contextualise, and children listen with wide-eyed wonder. These oral history sessions are precious — they are how our collective memory survives.

Supporting Bicultural Families

We understand that every family navigates bicultural identity differently. Some speak Sinhala or Tamil at home; others do not. Some cook Sri Lankan food daily; others save it for Sundays. There is no "right" way to be Sri Lankan in Kent.

KSLSC creates a space where every family — however they choose to express their heritage — is welcomed without judgment. Our only expectation is kindness and respect for one another.

Upcoming Family Events

Keep an eye on our events page for:

• Summer Family Picnic
• Back-to-School Cultural Day
• Halloween & Deepavali Combined Celebration
• Christmas Children's Party
• Sinhala & Tamil New Year Family Festival

View all family events at [kentslsc.org/events](https://kentslsc.org/events)

Bring Your Family Home to KSLSC

Whether you have a newborn or a teenager, whether you are a single parent or a multigenerational household, the Kent Sri Lankan Social Club is here for your family. Help us raise a generation of confident, culturally rooted, and community-minded young Sri Lankans in Kent.`
  },
  {
    title: 'The Significance of the Traditional Oil Lamp Ceremony in Sri Lankan Culture',
    slug: 'traditional-oil-lamp-ceremony-sri-lankan-culture',
    metaDescription:
      'Learn about the deep meaning behind Sri Lanka\'s traditional oil lamp ceremony. Discover how the Kent Sri Lankan Social Club honours this beautiful ritual at community events.',
    tags: [
      'Sri Lankan oil lamp ceremony',
      'traditional oil lamp Sri Lanka',
      'diya vilakku meaning',
      'Sri Lankan cultural rituals UK',
      'KSLSC oil lamp ceremony',
      'Oil Lamp Ceremony',
      'Diya Vilakku',
      'Sri Lankan Traditions',
      'Cultural Rituals',
      'Heritage',
      'Inaugural Meeting'
    ],
    content: `There are few images more powerful in Sri Lankan culture than the lighting of the traditional oil lamp — the diya vilakku. At the Kent Sri Lankan Social Club's Inaugural General Meeting, this ancient ritual took centre stage, as a young girl, guided by her father, carefully lit the brass lamp that would illuminate the evening. It was a moment that captured everything our club stands for: heritage, guidance, and the passing of light from one generation to the next.

What Is the Oil Lamp Ceremony?

The Sri Lankan oil lamp, typically made of brass and featuring a central stem with multiple wick holders radiating outward like a lotus flower, is far more than decorative. In Sri Lankan tradition, lighting the lamp is an invocation of:

• Wisdom — the light of knowledge dispelling the darkness of ignorance
• Purity — the flame represents the purity of intention
• Prosperity — a lit lamp welcomes abundance and good fortune
• Unity — multiple wicks burning from a single oil source symbolise community cohesion

The lamp is traditionally lit using coconut oil and cotton wicks, with the belief that the five or seven wicks represent different forms of blessing — from health and wealth to happiness and spiritual enlightenment.

When Is the Lamp Lit?

At New Beginnings

The lighting of the lamp marks the start of auspicious events — weddings, housewarmings, business openings, and, of course, the inauguration of new ventures like the KSLSC. It is a way of seeking divine blessing and setting a positive tone for what is to come.

During Religious Observances

Buddhist temples light lamps during Vesak and Poya days. Hindu households light lamps during Deepavali and at their home shrines daily. Christian churches in Sri Lanka also incorporate lamp-lighting into certain ceremonies. The practice transcends religious boundaries, making it a truly unifying cultural symbol.

At Cultural Performances

No traditional Sri Lankan cultural event is complete without the lighting of the oil lamp. It is the official opening act, performed with reverence before any speeches or performances begin.

The Deeper Meaning Behind the Ritual

The act of lighting the lamp carries layers of symbolism that resonate deeply with the Sri Lankan diaspora:

The Flame

The flame is never still — it flickers, dances, and yet remains anchored. For Sri Lankans living abroad, this mirrors our own experience: adapting to new environments while staying rooted in our values.

The Oil

Coconut oil, drawn from the tree of life in Sri Lanka, feeds the flame continuously. It represents the sustaining power of community, culture, and faith — the invisible forces that keep our identity alive thousands of miles from home.

Passing the Light

When an elder helps a child light the lamp, it is a physical manifestation of paramparawa — the Sinhala word for tradition passed from generation to generation. The child learns not just the mechanics of the ritual, but the reverence with which it must be performed.

The KSLSC Oil Lamp Moment

At our Inaugural General Meeting, the choice to have a father guide his daughter in lighting the lamp was deliberate. It sent a clear message: this club belongs to families, to the young, and to the future. The image of that small hand holding the matchstick, steadying it against the wick, will remain one of the defining photographs of our founding.

It was a reminder that while we may be in Kent, our hearts still beat to the rhythms of home.

Experience It Yourself

If you have never witnessed or participated in a traditional Sri Lankan oil lamp ceremony, we invite you to attend one of our events. There is something profoundly moving about standing in a room as the lamps are lit, the flames reflecting in the eyes of people who share your story — even if they come from different corners of our island.

Join us at our next event: [kentslsc.org/events](https://kentslsc.org/events)`
  },
  {
    title: 'Supporting Sri Lankan Businesses in Kent: Our Community Directory',
    slug: 'supporting-sri-lankan-businesses-kent-directory',
    metaDescription:
      'Discover Sri Lankan-owned businesses in Kent with the KSLSC Business Directory. Support your community — from restaurants to professional services.',
    tags: [
      'Sri Lankan businesses Kent',
      'Sri Lankan restaurants Gravesend',
      'Sri Lankan business directory UK',
      'support Sri Lankan businesses',
      'KSLSC directory',
      'Business Directory',
      'Sri Lankan Businesses',
      'Support Local',
      'Entrepreneurs',
      'Professional Services',
      'Restaurants Kent'
    ],
    content: `In a foreign country, there is a special kind of trust that comes from shared heritage. When you hire a Sri Lankan accountant, eat at a Sri Lankan restaurant, or book a Sri Lankan plumber in Kent, you are not just getting a service — you are supporting a dream that crossed oceans to get here. The Kent Sri Lankan Social Club (KSLSC) Business Directory exists to make these connections effortless.

Why a Sri Lankan Business Directory Matters

The Sri Lankan diaspora in the UK is estimated to number over 300,000 people. In Kent alone, hundreds of Sri Lankan families have put down roots and built businesses that serve not just our community, but the wider British public. Yet many of these businesses struggle with visibility — especially among community members who would be their most loyal customers.

A dedicated directory solves this by:

• Increasing visibility for Sri Lankan-owned businesses in Kent
• Building trust through community endorsement
• Encouraging economic circulation within our own network
• Creating networking opportunities between business owners
• Supporting new entrepreneurs with mentorship and connections

What Businesses Are Listed?

Our directory is growing every month and currently includes businesses across multiple sectors:

Food & Hospitality

• Sri Lankan restaurants and takeaways in Gravesend, Dartford, and Maidstone
• Caterers specialising in Sri Lankan cuisine for weddings and events
• Home-based bakers creating love cake, kokis, and aluwa
• Grocery stores stocking Sri Lankan spices, condiments, and snacks

Professional Services

• Accountants and tax advisors who understand cross-border finances
• Solicitors experienced in immigration, property, and family law
• Insurance brokers offering tailored policies
• Mortgage advisors familiar with the needs of first-time buyers in the community

Health & Wellness

• Ayurvedic practitioners and massage therapists
• Counsellors and mental health professionals who understand bicultural stress
• Dentists, GPs, and pharmacists

Trades & Home Services

• Builders, electricians, and plumbers
• Painters and decorators
• Gardeners and landscapers

Creative & Digital

• Photographers and videographers (perfect for weddings and events!)
• Graphic designers and web developers
• DJs and event entertainers

How to Get Listed

If you own a business and would like to be featured in the KSLSC Business Directory, the process is straightforward:

1. Become a member of the Kent Sri Lankan Social Club
2. Submit your business details through our online form
3. Provide a brief description, contact information, and logo or photos
4. Get approved by our committee (we verify businesses to maintain directory quality)
5. Go live and start receiving enquiries from the community

Listing in the directory is free for KSLSC members — it is one of the many perks of joining our community.

Success Stories

Since launching the directory, we have seen remarkable outcomes:

• A Gravesend-based caterer secured three wedding bookings through directory enquiries
• A Sri Lankan accounting firm doubled its client base within six months of listing
• A home baker who had been selling informally on WhatsApp now has a professional presence and regular orders

These are not just business wins — they are community wins. When one of us succeeds, we all rise.

Support Local, Support Sri Lankan

Every pound spent at a Sri Lankan-owned business in Kent is an investment in our community's economic resilience. It keeps money circulating locally, creates jobs for our young people, and builds the kind of generational wealth that ensures our community thrives for decades to come.

The next time you need a service — whether it is a wedding caterer, a tax advisor, or someone to fix a leaky tap — check the KSLSC Business Directory first. You might just find exactly what you need, right around the corner, from someone who understands your world.

Browse the directory at [kentslsc.org/directory](https://kentslsc.org)`
  },
  {
    title: 'Kent Sri Lankan Social Club Fundraising: Giving Back to Our Community',
    slug: 'kent-sri-lankan-social-club-fundraising',
    metaDescription:
      'Learn how the Kent Sri Lankan Social Club raises funds for charitable causes in the UK and Sri Lanka. Join our mission to make a real difference.',
    tags: [
      'KSLSC fundraising',
      'Sri Lankan charity Kent',
      'Sri Lankan community fundraising UK',
      'donate Sri Lankan causes',
      'Kent Sri Lankan Social Club charity',
      'Fundraising',
      'Charity',
      'Giving Back',
      'Sri Lanka Aid',
      'Community Support',
      'Donations'
    ],
    content: `At the Kent Sri Lankan Social Club (KSLSC), we believe that a community is measured not by what it takes, but by what it gives. Fundraising and charitable giving are woven into the fabric of our organisation — from supporting struggling families in Kent to sending aid to villages back home in Sri Lanka. When we gather, we do not just celebrate; we contribute.

Our Fundraising Philosophy

Sri Lankans have always had a strong culture of giving. The Buddhist concept of dana (generosity), the Hindu practice of seva (selfless service), the Islamic pillar of zakat (charitable giving), and the Christian tradition of tithing all converge in our island's DNA. KSLSC channels this inherent generosity into structured, transparent, and impactful fundraising initiatives.

We focus on two core areas:

1. Supporting Causes in Sri Lanka

Despite its beauty, Sri Lanka faces ongoing challenges — economic hardship, natural disasters, and gaps in education and healthcare. KSLSC raises funds for:

• Educational scholarships for underprivileged children in rural Sri Lanka
• Medical aid and equipment for under-resourced hospitals
• Disaster relief following floods, landslides, and other emergencies
• Elderly care — supporting senior citizens with no family support
• Temple and church restoration projects in our ancestral villages

2. Helping Locally in Kent

Charity begins at home. We also direct funds toward:

• Local food banks in Gravesend, Dartford, and Maidstone
• Mental health initiatives serving immigrant communities
• Youth programmes for disadvantaged children in Kent
• Community centres that provide space for cultural and social activities

How We Raise Funds

Fundraising Galas & Dinners

Our black-tie dinner dances are highlights of the social calendar. With live music, auctions, raffles, and guest speakers, these evenings combine glamour with generosity. Every ticket sold, every raffle ticket purchased, and every auction bid contributes directly to our causes.

Community Events with a Purpose

Even our fun events have a giving angle. Family fun days include donation stalls. Cricket tournaments collect pledges per run scored. Cultural festivals feature charity buckets alongside food stalls. Giving becomes effortless when it is embedded in joy.

Direct Donations & Sponsorships

For those who prefer to give directly, we accept one-off and recurring donations through our website. We also welcome corporate sponsorships from Sri Lankan and British businesses who share our values.

Fundraising Challenges

Our members regularly undertake sponsored challenges — marathons, cycle rides, and even bicultural cooking marathons — to raise awareness and funds. These events generate significant community engagement and media coverage.

Transparency & Accountability

We know that donors want to see results. KSLSC is committed to full transparency:

• Every fundraising event publishes a financial summary
• Funds sent to Sri Lanka are tracked and verified with photographic evidence
• Annual reports detail exactly where donations went and what impact they had
• Our Metro Bank Community Account ensures all transactions are properly recorded

Featured Fundraiser: Current Campaign

Our current featured fundraiser supports the KSLSC Community Support Fund. We are aiming to raise funds to support local food banks and educational scholarships in Sri Lanka. Every contribution, no matter how small, brings us closer.

You can donate directly through our website: [kentslsc.org/donate](https://kentslsc.org)

How You Can Help

• Attend our fundraising events — your ticket price goes directly to charity
• Volunteer — we always need help organising and running events
• Spread the word — share our campaigns on social media and WhatsApp groups
• Sponsor an event — businesses can gain visibility while supporting a good cause
• Donate — one-time or monthly giving makes a sustained impact

Together, We Give

The Sri Lankan community in Kent may be thousands of miles from the island, but our hearts have never left. Through KSLSC fundraising, we prove that distance is no barrier to compassion. When we give together, we do not just change lives — we reaffirm who we are.

Join our next fundraising event: [kentslsc.org/events](https://kentslsc.org/events)`
  },
  {
    title: 'Sri Lankan New Year, Vesak & Poya Celebrations in Kent: How We Celebrate Together',
    slug: 'sri-lankan-new-year-vesak-poya-celebrations-kent',
    metaDescription:
      'Celebrate Sri Lankan festivals in Kent with KSLSC. From Sinhala Tamil New Year to Vesak and Poya — discover how our community keeps traditions alive in the UK.',
    tags: [
      'Sri Lankan New Year UK',
      'Vesak celebration Kent',
      'Poya day UK',
      'Sinhala Tamil New Year Kent',
      'Sri Lankan festivals Britain',
      'KSLSC celebrations',
      'Festivals',
      'New Year',
      'Vesak',
      'Deepavali',
      'Poya',
      'Celebrations',
      'Sri Lankan Calendar',
      'Events'
    ],
    content: `There is something magical about celebrating a Sri Lankan festival in Kent. The scent of kiribath wafting through a British community hall. The glow of handmade Vesak lanterns against grey English skies. The sound of pirith chanting echoing where church bells usually ring. At the Kent Sri Lankan Social Club (KSLSC), we do not just remember our festivals — we recreate them.

Here is how our community celebrates the major Sri Lankan festivals right here in Kent.

Sinhala and Tamil New Year (Aluth Avurudda / Puthandu)

When

Mid-April, when the sun moves from Pisces to Aries — a time of astrological significance for both Sinhala and Tamil communities.

How KSLSC Celebrates

Our New Year celebration is our biggest annual event. The day begins with the nekath (auspicious times) — we observe the traditional timings for lighting the hearth, eating the first meal, and beginning work, just as our ancestors did.

What to expect:

• A traditional kiribath (milk rice) breakfast served to all attendees
• Kavum, kokis, aluwa, and aasmee — the sweetmeats that define the season
• Traditional games: kana mutti bideema (pot breaking), onchili pedeema (swinging), banis kema, and kaban deeema (tug of war)
• Music and dance performances
• A community lunch featuring an array of Sri Lankan curries
• Gifts and ganu denu (exchange of money) for children

The New Year event is where you will see three generations of Sri Lankan families in Kent gathered under one roof — grandparents in white national dress, parents in elegant saris and suits, and children running around in their New Year finery.

Vesak

When

The full moon day of May, commemorating the birth, enlightenment, and passing away (Parinirvana) of Lord Buddha.

How KSLSC Celebrates

Vesak is observed with quiet reverence and joyful creativity. Weeks before the festival, our children's workshops focus on making Vesak lanterns — elaborate paper structures in star, lotus, and diamond shapes that glow with candlelight.

What to expect:

• Lantern competitions for children and adults
• Dansal — free distribution of food and drinks to the wider community, embodying the Buddhist spirit of generosity
• Pirith chanting and meditation sessions
• Bodhi pooja — offerings to the sacred Bodhi tree
• Evening processions with lanterns and Buddhist flags

Vesak at KSLSC is open to all, regardless of faith. It is a celebration of light, compassion, and the universal values that Buddha taught.

Poya Days

When

Every full moon day — twelve times a year.

How KSLSC Observes Poya

While not every Poya is marked with a large event, KSLSC observes the major Poya days — especially Poson, Esala, and Unduvap — with religious and cultural programmes:

• Sil programmes (observance of Buddhist precepts) for those who wish to participate
• Dhamma talks and discussions
• Pirith chanting ceremonies
• Community vegetarian meals
• Temple visits organised for families

For our Hindu members, corresponding festivals like Thai Pongal, Deepavali, and Maha Sivarathri are celebrated with equal fervour through poojas, bhajans, and community feasts.

Deepavali

When

October/November, the Hindu festival of lights.

How KSLSC Celebrates

Deepavali is a dazzling affair. The hall is lit with hundreds of diyas (clay lamps). Women arrive in stunning silk saris, adorned with jasmine flowers. The air is filled with the fragrance of incense and the sound of Kollywood music.

What to expect:

• Kolam (rangoli) competitions
• Fireworks displays (where permitted)
• Sweet distribution — mithai, laddu, and murukku
• Traditional Bharatanatyam and folk dance performances
• A grand vegetarian feast

Christmas & Other Celebrations

Sri Lankan Christians celebrate Christmas with midnight masses, carol services, and sumptuous lunches. KSLSC hosts a community Christmas dinner that welcomes members of all faiths, continuing Sri Lanka's tradition of interfaith harmony.

We also observe:

• Ramadan & Eid — iftar gatherings and Eid celebrations for our Muslim members
• Labour Day and other national commemorations
• Sri Lankan Independence Day (4 February) with flag-raising ceremonies and patriotic songs

Festival Calendar 2026/2027

Festival | Date | KSLSC Event
Independence Day | 4 Feb 2027 | Flag ceremony & community lunch
Sinhala/Tamil New Year | 14 Apr 2027 | Full-day cultural festival
Vesak | 30 May 2027 | Lantern competition & dansal
Poson Poya | 26 Jun 2027 | Temple visit & sil programme
Deepavali | 24 Oct 2026 | Festival of lights celebration
Christmas | 25 Dec 2026 | Community Christmas dinner

Dates subject to confirmation. Visit [kentslsc.org/events](https://kentslsc.org/events) for the latest.

Celebrate With Us

You do not need to be a member to attend our festival celebrations — everyone is welcome. But members do enjoy priority booking, discounted tickets, and exclusive access to member-only events.

Bring your family. Wear your colours. Light a lamp. Eat until you cannot move. And remember — home is not a place. It is a feeling. And at KSLSC, you will feel right at home.`
  },
  {
    title: 'From Gravesend to Colombo: The Story of Sri Lankans in Kent',
    slug: 'from-gravesend-to-colombo-story-sri-lankans-kent',
    metaDescription:
      'Explore the history and heritage of Sri Lankans in Kent. From early immigrants to today\'s thriving community — the story of how we built a home away from home.',
    tags: [
      'Sri Lankans in Kent',
      'Sri Lankan community history UK',
      'Sri Lankan diaspora Britain',
      'Sri Lankan immigrants Gravesend',
      'Sri Lankan heritage UK',
      'History',
      'Heritage',
      'Sri Lankan Diaspora',
      'Immigration',
      'Community Story',
      'Gravesend',
      'Kent'
    ],
    content: `Between the white cliffs of Dover and the bustling streets of Gravesend lies a story that few outside our community know — the story of how Sri Lankans came to Kent, planted roots, and built a home that honours both the Lion Flag and the Union Jack. The Kent Sri Lankan Social Club (KSLSC) is the latest chapter in this remarkable journey.

The Early Waves: How Sri Lankans Came to Britain

The 1950s & 1960s: Post-Independence Migration

Following Sri Lanka's independence from Britain in 1948, a small but steady stream of Sri Lankans began arriving in the UK. Many were professionals — doctors, engineers, accountants, and academics — recruited by the NHS and British industries facing labour shortages. Some settled in London, but others were drawn to Kent's quieter towns, better schools, and the promise of a peaceful life.

The 1970s & 1980s: Political Turmoil

The 1971 JVP insurrection and the outbreak of the Sri Lankan Civil War in 1983 triggered significant emigration. Tamil, Sinhala, and Muslim families alike sought safety and stability in Britain. Kent, with its proximity to London yet affordable housing, became an attractive destination. Gravesend, Dartford, and Maidstone gradually developed Sri Lankan enclaves.

The 1990s & 2000s: Family Reunification & New Arrivals

As initial settlers established themselves, they sponsored family members through reunification programmes. The community grew organically — uncle brought nephew, sister brought brother, and soon entire villages from Jaffna, Galle, Kandy, and Colombo had representatives in Kent.

The 2010s Onwards: Economic Migration & Students

The end of the civil war in 2009 did not stop the flow. Economic opportunities, higher education, and the allure of a British passport continued to draw Sri Lankans. Today, Kent's Sri Lankan community includes refugees from the 1980s, professionals from the 2000s, and students who arrived just last year.

Where Sri Lankans Settled in Kent

Gravesend

With its excellent rail links to London and relatively affordable housing, Gravesend became the unofficial capital of Kent's Sri Lankan community. The town now boasts Sri Lankan restaurants, grocery stores, and temples that serve as community anchors.

Dartford

Just across the Thames from Essex, Dartford attracted Sri Lankan families working in London but seeking suburban lifestyles. The Bluewater shopping area employs many community members.

Maidstone & Canterbury

Further into Kent, these towns attracted professionals and families who valued good schools and rural charm. The Sri Lankan presence here is smaller but growing.

Medway Towns (Chatham, Gillingham, Rochester)

The Medway area has a significant Sri Lankan population, particularly among NHS workers and tradespeople.

Building Community: From Isolation to Organisation

For decades, Sri Lankans in Kent connected informally — through temple associations, cricket clubs, and word-of-mouth gatherings. But as the community grew, so did the need for something more structured.

Temples & Religious Centres

Buddhist temples, Hindu kovils, Christian churches, and Islamic mosques have always been the first point of community for Sri Lankans. They provided not just spiritual sustenance but practical support — language classes for children, marriage introductions, and funeral arrangements.

Cricket Clubs

Sri Lankan cricket clubs in Kent became legendary. Weekend matches were social events as much as sporting contests, with curry pots bubbling on the sidelines and baila music blaring from car stereos.

The Birth of KSLSC

While these informal networks were invaluable, they lacked the structure to advocate for the community, organise large-scale events, and support new arrivals systematically. The Kent Sri Lankan Social Club was founded to fill this gap — to create a secular, inclusive, and professionally run organisation that serves all Sri Lankans in Kent, regardless of religion, ethnicity, or how long they have been in the UK.

Sri Lankan Contributions to Kent

Sri Lankans have made indelible contributions to Kent's social and economic fabric:

• Healthcare — hundreds of Sri Lankan doctors, nurses, and carers work in Kent's NHS trusts
• Education — Sri Lankan teachers and academics enrich Kent's schools and universities
• Business — from restaurants to tech startups, Sri Lankan entrepreneurs employ local people and pay taxes
• Culture — Sri Lankan festivals have become part of Kent's multicultural calendar
• Community — Sri Lankan volunteers serve in local charities, food banks, and civic organisations

The Future: A Community Coming of Age

The Kent Sri Lankan community is at an exciting crossroads. The first generation is ageing. The second generation is establishing itself as doctors, lawyers, entrepreneurs, and politicians. The third generation is growing up with a confidence that their grandparents could only dream of — proudly Sri Lankan, unapologetically British.

KSLSC exists to bridge these generations. We are not just preserving the past; we are building the future. A future where Sri Lankan children in Kent grow up knowing their language, their food, their festivals, and their history — while also excelling in British schools, British workplaces, and British public life.

Your Story Matters

Every Sri Lankan in Kent has a story. The parent who worked double shifts to send money home. The student who arrived with one suitcase and a dream. The grandmother who cooks ambulthiyal exactly like her mother did in Matara. The child who can sing the Sri Lankan national anthem in three languages.

These stories are the DNA of our community. And KSLSC is where they are shared, celebrated, and preserved.

Share your story with us at [kentslsc.org/forum](https://kentslsc.org/forum)`
  }
];

async function main() {
  const author = await prisma.user.findUnique({
    where: { email: 'admin@kentslsc.org' }
  });

  if (!author) {
    throw new Error(
      'Seeded admin user admin@kentslsc.org not found. Run pnpm db:seed before importing blog posts.'
    );
  }

  const createdPosts = [];
  for (const seed of posts) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: seed.slug } });
    if (existing) {
      console.log(`Skipping existing post: ${seed.slug}`);
      continue;
    }

    const gallery = await prisma.eventGallery.create({
      data: {
        title: `${seed.title} Gallery`,
        slug: `${seed.slug}-gallery`,
        description: `Photo gallery for "${seed.title}"`,
        isPublished: true
      }
    });

    const post = await prisma.blogPost.create({
      data: {
        title: seed.title,
        slug: seed.slug,
        content: toRichTextHtml(seed.content),
        metaDescription: seed.metaDescription,
        tags: seed.tags,
        galleryId: gallery.id,
        authorUserId: author.id,
        isPublished: true,
        publishedAt: new Date('2026-08-25T12:00:00.000Z')
      }
    });

    createdPosts.push({ slug: post.slug, galleryId: gallery.id });
    console.log(`Created post: ${post.slug} with gallery: ${gallery.slug}`);
  }

  console.log(`\nImported ${createdPosts.length} blog posts.`);
  console.log('Next steps:');
  console.log('1. Run pnpm db:migrate in an environment with database access to apply the schema changes.');
  console.log('2. Upload the 6 IGM photos via /admin/blog → each post → Gallery tab.');
  console.log('3. Set featured images for each post in the Content tab.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
