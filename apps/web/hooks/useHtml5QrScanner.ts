'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export type CameraState = 'idle' | 'requesting' | 'allowed' | 'denied' | 'unsupported' | 'error';

interface UseHtml5QrScannerOptions {
  enabled: boolean;
  onScan: (decodedText: string) => void;
}

interface UseHtml5QrScannerReturn {
  cameraState: CameraState;
  cameraError: string | null;
  retry: () => void;
  resume: () => void;
}

const CAMERA_CONSTRAINTS: MediaTrackConstraints = { facingMode: 'environment' };

function getCameraError(err: unknown): { state: Exclude<CameraState, 'idle' | 'requesting' | 'allowed'>; message: string } {
  const error = err as Error & { name?: string };

  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return {
      state: 'denied',
      message: 'Camera permission was denied. Allow camera access in your browser settings, or use manual entry.'
    };
  }

  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return {
      state: 'unsupported',
      message: 'No camera found on this device. Use manual entry instead.'
    };
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      state: 'unsupported',
      message: 'Your browser does not support camera access. Use manual entry instead.'
    };
  }

  return {
    state: 'error',
    message: error.message || 'Could not start the camera. Use manual entry instead.'
  };
}

export function useHtml5QrScanner(options: UseHtml5QrScannerOptions): UseHtml5QrScannerReturn {
  const { enabled, onScan } = options;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  onScanRef.current = onScan;

  const cleanup = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => undefined);
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      setCameraState('idle');
      setCameraError(null);
      return;
    }

    let active = true;

    const startScanner = async () => {
      setCameraState('requesting');
      setCameraError(null);

      const element = document.getElementById('qr-reader');
      if (!element) {
        if (active) {
          setCameraState('error');
          setCameraError('Scanner container not found.');
        }
        return;
      }

      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          CAMERA_CONSTRAINTS,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1
          },
          (decodedText) => {
            if (!active) return;
            scanner.pause();
            onScanRef.current(decodedText);
          },
          () => {
            // No QR code in frame — expected, ignore.
          }
        );

        if (!active) {
          scanner.stop().catch(() => undefined);
          return;
        }

        setCameraState('allowed');
      } catch (err) {
        if (!active) return;
        const { state, message } = getCameraError(err);
        setCameraState(state);
        setCameraError(message);
      }
    };

    startScanner();

    return () => {
      active = false;
      cleanup();
    };
  }, [enabled, retryKey, cleanup]);

  const retry = useCallback(() => {
    cleanup();
    setRetryKey((key) => key + 1);
  }, [cleanup]);

  const resume = useCallback(() => {
    scannerRef.current?.resume();
  }, []);

  return { cameraState, cameraError, retry, resume };
}
