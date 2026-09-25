import { z } from 'zod';

export const menuItemLinkTypeSchema = z.enum(['path', 'page']);

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const menuItemBaseSchema = z.object({
  parentId: z.preprocess(
    emptyToUndefined,
    z.string().uuid().nullable().optional()
  ),
  labelEn: z.string().min(1),
  labelSi: z.string().optional(),
  labelTa: z.string().optional(),
  linkType: menuItemLinkTypeSchema.default('path'),
  path: z.string().optional(),
  pageId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  sortOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true)
});

export const menuItemSchema = menuItemBaseSchema.superRefine((value, ctx) => {
    if (value.linkType === 'path') {
      if (!value.path || !value.path.startsWith('/')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['path'],
          message: 'Internal path must start with /'
        });
      }
      if (value.pageId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pageId'],
          message: 'pageId must not be set when linkType is path'
        });
      }
    } else if (!value.pageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pageId'],
        message: 'pageId is required when linkType is page'
      });
    }
  });

export const menuItemUpdateSchema = menuItemBaseSchema.partial();

export const menuItemOrderEntrySchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  sortOrder: z.number().int()
});

export const menuItemOrderSchema = z.array(menuItemOrderEntrySchema);

export type MenuItemLinkType = z.infer<typeof menuItemLinkTypeSchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type MenuItemUpdateInput = z.infer<typeof menuItemUpdateSchema>;
export type MenuItemOrderInput = z.infer<typeof menuItemOrderSchema>;

export interface MenuItemNode {
  id: string;
  parentId: string | null;
  labelEn: string;
  labelSi: string | null;
  labelTa: string | null;
  linkType: MenuItemLinkType;
  path: string | null;
  pageId: string | null;
  /** Resolved target: path, or /{page.slug} for page links. Null when unresolvable. */
  href: string | null;
  /** True when linkType is page but the page is missing or unpublished (admin tree only). */
  pageUnpublished?: boolean;
  sortOrder: number;
  isVisible: boolean;
  children: MenuItemNode[];
}
