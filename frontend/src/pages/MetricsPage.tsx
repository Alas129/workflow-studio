import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkflowMetrics } from '@/api/queries/useRuns';
import { useWorkflows } from '@/api/queries/useWorkflows';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';

export function MetricsPage() {
  const { data: workflows } = useWorkflows();
  const [selectedWf, setSelectedWf] = useState<string | null>(null);
  const { data: metrics } = useWorkflowMetrics(selectedWf);

  const chartData = metrics?.points.map((p) => ({
    date: new Date(p.started_at).toLocaleDateString(),
    duration_s: +(p.duration_ms / 1000).toFixed(2),
    passed: p.assertions_passed,
    failed: p.assertions_failed,
    status: p.status,
  })) ?? [];

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-3">
        <Link to="/" className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft size={18} />
        </Link>
        <TrendingUp size={18} className="text-gray-500" />
        <h1 className="text-sm font-semibold">Performance Metrics</h1>
        <select
          className="ml-4 text-sm border rounded px-2 py-1"
          value={selectedWf ?? ''}
          onChange={(e) => setSelectedWf(e.target.value || null)}
        >
          <option value="">Select workflow...</option>
          {workflows?.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {!selectedWf ? (
          <div className="text-center text-gray-500 py-12">Select a workflow to view metrics</div>
        ) : !chartData.length ? (
          <div className="text-center text-gray-500 py-12">No runs found for this workflow</div>
        ) : (
          <div className="space-y-8">
            {/* Duration over time */}
            <div>
              <h2 className="text-sm font-semibold mb-3">Duration (seconds)</h2>
              <div className="bg-white rounded-lg border p-4" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="duration_s"
                      stroke="#4A90D9"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Duration (s)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Assertion results */}
            <div>
              <h2 className="text-sm font-semibold mb-3">Test Results</h2>
              <div className="bg-white rounded-lg border p-4" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="passed" stackId="a" fill="#16A34A" name="Passed" />
                    <Bar dataKey="failed" stackId="a" fill="#DC2626" name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
