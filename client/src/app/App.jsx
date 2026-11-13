import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from '../router';
import { DocumentBranding } from '../components/DocumentBranding';
import { ToastProvider } from '../components/ui/Toast';
import { FeedbackProvider } from '../feedback';

// Initialize React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Dev-only heading font switcher. Loaded lazily behind a build-time constant, so it (and its CSS) never ships.
const FontLab = import.meta.env.DEV
  ? lazy(() => import('../components/dev/FontLab').then((m) => ({ default: m.FontLab })))
  : null;

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <ToastProvider>
          <DocumentBranding />
          <AppRouter />
          {/* Dev-only heading font switcher (removed from production builds). */}
          {FontLab && (
            <Suspense fallback={null}>
              <FontLab />
            </Suspense>
          )}
        </ToastProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  );
};

export default App;
