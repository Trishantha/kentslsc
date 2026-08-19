'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Loader2,
  QrCode,
  ScanLine,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Camera,
  CameraOff,
  Smartphone,
  Users,
  Calendar,
  CreditCard,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { MembershipScanResult } from '@kentslsc/shared';
import { useHtml5QrScanner } from '@/hooks/useHtml5QrScanner';

interface MembershipPreview {
  membershipId: string;
  memberName: string;
  email: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  dependantsCount: number;
  isExpired: boolean;
}

interface ScanResponse {
  scan: {
    id: string;
    result: MembershipScanResult;
    scannedAt: string;
  };
  result: MembershipScanResult;
  membership: MembershipPreview | null;
}

const resultConfig: Record<
  MembershipScanResult,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  [MembershipScanResult.VALID]: {
    label: 'Valid membership',
    color: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20',
    icon: ShieldCheck
  },
  [MembershipScanResult.EXPIRED]: {
    label: 'Membership expired',
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
    icon: AlertCircle
  },
  [MembershipScanResult.INACTIVE]: {
    label: 'Membership not active',
    color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
    icon: ShieldAlert
  },
  [MembershipScanResult.CANCELLED]: {
    label: 'Membership cancelled',
    color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20',
    icon: XCircle
  },
  [MembershipScanResult.NOT_FOUND]: {
    label: 'Membership not found',
    color: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',
    icon: QrCode
  }
};

export default function MembershipScanner() {
  const [manualCode, setManualCode] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');

  const {
    data: scanResult,
    error: scanError,
    isPending: scanPending,
    mutate: recordScan,
    reset: resetScan
  } = useMutation<ScanResponse, unknown, string>({
    mutationFn: async (qrCodeValue: string) => {
      const { data } = await api.post<ScanResponse>('/membership/scans', { qrCodeValue });
      return data;
    }
  });

  const { cameraState, cameraError, retry: retryCamera } = useHtml5QrScanner({
    enabled: mode === 'camera' && !scanResult && !scanPending,
    onScan: (decodedText) => {
      recordScan(decodedText);
    }
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    recordScan(manualCode.trim());
  };

  const handleReset = () => {
    resetScan();
    setManualCode('');
    retryCamera();
  };

  const handleSwitchMode = (next: 'camera' | 'manual') => {
    setMode(next);
    resetScan();
    setManualCode('');
  };

  const cameraBlocked = cameraState === 'denied' || cameraState === 'unsupported' || cameraState === 'error';

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold">Membership scanner</h2>
      <p className="text-sm text-slate-500">
        Scan a member’s QR code to validate their membership and record the entry.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => handleSwitchMode('camera')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
            mode === 'camera'
              ? 'bg-neon-blue text-white'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          )}
        >
          <Camera className="h-4 w-4" />
          Camera
        </button>
        <button
          type="button"
          onClick={() => handleSwitchMode('manual')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
            mode === 'manual'
              ? 'bg-neon-blue text-white'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          )}
        >
          <QrCode className="h-4 w-4" />
          Manual code
        </button>
      </div>

      <div className="mt-6">
        {mode === 'camera' && !scanResult && !scanPending && (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div id="qr-reader" />

            {cameraState === 'requesting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/5 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
                <p className="text-sm">Requesting camera permission…</p>
              </div>
            )}

            {(cameraState === 'idle' || cameraBlocked) && (
              <div className="absolute inset-0 flex h-64 flex-col items-center justify-center gap-4 p-6 text-center">
                {cameraState === 'denied' ? (
                  <CameraOff className="h-12 w-12 text-rose-500" />
                ) : cameraState === 'unsupported' ? (
                  <Smartphone className="h-12 w-12 text-amber-500" />
                ) : (
                  <Camera className="h-12 w-12 text-slate-500" />
                )}
                <div className="max-w-sm">
                  <p className="font-medium text-slate-300">
                    {cameraState === 'denied'
                      ? 'Camera permission denied'
                      : cameraState === 'unsupported'
                        ? 'Camera not available'
                        : 'Camera not started'}
                  </p>
                  {cameraError && <p className="mt-1 text-sm text-slate-500">{cameraError}</p>}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={retryCamera}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('manual')}
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    Enter manually
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'manual' && !scanResult && !scanPending && (
          <form onSubmit={handleManualSubmit} className="glass-card space-y-4 p-6">
            <label htmlFor="manual-code" className="block text-sm font-medium text-slate-300">
              Enter membership QR code
            </label>
            <input
              id="manual-code"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste the QR code value or membership ID"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-neon-blue"
            />
            <button type="submit" className="btn-primary inline-flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              Validate
            </button>
          </form>
        )}

        {scanPending && (
          <div className="glass-card flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
          </div>
        )}

        {!!scanError && !scanPending && (
          <div className="glass-card space-y-4 p-6 text-center text-rose-500">
            <AlertCircle className="mx-auto h-10 w-10" />
            <p className="font-medium">Could not record scan</p>
            <p className="text-sm text-slate-400">{getApiErrorMessage(scanError)}</p>
            <button onClick={handleReset} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}

        {scanResult && !scanPending && <ScanResultCard result={scanResult} onReset={handleReset} />}
      </div>
    </div>
  );
}

function ScanResultCard({
  result,
  onReset
}: {
  result: ScanResponse;
  onReset: () => void;
}) {
  const config = resultConfig[result.result];
  const Icon = config.icon;
  const membership = result.membership;

  return (
    <div className="glass-card space-y-5 p-6">
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center',
          config.color
        )}
      >
        <Icon className="h-12 w-12" />
        <div>
          <p className="text-xl font-bold">{config.label}</p>
          <p className="mt-1 text-sm opacity-80">
            {result.result === MembershipScanResult.VALID
              ? 'Scan recorded successfully'
              : 'This scan has been recorded for audit purposes'}
          </p>
        </div>
      </div>

      {membership && (
        <div className="space-y-3 rounded-xl bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Member</span>
            <span className="font-medium">{membership.memberName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</span>
            <span className="text-sm text-slate-300">{membership.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Membership ID</span>
            <span className="font-mono text-sm">{membership.membershipId}</span>
          </div>
          <div className="flex items-center justify-between">
            <CreditCard className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-300">
              {membership.type}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-300">
              {formatDate(membership.startDate)} – {formatDate(membership.endDate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-300">
              {membership.dependantsCount} dependant
              {membership.dependantsCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}

      <button onClick={onReset} className="btn-primary w-full inline-flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4" /> Scan next member
      </button>
    </div>
  );
}
