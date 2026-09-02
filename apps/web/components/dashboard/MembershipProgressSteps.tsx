'use client';

interface MembershipProgressStepsProps {
  stage?: 'FORM_SUBMITTED' | 'AWAITING_APPROVAL' | 'AWAITING_PAYMENT' | 'PAYMENT_PROCESSED' | 'APPROVED' | 'REJECTED';
}

export function MembershipProgressSteps({ stage }: MembershipProgressStepsProps) {
  if (stage === 'REJECTED') {
    return (
      <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
        Your paid application was not accepted. A free membership has been activated for you instead.
      </div>
    );
  }

  const steps = [
    { key: 'FORM_SUBMITTED', label: 'Form submitted' },
    { key: 'AWAITING_APPROVAL', label: 'Awaiting approval' },
    { key: 'AWAITING_PAYMENT', label: 'Payment link sent' },
    { key: 'PAYMENT_PROCESSED', label: 'Payment processed' },
    { key: 'APPROVED', label: 'Approved' }
  ] as const;
  const activeIndex = steps.findIndex((s) => s.key === stage);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const done = activeIndex >= 0 && index <= activeIndex;
        return (
          <span
            key={step.key}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              done ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-slate-500'
            }`}
          >
            {step.label}
          </span>
        );
      })}
    </div>
  );
}
