'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus, Loader2, Eye, Settings, X } from 'lucide-react';
import { api } from '@/lib/api';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import type { PageBlock, SitePageInput } from '@kentslsc/shared';
import { cn } from '@/lib/utils';

interface Props {
  initialData?: {
    id: string;
    slug: string;
    title: string;
    isHome: boolean;
    metaDescription: string | null;
    blocks: PageBlock[];
    isPublished: boolean;
  };
}

const BLOCK_TYPES: { type: PageBlock['type']; label: string }[] = [
  { type: 'hero', label: 'Hero' },
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'features', label: 'Features' },
  { type: 'events', label: 'Events' },
  { type: 'directory', label: 'Directory' },
  { type: 'fundraisers', label: 'Fundraisers' },
  { type: 'blog', label: 'Blog' },
  { type: 'cta', label: 'Call to Action' },
  { type: 'contact', label: 'Contact Form' }
];

function createBlock(type: PageBlock['type']): PageBlock {
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  switch (type) {
    case 'hero':
      return { type, id, title: 'Welcome', subtitle: '', buttonText: '', buttonUrl: '', imageUrl: '' };
    case 'text':
      return { type, id, title: '', content: '', align: 'left' };
    case 'image':
      return { type, id, imageUrl: '', alt: '', caption: '' };
    case 'features':
      return { type, id, title: 'What we offer', features: [] };
    case 'events':
      return { type, id, title: 'Upcoming Events', limit: 3 };
    case 'directory':
      return { type, id, title: 'Promoted Businesses', limit: 3 };
    case 'fundraisers':
      return { type, id, title: 'Fundraisers', limit: 3 };
    case 'blog':
      return { type, id, title: 'Latest Blog Posts', limit: 3 };
    case 'cta':
      return { type, id, title: 'Get involved', content: '', buttonText: '', buttonUrl: '' };
    case 'contact':
      return { type, id, title: 'Contact us', content: '' };
    default:
      return { type, id } as unknown as PageBlock;
  }
}

