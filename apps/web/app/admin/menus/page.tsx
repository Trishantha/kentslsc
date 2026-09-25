'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  menuItemSchema,
  menuItemUpdateSchema,
  type MenuItemInput,
  type MenuItemNode,
  type MenuItemUpdateInput
} from '@kentslsc/shared';
import { cn } from '@/lib/utils';

interface AdminPage {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
}

interface MenuItemFormProps {
  mode: 'create' | 'edit';
  item?: MenuItemNode;
  /** Preselected parent when adding a submenu child. */
  defaultParentId?: string | null;
  topLevelItems: MenuItemNode[];
  pages: AdminPage[];
  onClose: () => void;
}

function MenuItemForm({ mode, item, defaultParentId, topLevelItems, pages, onClose }: MenuItemFormProps) {
  const queryClient = useQueryClient();
  const schema = mode === 'create' ? menuItemSchema : menuItemUpdateSchema;
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<MenuItemInput>({
    resolver: zodResolver(schema as never),
    defaultValues: {
      parentId:
        mode === 'create' ? (defaultParentId ?? null) : (item?.parentId ?? null),
      labelEn: item?.labelEn ?? '',
      labelSi: item?.labelSi ?? '',
      labelTa: item?.labelTa ?? '',
      linkType: item?.linkType ?? 'path',
      path: item?.path ?? '',
      pageId: item?.pageId ?? '',
      sortOrder: item?.sortOrder ?? topLevelItems.length,
      isVisible: item?.isVisible ?? true
    } as MenuItemInput
  });

  const linkType = watch('linkType');
  // A top-level item that already has children must stay top-level so the
  // one-level submenu limit is preserved.
  const parentLocked = mode === 'edit' && !!item && item.children.length > 0;

  const mutation = useMutation({
    mutationFn: async (payload: MenuItemInput | MenuItemUpdateInput) => {
      if (mode === 'create') {
        const { data } = await api.post('/menus', payload);
        return data;
      }
      const { data } = await api.put(`/menus/${item!.id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] });
      onClose();
    },
    onError: (err: unknown) => setSaveError(getApiErrorMessage(err))
  });

  const onSubmit = handleSubmit((values) => {
    setSaveError(null);
    const payload: Record<string, unknown> = { ...values };
    for (const key of ['labelSi', 'labelTa', 'path', 'pageId'] as const) {
      if (payload[key] === '') payload[key] = undefined;
    }
    if (payload.parentId === '') payload.parentId = null;
    mutation.mutate(payload as MenuItemInput);
  });

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors focus:border-neon-blue/60';
  const labelClass = 'mb-2 block text-sm font-medium text-slate-300';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {mode === 'create' ? 'Add Menu Item' : 'Edit Menu Item'}
          </h2>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {!parentLocked && (
            <div>
              <label className={labelClass}>Parent item</label>
              <select className={inputClass} {...register('parentId')}>
                <option value="">Top level</option>
                {topLevelItems
                  .filter((parent) => parent.id !== item?.id)
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.labelEn}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Items under a parent appear as a submenu dropdown.
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Label (English)</label>
            <input type="text" className={inputClass} {...register('labelEn')} />
            {errors.labelEn && (
              <p className="mt-1 text-xs text-red-400">{errors.labelEn.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Label (Sinhala)</label>
              <input type="text" className={inputClass} {...register('labelSi')} />
            </div>
            <div>
              <label className={labelClass}>Label (Tamil)</label>
              <input type="text" className={inputClass} {...register('labelTa')} />
            </div>
          </div>
          <p className="-mt-3 text-xs text-slate-500">
            Sinhala and Tamil labels fall back to English when left empty.
          </p>

          <div>
            <label className={labelClass}>Link type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="radio" value="path" {...register('linkType')} className="accent-neon-blue" />
                Internal path
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="radio" value="page" {...register('linkType')} className="accent-neon-blue" />
                CMS page
              </label>
            </div>
          </div>

          {linkType === 'path' ? (
            <div>
              <label className={labelClass}>Path</label>
              <input
                type="text"
                placeholder="/events"
                className={inputClass}
                {...register('path')}
              />
              {(errors.path || errors.pageId) && (
                <p className="mt-1 text-xs text-red-400">
                  {(errors.path ?? errors.pageId)?.message}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className={labelClass}>CMS page</label>
              <select className={inputClass} {...register('pageId')}>
                <option value="">Select a page</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title} (/{page.slug})
                    {page.isPublished ? '' : ' — unpublished'}
                  </option>
                ))}
              </select>
              {(errors.pageId ?? errors.path) && (
                <p className="mt-1 text-xs text-red-400">
                  {(errors.pageId ?? errors.path)?.message}
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" {...register('isVisible')} className="accent-neon-blue" />
            Visible on the site
          </label>

          {saveError && <p className="text-sm text-red-400">{saveError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
            >
              {(isSubmitting || mutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Add Item' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SortableMenuRow({
  node,
  depth,
  expanded,
  onToggleExpand,
  onEdit,
  onToggleVisibility,
  onDelete,
  onAddChild
}: {
  node: MenuItemNode;
  depth: 0 | 1;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onAddChild?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined
  };
  const hasChildren = node.children.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        depth === 1 ? 'ml-10 border-white/5 bg-white/[0.03]' : 'border-white/10 bg-white/5',
        isDragging && 'opacity-70 shadow-neon'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-500 hover:text-slate-300 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-slate-400 hover:text-slate-200"
          aria-label={expanded ? 'Collapse submenu' : 'Expand submenu'}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', !expanded && '-rotate-90')} />
        </button>
      ) : (
        <span className="w-4" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'truncate text-sm font-medium',
              node.isVisible ? 'text-slate-200' : 'text-slate-500 line-through'
            )}
          >
            {node.labelEn}
          </span>
          {!node.isVisible && (
            <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Hidden
            </span>
          )}
          {node.pageUnpublished && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
              <TriangleAlert className="h-3 w-3" /> Page unpublished
            </span>
          )}
        </div>
        <p className="truncate text-xs text-slate-500">
          {node.linkType === 'page' ? 'CMS page' : 'Path'}: {node.href ?? '(no target)'}
        </p>
      </div>

      {depth === 0 && (
        <button
          type="button"
          onClick={onAddChild}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-neon-blue"
          aria-label="Add submenu item"
          title="Add submenu item"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleVisibility}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-neon-blue"
        aria-label={node.isVisible ? 'Hide item' : 'Show item'}
        title={node.isVisible ? 'Hide item' : 'Show item'}
      >
        {node.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-neon-blue"
        aria-label="Edit item"
        title="Edit item"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-red-400"
        aria-label="Delete item"
        title="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AdminMenusPage() {
  const queryClient = useQueryClient();
  const [tree, setTree] = useState<MenuItemNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formState, setFormState] = useState<
    | { mode: 'create'; parentId?: string | null }
    | { mode: 'edit'; item: MenuItemNode }
    | null
  >(null);

  const { data, isLoading } = useQuery<MenuItemNode[]>({
    queryKey: ['admin', 'menus'],
    queryFn: async () => {
      const res = await api.get('/menus');
      return res.data;
    }
  });

  const { data: pages } = useQuery<AdminPage[]>({
    queryKey: ['admin', 'pages'],
    queryFn: async () => {
      const res = await api.get('/pages/admin/all');
      return res.data;
    }
  });

  useEffect(() => {
    if (data) {
      setTree(data);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const node of data) {
          if (node.children.length > 0) next.add(node.id);
        }
        return next;
      });
    }
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const topLevelItems = useMemo(() => tree, [tree]);

  const reorderMutation = useMutation({
    mutationFn: async (nextTree: MenuItemNode[]) => {
      const entries = nextTree.flatMap((node, rootIndex) => [
        { id: node.id, parentId: null, sortOrder: rootIndex },
        ...node.children.map((child, childIndex) => ({
          id: child.id,
          parentId: node.id,
          sortOrder: childIndex
        }))
      ]);
      const { data: updated } = await api.put('/menus/order', { entries });
      return updated as MenuItemNode[];
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'menus'], updated);
      setTree(updated);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] });
    }
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async (node: MenuItemNode) => {
      const { data: updated } = await api.put(`/menus/${node.id}`, {
        isVisible: !node.isVisible
      });
      return updated;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (node: MenuItemNode) => {
      await api.delete(`/menus/${node.id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] })
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const nextTree = tree.map((node) => ({ ...node, children: [...node.children] }));
    const rootIndex = nextTree.findIndex((node) => node.id === active.id);
    if (rootIndex !== -1) {
      const overIndex = nextTree.findIndex((node) => node.id === over.id);
      if (overIndex === -1) return;
      setTree(arrayMove(nextTree, rootIndex, overIndex));
      reorderMutation.mutate(arrayMove(nextTree, rootIndex, overIndex));
      return;
    }
    for (const node of nextTree) {
      const childIndex = node.children.findIndex((child) => child.id === active.id);
      if (childIndex === -1) continue;
      const overIndex = node.children.findIndex((child) => child.id === over.id);
      if (overIndex === -1) return;
      node.children = arrayMove(node.children, childIndex, overIndex);
      setTree(nextTree);
      reorderMutation.mutate(nextTree);
      return;
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Menus</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Edit the public site navigation. Items under a parent render as a submenu on the
            navbar and mobile menu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormState({ mode: 'create' })}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus className="h-4 w-4" /> Add Menu Item
        </button>
      </div>

      <div className="glass-card mt-6 p-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={topLevelItems.map((node) => node.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {tree.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  No menu items yet. Add your first item to build the navigation.
                </p>
              )}
              {tree.map((node) => (
                <div key={node.id}>
                  <SortableMenuRow
                    node={node}
                    depth={0}
                    expanded={expanded.has(node.id)}
                    onToggleExpand={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(node.id)) {
                          next.delete(node.id);
                        } else {
                          next.add(node.id);
                        }
                        return next;
                      })
                    }
                    onEdit={() => setFormState({ mode: 'edit', item: node })}
                    onToggleVisibility={() => toggleVisibilityMutation.mutate(node)}
                    onDelete={() => {
                      const message = node.children.length
                        ? `Delete "${node.labelEn}" and its ${node.children.length} submenu item(s)?`
                        : `Delete "${node.labelEn}"?`;
                      if (window.confirm(message)) {
                        deleteMutation.mutate(node);
                      }
                    }}
                    onAddChild={() => setFormState({ mode: 'create', parentId: node.id })}
                  />
                  {node.children.length > 0 && expanded.has(node.id) && (
                    <div className="mt-2 space-y-2">
                      <SortableContext
                        items={node.children.map((child) => child.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {node.children.map((child) => (
                          <SortableMenuRow
                            key={child.id}
                            node={child}
                            depth={1}
                            expanded={false}
                            onToggleExpand={() => undefined}
                            onEdit={() => setFormState({ mode: 'edit', item: child })}
                            onToggleVisibility={() => toggleVisibilityMutation.mutate(child)}
                            onDelete={() => {
                              if (window.confirm(`Delete "${child.labelEn}"?`)) {
                                deleteMutation.mutate(child);
                              }
                            }}
                          />
                        ))}
                      </SortableContext>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {reorderMutation.isPending && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving order…
          </p>
        )}
        {reorderMutation.isError && (
          <p className="mt-3 text-xs text-red-400">
            {getApiErrorMessage(reorderMutation.error)} — reverted to the saved order.
          </p>
        )}
      </div>

      {formState && (
        <MenuItemForm
          mode={formState.mode}
          item={formState.mode === 'edit' ? formState.item : undefined}
          defaultParentId={formState.mode === 'create' ? formState.parentId : undefined}
          topLevelItems={topLevelItems}
          pages={pages ?? []}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
}
