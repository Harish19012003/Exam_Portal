import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from '../router';
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

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  );
};

export default App;