function SortableBlockItem({
  block,
  selected,
  onSelect,
  onRemove
}: {
  block: PageBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition-colors',
        selected
          ? 'border-neon-blue bg-neon-blue/10'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-slate-500 hover:text-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium capitalize">{block.type}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-slate-500 hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PageEditor({ initialData }: Props) {
  const router = useRouter();
  const isEdit = Boolean(initialData);

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [isHome, setIsHome] = useState(initialData?.isHome ?? false);
  const [metaDescription, setMetaDescription] = useState(initialData?.metaDescription ?? '');
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? false);
  const [blocks, setBlocks] = useState<PageBlock[]>(initialData?.blocks ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedBlock = blocks.find((b) => b.id === selectedId) || null;

  const mutation = useMutation({
    mutationFn: async (payload: SitePageInput) => {
      if (isEdit && initialData) {
        const { data } = await api.put(`/pages/admin/${initialData.id}`, payload);
        return data;
      }
      const { data } = await api.post('/pages/admin', payload);
      return data;
    },
    onSuccess: () => {
      router.push('/admin/pages');
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addBlock = (type: PageBlock['type']) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const updateBlock = (id: string, updates: Partial<PageBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...updates } as PageBlock) : b))
    );
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSave = () => {
    mutation.mutate({
      title,
      slug,
      isHome,
      metaDescription: metaDescription || undefined,
      blocks,
      isPublished
    });
  };

  const updateFeature = (blockId: string, index: number, key: 'title' | 'description' | 'icon', value: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || b.type !== 'features') return b;
        const features = [...b.features];
        features[index] = { ...features[index], [key]: value } as typeof features[number];
        return { ...b, features } as PageBlock;
      })
    );
  };

  const addFeature = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || b.type !== 'features') return b;
        return { ...b, features: [...b.features, { title: '', description: '', icon: 'Star' }] } as PageBlock;
      })
    );
  };

  const removeFeature = (blockId: string, index: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || b.type !== 'features') return b;
        const features = b.features.filter((_, i) => i !== index);
        return { ...b, features } as PageBlock;
      })
    );
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 lg:flex-row">
      {/* Left sidebar - blocks */}
      <aside className="w-full flex-shrink-0 space-y-4 lg:w-64">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold">Page settings</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={isHome}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Meta description</label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isHome}
                onChange={(e) => setIsHome(e.target.checked)}
                className="rounded border-white/10 bg-white/5"
              />
              Use as home page
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-white/10 bg-white/5"
              />
              Published
            </label>
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold">Add block</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {BLOCK_TYPES.map((b) => (
              <button
                key={b.type}
                type="button"
                onClick={() => addBlock(b.type)}
                className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs font-medium hover:bg-white/10"
              >
                <Plus className="h-3 w-3" /> {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card flex-1 p-4">
          <h3 className="text-sm font-semibold">Page blocks</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="mt-3 space-y-2">
                {blocks.map((block) => (
                  <SortableBlockItem
                    key={block.id}
                    block={block}
                    selected={block.id === selectedId}
                    onSelect={() => setSelectedId(block.id)}
                    onRemove={() => removeBlock(block.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {blocks.length === 0 && <p className="mt-4 text-center text-xs text-slate-500">No blocks yet.</p>}
        </div>
      </aside>

      {/* Center preview */}
      <main className="glass-card flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={cn('rounded-lg px-3 py-1.5 text-sm', !preview && 'bg-neon-blue/10 text-neon-blue')}
            >
              <Settings className="mr-1 inline h-4 w-4" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={cn('rounded-lg px-3 py-1.5 text-sm', preview && 'bg-neon-blue/10 text-neon-blue')}
            >
              <Eye className="mr-1 inline h-4 w-4" /> Preview
            </button>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={mutation.isPending || !title || !slug}
            className="btn-primary py-2 text-sm disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Update page' : 'Create page'}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {preview ? (
            <div className="rounded-xl border border-white/10 bg-slate-50 dark:bg-slate-950">
              {/* Import the public renderer via dynamic to avoid SSR issues in preview */}
              <BlockPreview blocks={blocks} />
            </div>
          ) : selectedBlock ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold capitalize">{selectedBlock.type} block</h3>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <BlockConfig
                block={selectedBlock}
                onChange={(updates) => updateBlock(selectedBlock.id, updates)}
                onFeatureChange={(idx, key, value) => updateFeature(selectedBlock.id, idx, key, value)}
                onAddFeature={() => addFeature(selectedBlock.id)}
                onRemoveFeature={(idx) => removeFeature(selectedBlock.id, idx)}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-slate-500">
              <p>Select a block to configure it, or add a new block.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function BlockPreview({ blocks }: { blocks: PageBlock[] }) {
  return <BlockRenderer blocks={blocks} />;
}

function BlockConfig({
  block,
  onChange,
  onFeatureChange,
  onAddFeature,
  onRemoveFeature
}: {
  block: PageBlock;
  onChange: (updates: Partial<PageBlock>) => void;
  onFeatureChange: (index: number, key: 'title' | 'description' | 'icon', value: string) => void;
  onAddFeature: () => void;
  onRemoveFeature: (index: number) => void;
}) {
  const inputClass =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
  const labelClass = 'mb-1 block text-xs text-slate-500';

  return (
    <div className="space-y-4">
      {'title' in block && (
        <div>
          <label className={labelClass}>Title</label>
          <input value={block.title} onChange={(e) => onChange({ title: e.target.value } as Partial<PageBlock>)} className={inputClass} />
        </div>
      )}
      {'subtitle' in block && (
        <div>
          <label className={labelClass}>Subtitle</label>
          <textarea
            value={block.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value } as Partial<PageBlock>)}
            rows={3}
            className={inputClass}
          />
        </div>
      )}
      {'content' in block && (
        <div>
          <label className={labelClass}>Content</label>
          <textarea
            value={block.content}
            onChange={(e) => onChange({ content: e.target.value } as Partial<PageBlock>)}
            rows={5}
            className={inputClass}
          />
        </div>
      )}
      {'align' in block && block.type === 'text' && (
        <div>
          <label className={labelClass}>Alignment</label>
          <select
            value={block.align}
            onChange={(e) => onChange({ align: e.target.value as any } as Partial<PageBlock>)}
            className={inputClass}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      )}
      {'imageUrl' in block && (
        <div>
          <label className={labelClass}>Image URL</label>
          <input
            value={block.imageUrl}
            onChange={(e) => onChange({ imageUrl: e.target.value } as Partial<PageBlock>)}
            className={inputClass}
          />
        </div>
      )}
      {'alt' in block && (
        <div>
          <label className={labelClass}>Alt text</label>
          <input value={block.alt} onChange={(e) => onChange({ alt: e.target.value } as Partial<PageBlock>)} className={inputClass} />
        </div>
      )}
      {'caption' in block && (
        <div>
          <label className={labelClass}>Caption</label>
          <input
            value={block.caption}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<PageBlock>)}
            className={inputClass}
          />
        </div>
      )}
      {'buttonText' in block && (
        <div>
          <label className={labelClass}>Button text</label>
          <input
            value={block.buttonText}
            onChange={(e) => onChange({ buttonText: e.target.value } as Partial<PageBlock>)}
            className={inputClass}
          />
        </div>
      )}
      {'buttonUrl' in block && (
        <div>
          <label className={labelClass}>Button URL</label>
          <input
            value={block.buttonUrl}
            onChange={(e) => onChange({ buttonUrl: e.target.value } as Partial<PageBlock>)}
            className={inputClass}
          />
        </div>
      )}
      {'limit' in block && (
        <div>
          <label className={labelClass}>Item limit</label>
          <input
            type="number"
            min={1}
            max={12}
            value={block.limit}
            onChange={(e) => onChange({ limit: Number(e.target.value) } as Partial<PageBlock>)}
            className={inputClass}
          />
        </div>
      )}
      {'features' in block && block.type === 'features' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Features</label>
            <button type="button" onClick={onAddFeature} className="text-xs text-neon-blue hover:underline">
              + Add feature
            </button>
          </div>
          {block.features.map((feature, idx) => (
            <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Feature {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFeature(idx)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <input
                value={feature.title}
                onChange={(e) => onFeatureChange(idx, 'title', e.target.value)}
                placeholder="Title"
                className={`${inputClass} mt-2`}
              />
              <input
                value={feature.description}
                onChange={(e) => onFeatureChange(idx, 'description', e.target.value)}
                placeholder="Description"
                className={`${inputClass} mt-2`}
              />
              <select
                value={feature.icon}
                onChange={(e) => onFeatureChange(idx, 'icon', e.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="Star">Star</option>
                <option value="Calendar">Calendar</option>
                <option value="Heart">Heart</option>
                <option value="Briefcase">Briefcase</option>
                <option value="Users">Users</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
