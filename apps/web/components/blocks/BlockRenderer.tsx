'use client';

import dynamic from 'next/dynamic';
import type { PageBlock, MixedBlogListItem } from '@kentslsc/shared';
import type {
  BlockBusinessItem,
  BlockEventItem,
  BlockFundraiserItem
} from '@/lib/server-blocks';

const HeroBlock = dynamic(() => import('./HeroBlock'));
const TextBlock = dynamic(() => import('./TextBlock'));
const ImageBlock = dynamic(() => import('./ImageBlock'));
const FeaturesBlock = dynamic(() => import('./FeaturesBlock'));
const EventsBlock = dynamic(() => import('./EventsBlock'));
const DirectoryBlock = dynamic(() => import('./DirectoryBlock'));
const FundraisersBlock = dynamic(() => import('./FundraisersBlock'));
const BlogBlock = dynamic(() => import('./BlogBlock'));
const CtaBlock = dynamic(() => import('./CtaBlock'));
const ContactBlock = dynamic(() => import('./ContactBlock'));

interface Props {
  blocks: PageBlock[];
  /**
   * Server-prefetched data for data-driven blocks, keyed by block id.
   * Omitted in the admin page preview, where blocks fetch client-side.
   */
  blocksData?: Record<string, unknown>;
}

export default function BlockRenderer({ blocks, blocksData }: Props) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case 'hero':
            return <HeroBlock key={block.id} block={block} />;
          case 'text':
            return <TextBlock key={block.id} block={block} />;
          case 'image':
            return <ImageBlock key={block.id} block={block} />;
          case 'features':
            return <FeaturesBlock key={block.id} block={block} />;
          case 'events':
            return <EventsBlock key={block.id} block={block} data={blocksData?.[block.id] as BlockEventItem[] | undefined} />;
          case 'directory':
            return <DirectoryBlock key={block.id} block={block} data={blocksData?.[block.id] as BlockBusinessItem[] | undefined} />;
          case 'fundraisers':
            return <FundraisersBlock key={block.id} block={block} data={blocksData?.[block.id] as BlockFundraiserItem[] | undefined} />;
          case 'blog':
            return <BlogBlock key={block.id} block={block} data={blocksData?.[block.id] as MixedBlogListItem[] | undefined} />;
          case 'cta':
            return <CtaBlock key={block.id} block={block} />;
          case 'contact':
            return <ContactBlock key={block.id} block={block} />;
          default:
            return null;
        }
      })}
    </>
  );
}
