'use server';

import { revalidatePath } from 'next/cache';

/**
 * Revalidate all public about page paths so committee member changes
 * (including photos) appear immediately on the website.
 */
export async function revalidateCommitteePages() {
  revalidatePath('/en/about', 'page');
  revalidatePath('/si/about', 'page');
  revalidatePath('/ta/about', 'page');
  revalidatePath('/about', 'page');
}
