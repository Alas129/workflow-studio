import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorkflowEditorPage } from './pages/WorkflowEditorPage';
import { RunHistoryPage } from './pages/RunHistoryPage';
import { MetricsPage } from './pages/MetricsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<WorkflowEditorPage />} />
            <Route path="/history" element={<RunHistoryPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
