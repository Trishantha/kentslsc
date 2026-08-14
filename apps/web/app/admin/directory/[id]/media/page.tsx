'use client';

import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, ImageIcon, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { cn } from '@/lib/utils';
import type { AdminBusiness } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

export default function DirectoryMediaPage({ params }: Props) {
  const { id: businessId } = use(params);
  const queryClient = useQueryClient();

  const { data: business, isLoading } = useQuery<AdminBusiness>({
    queryKey: ['admin', 'business', businessId],
    queryFn: async () => {
      const res = await api.get(`/directory/businesses/${businessId}`);
      return res.data;
    }
  });

  const [logoUrl, setLogoUrl] = useState(business?.logoUrl ?? '');

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/admin/directory/businesses/${businessId}`, {
        logoUrl: logoUrl || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'business', businessId] });
    }
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold">Media</h2>
        <p className="text-sm text-slate-500">Manage the business logo and media assets.</p>
      </div>

      <div className="glass-card p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Business logo"
                    className="h-full w-full object-cover"
                  />
                ) : business?.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt="Business logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-500" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Business logo</h3>
                <p className="text-sm text-slate-500">
                  Upload a square logo. This is shown on the directory listing card.
                </p>
              </div>
            </div>

            <ImageUpload
              label="Logo"
              value={logoUrl ?? business?.logoUrl ?? ''}
              onChange={(url) => setLogoUrl(url)}
              hideUrlInput
              showPreview
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className={cn(
                  'btn-primary inline-flex items-center gap-2',
                  updateMutation.isPending && 'opacity-70'
                )}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save logo
              </button>
              {(logoUrl || business?.logoUrl) && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Remove logo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
