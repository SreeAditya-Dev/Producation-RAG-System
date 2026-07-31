import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { Query } from './pages/Query';
import { Visualizer } from './pages/Visualizer';
import { Docs } from './pages/Docs';
import { KTGraph } from './pages/KTGraph';
import { QueryValidation } from './pages/QueryValidation';
import { Review } from './pages/Review';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/query" element={<Query />} />
            <Route path="/validation" element={<QueryValidation />} />
            <Route path="/visualizer" element={<Visualizer />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/kt-graph" element={<KTGraph />} />
            <Route path="/review" element={<Review />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#e2e8f0',
            border: '1px solid #2a2a45',
            borderRadius: '12px',
            fontSize: '13px',
          },
        }}
      />
    </QueryClientProvider>
  );
}
