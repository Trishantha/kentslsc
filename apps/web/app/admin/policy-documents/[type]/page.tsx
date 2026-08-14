'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { Loader2, Save, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { Switch } from '@/components/ui/Switch';
import { PolicyDocumentType, policyDocumentTypeLabels } from '@kentslsc/shared';

interface PolicyDoc {
  id: string;
  type: PolicyDocumentType;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
  updatedBy?: string;
}

interface FormValues {
  title: string;
  content: string;
  isPublished: boolean;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs font-medium text-slate-500';
const errorClass = 'mt-1 text-xs text-rose-500';

export default function AdminPolicyDocumentEditPage() {
  const { type } = useParams<{ type: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const docType = type as PolicyDocumentType;
  const typeLabel = policyDocumentTypeLabels[docType] ?? type;

  const { data, isLoading } = useQuery<PolicyDoc>({
    queryKey: ['admin', 'policy-documents', docType],
    queryFn: async () => {
      const res = await api.get(`/policy-documents/admin/${docType}`);
      return res.data;
    },
    retry: false
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: { title: typeLabel, content: '', isPublished: false }
  });

  useEffect(() => {
    if (data) {
      reset({ title: data.title, content: data.content, isPublished: data.isPublished });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setSaveError(null);
      setSaved(false);
      const { data: result } = await api.put(`/policy-documents/admin/${docType}`, values);
      return result;
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['admin', 'policy-documents'] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      setSaveError(getApiErrorMessage(err));
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link href="/admin/policy-documents" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="section-title">{typeLabel}</h1>
      </div>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Edit the content for this policy document. Use Markdown formatting. Changes are saved immediately.
      </p>

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="mt-8 space-y-6"
      >
        <div className="glass-card space-y-5 p-6">
          <div>
            <label className={labelClass}>Document title</label>
            <input
              type="text"
              {...register('title', { required: 'Title is required' })}
              className={inputClass}
            />
            {errors.title && <p className={errorClass}>{errors.title.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Content (Markdown)</label>
            <textarea
              {...register('content', { required: 'Content is required' })}
              rows={30}
              className={`${inputClass} font-mono text-xs`}
              placeholder="# Document Title&#10;&#10;Write your policy content here in Markdown..."
            />
            {errors.content && <p className={errorClass}>{errors.content.message}</p>}
          </div>

          <Controller
            name="isPublished"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  label={
                    <span className="flex items-center gap-2">
                      {field.value ? (
                        <Eye className="h-4 w-4 text-green-400" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-slate-400" />
                      )}
                      {field.value ? 'Published — visible on public site' : 'Draft — not visible on public site'}
                    </span>
                  }
                />
              </div>
            )}
          />
        </div>

        {saveError && (
          <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
            {saveError}
          </div>
        )}

        {saved && (
          <div className="rounded-xl bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            Policy document saved successfully.
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary inline-flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save document
          </button>

          <Link href="/admin/policy-documents" className="btn-secondary inline-flex items-center gap-2">
            Cancel
          </Link>
        </div>

        {data?.updatedBy && (
          <p className="text-xs text-slate-500">
            Last updated by {data.updatedBy} on {new Date(data.updatedAt).toLocaleString()}
          </p>
        )}
      </form>
    </div>
  );
}
