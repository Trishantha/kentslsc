'use client';

import { ReactNode } from 'react';
import { MembershipFeature } from '@kentslsc/shared';
import { useHasFeature } from '@/hooks/useFeatures';

interface FeatureGateProps {
  feature: MembershipFeature;
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ feature, fallback = null, children }: FeatureGateProps) {
  const hasFeature = useHasFeature(feature);
  return hasFeature ? <>{children}</> : <>{fallback}</>;
}
