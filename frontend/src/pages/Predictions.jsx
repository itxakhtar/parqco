import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api.js';

export default function Predictions() {
  const [data, setData] = useState(null);
  const [peak, setPeak] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/predictions', { params: { hours: 24 } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.hint || err.response?.data?.error || 'Could not load predictions'));
    api.get('/predictions/peak').then(({ data }) => setPeak(data)).catch(() => {});
  }, []);

  const chart = (data?.predictions || []).map((p) => ({
    time: new Date(p.time).toLocaleString([], { hour: 'numeric', day: 'numeric', month: 'short' }),
    occupancy: p.occupancyPct,
    free: p.availableSlots,
  }));

  return (
    <div>
      <h2>AI Parking Predictions</h2>
      {peak && <div className="peak">🔮 {peak.message}</div>}
      {error && <div className="card"><p>{error}</p><p className="muted">Ask an admin to generate sample history from the Admin panel.</p></div>}
      {data && (
        <div className="card">
          <h3>Predicted occupancy — next 24 hours</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={3} />
              <YAxis unit="%" domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="occupancy" name="Occupancy %" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="muted">Generated {new Date(data.generatedAt).toLocaleString()} · model: RandomForest on historical sensor data</p>
        </div>
      )}
    </div>
  );
}
