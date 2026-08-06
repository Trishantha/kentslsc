'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { businessListingSchema, jobAdSchema } from '@kentslsc/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Crown,
  Briefcase,
  Loader2,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

const updateBusinessSchema = businessListingSchema.partial();
const createJobSchema = jobAdSchema.extend({
  businessListingId: z.string().uuid()
});

type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
type CreateJobInput = z.infer<typeof createJobSchema>;

interface Business {
  id: string;
  ownerUserId: string;
  businessName: string;
  logoUrl?: string;
  description?: string;
  servicesText?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  isPaid: boolean;
  isPromoted: boolean;
  promotedUntil?: string;
  createdAt: string;
  jobAds: Job[];
  owner: { id: string; name: string };
}

interface Job {
  id: string;
  businessListingId?: string;
  title: string;
  description?: string;
  location?: string;
  salaryRange?: string;
  contactEmail?: string;
  closingDate?: string;
  isPublished: boolean;
  createdAt: string;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400';

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: user } = useAuth();

  const { data: business, isLoading } = useQuery<Business>({
    queryKey: ['directory', 'businesses', id],
    queryFn: async () => {
      const { data } = await api.get(`/directory/businesses/${id}`);
      return data;
    },
    enabled: !!id
  });

  const canManage =
    user && business && (user.role === 'ADMIN' || user.id === business.ownerUserId);
  const isBusinessOwner = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN';

  const updateForm = useForm<UpdateBusinessInput>({
    resolver: zodResolver(updateBusinessSchema),
    values: business
      ? {
          businessName: business.businessName,
          logoUrl: business.logoUrl,
          description: business.description,
          servicesText: business.servicesText,
          websiteUrl: business.websiteUrl,
          email: business.email,
          phone: business.phone,
          address: business.address,
          category: business.category,
          isPaid: business.isPaid
        }
      : undefined
  });

  const jobForm = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { businessListingId: id }
  });

  const updateBusiness = useMutation({
    mutationFn: (data: UpdateBusinessInput) =>
      api.put(`/directory/businesses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses', id] });
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses'] });
    }
  });

  const deleteBusiness = useMutation({
    mutationFn: () => api.delete(`/directory/businesses/${id}`),
    onSuccess: () => {
      window.location.href = '/directory';
    }
  });

  const createJob = useMutation({
    mutationFn: (data: CreateJobInput) => api.post('/directory/jobs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses', id] });
      queryClient.invalidateQueries({ queryKey: ['directory', 'jobs'] });
      jobForm.reset({ businessListingId: id });
    }
  });

  const deleteJob = useMutation({
    mutationFn: (jobId: string) => api.delete(`/directory/jobs/${jobId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses', id] });
      queryClient.invalidateQueries({ queryKey: ['directory', 'jobs'] });
    }
  });

  const promote = useMutation({
    mutationFn: () => api.post(`/directory/businesses/${id}/promote`),
    onSuccess: (res) => {
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    }
  });

  const summarise = useMutation({
    mutationFn: () => api.post(`/directory/businesses/${id}/summarise`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses', id] });
    }
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="px-4 py-16 text-center md:px-6">
        <p className="text-slate-600 dark:text-slate-400">Business not found.</p>
        <Link href="/directory" className="btn-primary mt-4 inline-block">
          Back to directory
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-12 md:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/directory"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-neon-blue dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to directory
        </Link>

        <div className="mt-6 glass-card p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-5">
              {business.logoUrl ? (
                <img
                  src={business.logoUrl}
                  alt={business.businessName}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-neon-gold to-amber-500" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{business.businessName}</h1>
                  {business.isPromoted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neon-gold/10 px-2 py-1 text-xs font-medium text-neon-gold">
                      <Crown className="h-3 w-3" /> Promoted
                    </span>
                  )}
                </div>
                {business.category && (
                  <p className="text-sm text-slate-500">{business.category}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                  {business.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {business.address}
                    </span>
                  )}
                  {business.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {business.phone}
                    </span>
                  )}
                  {business.email && (
                    <a
                      href={`mailto:${business.email}`}
                      className="flex items-center gap-1 hover:text-neon-blue"
                    >
                      <Mail className="h-4 w-4" /> {business.email}
                    </a>
                  )}
                  {business.websiteUrl && (
                    <a
                      href={business.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-neon-blue"
                    >
                      <Globe className="h-4 w-4" /> Website
                    </a>
                  )}
                </div>
              </div>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => summarise.mutate()}
                  disabled={summarise.isPending}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {summarise.isPending ? 'Summarising...' : 'AI Summarise'}
                </button>
                <button
                  onClick={() => promote.mutate()}
                  disabled={promote.isPending}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Crown className="h-4 w-4" />
                  {promote.isPending ? 'Loading...' : 'Promote 30 days'}
                </button>
                <button
                  onClick={() => deleteBusiness.mutate()}
                  disabled={deleteBusiness.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <h2 className="text-lg font-bold">About</h2>
            <p className="mt-2 whitespace-pre-line text-slate-600 dark:text-slate-400">
              {business.description || 'No description available.'}
            </p>
            {business.servicesText && (
              <div className="mt-4">
                <h3 className="font-semibold">Services</h3>
                <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-400">
                  {business.servicesText}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 glass-card p-6 md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Briefcase className="h-5 w-5" /> Jobs at {business.businessName}
            </h2>
          </div>
          <div className="mt-4 space-y-4">
            {business.jobAds.length === 0 && (
              <p className="text-slate-500">No jobs listed yet.</p>
            )}
            {business.jobAds.map((job) => (
              <div
                key={job.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center"
              >
                <div>
                  <h3 className="font-bold">{job.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                    {job.location && <span>{job.location}</span>}
                    {job.salaryRange && <span>{job.salaryRange}</span>}
                    {job.closingDate && (
                      <span>Closes {new Date(job.closingDate).toLocaleDateString()}</span>
                    )}
                    {job.contactEmail && (
                      <a href={`mailto:${job.contactEmail}`} className="text-neon-blue hover:underline">
                        {job.contactEmail}
                      </a>
                    )}
                  </div>
                  {job.description && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{job.description}</p>
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={() => deleteJob.mutate(job.id)}
                    disabled={deleteJob.isPending}
                    className="inline-flex items-center gap-1 self-start rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="glass-card p-6">
              <h3 className="text-xl font-bold">Edit listing</h3>
              <form
                onSubmit={updateForm.handleSubmit((data) => updateBusiness.mutate(data))}
                className="mt-4 space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">Business name</label>
                  <input {...updateForm.register('businessName')} className={inputClass} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <input {...updateForm.register('category')} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Website</label>
                    <input {...updateForm.register('websiteUrl')} className={inputClass} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <input {...updateForm.register('email')} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <input {...updateForm.register('phone')} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Address</label>
                  <input {...updateForm.register('address')} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    rows={4}
                    {...updateForm.register('description')}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Services</label>
                  <textarea
                    rows={3}
                    {...updateForm.register('servicesText')}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={updateBusiness.isPending}
                  className="btn-primary w-full"
                >
                  {updateBusiness.isPending ? 'Saving...' : 'Update Listing'}
                </button>
              </form>
            </div>

            {isBusinessOwner && (
              <div className="glass-card p-6">
                <h3 className="flex items-center gap-2 text-xl font-bold">
                  <Plus className="h-5 w-5" /> Post a job
                </h3>
                <form
                  onSubmit={jobForm.handleSubmit((data) => createJob.mutate(data))}
                  className="mt-4 space-y-4"
                >
                  <input type="hidden" {...jobForm.register('businessListingId')} value={id} />
                  <div>
                    <label className="text-sm font-medium">Job title</label>
                    <input {...jobForm.register('title')} className={inputClass} />
                    {jobForm.formState.errors.title && (
                      <p className="mt-1 text-xs text-red-500">
                        {jobForm.formState.errors.title.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Location</label>
                      <input {...jobForm.register('location')} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Salary range</label>
                      <input {...jobForm.register('salaryRange')} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Contact email</label>
                    <input {...jobForm.register('contactEmail')} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      rows={4}
                      {...jobForm.register('description')}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      {...jobForm.register('isPublished')}
                      className="h-4 w-4 rounded border-white/10 bg-white/10"
                    />
                    <label className="text-sm font-medium">Publish immediately</label>
                  </div>
                  <button type="submit" disabled={createJob.isPending} className="btn-primary w-full">
                    {createJob.isPending ? 'Saving...' : 'Post Job'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
