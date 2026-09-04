'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          refetchOnWindowFocus: false
        }
      }
    });

    const referenceDataStaleTime = 5 * 60 * 1000;
    client.setQueryDefaults(['admin', 'businesses'], { staleTime: referenceDataStaleTime });
    client.setQueryDefaults(['admin', 'membership-types'], { staleTime: referenceDataStaleTime });
    client.setQueryDefaults(['membership-types'], { staleTime: referenceDataStaleTime });
    client.setQueryDefaults(['membership-features'], { staleTime: referenceDataStaleTime });

    return client;
  });

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="kentslsc-theme"
      disableTransitionOnChange
      enableColorScheme={false}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
