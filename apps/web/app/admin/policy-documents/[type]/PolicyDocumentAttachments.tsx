'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Trash2, Upload, ExternalLink } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { PolicyDocumentType } from '@kentslsc/shared';
import { formatDate } from '@/lib/utils';

interface PolicyDocFile {
  id: string;
  name: string;
  fileUrl: string;
  fileSize: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface AdminPolicyDoc {
  id: string;
  type: PolicyDocumentType;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
  files: PolicyDocFile[];
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PolicyDocumentAttachments({ docType }: { docType: PolicyDocumentType }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<AdminPolicyDoc>({
    queryKey: ['admin', 'policy-documents', docType],
    queryFn: async () => {
      const res = await api.get(`/policy-documents/admin/${docType}`);
      return res.data;
    }
  });

  const files = data?.files ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'policy-documents', docType] });

  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!pendingFile) throw new Error('Choose a PDF file first');
      setError(null);
      const formData = new FormData();
      formData.append('file', pendingFile);
      const uploadRes = await api.post('/uploads', formData);
      await api.post(`/policy-documents/admin/${docType}/files`, {
        name: displayName.trim() || pendingFile.name.replace(/\.pdf$/i, ''),
        fileUrl: uploadRes.data.url,
        filePath: uploadRes.data.path,
        fileSize: pendingFile.size
      });
    },
    onSuccess: () => {
      setPendingFile(null);
      setDisplayName('');
      if (inputRef.current) inputRef.current.value = '';
      invalidate();
    },
    onError: (err: unknown) => setError(getApiErrorMessage(err))
  });

  const removeMutation = useMutation({
    mutationFn: async (fileId: string) => {
      setError(null);
      await api.delete(`/policy-documents/admin/files/${fileId}`);
    },
    onSuccess: invalidate,
    onError: (err: unknown) => setError(getApiErrorMessage(err))
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPendingFile(file);
    setDisplayName(file.name.replace(/\.pdf$/i, ''));
  };

  return (
    <div className="glass-card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Attached documents</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Upload PDF files (e.g. the current policy document). They appear as links at the top of
          the public page and open in a new tab.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neon-blue" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-slate-500">No documents attached yet.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 py-3">
              <FileText className="h-5 w-5 flex-shrink-0 text-neon-blue" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {[formatFileSize(file.fileSize), formatDate(file.createdAt)]
                    .filter(Boolean)
                    .join(' · ')}
                  {file.uploadedBy ? ` · by ${file.uploadedBy}` : ''}
                </p>
              </div>
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => removeMutation.mutate(file.id)}
                disabled={removeMutation.isPending}
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                title="Remove document"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-white/10 pt-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Link text</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Name shown on the website, e.g. Membership Policy 2026"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
          >
            <Upload className="h-4 w-4" />
            Choose PDF
          </button>
          {pendingFile && (
            <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
              {pendingFile.name} ({formatFileSize(pendingFile.size)})
            </span>
          )}
          <button
            type="button"
            onClick={() => attachMutation.mutate()}
            disabled={!pendingFile || attachMutation.isPending}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {attachMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Attach document
          </button>
        </div>

        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>
    </div>
  );
}
