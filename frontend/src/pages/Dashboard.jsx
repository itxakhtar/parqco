import { useEffect, useState } from 'react';
import api from '../api.js';
import { getSocket } from '../socket.js';

export default function Dashboard() {
  const [slots, setSlots] = useState([]);
  const [stats, setStats] = useState(null);
  const [alert, setAlert] = useState('');

  useEffect(() => {
    api.get('/slots').then(({ data }) => setSlots(data.slots)).catch(() => {});
    api.get('/slots/stats').then(({ data }) => setStats(data)).catch(() => {});

    const socket = getSocket();
    socket.on('slots:update', (s) => setSlots(s));
    socket.on('stats:update', (st) => {
      setStats(st);
      // In-dashboard notification (SRS §5.1.5): warn when nearly full.
      if (st.total > 0 && st.available === 0) setAlert('🚨 Parking is FULL right now.');
      else if (st.total > 0 && st.available / st.total < 0.2) setAlert(`⚠️ Only ${st.available} slot(s) left!`);
      else setAlert('');
    });
    return () => { socket.off('slots:update'); socket.off('stats:update'); };
  }, []);

  const zones = [...new Set(slots.map((s) => s.zone))].sort();

  return (
    <div>
      <h2>Live Parking Map</h2>
      {stats && (
        <div className="statrow">
          <div className="stat"><b>{stats.total}</b><span>Total slots</span></div>
          <div className="stat ok"><b>{stats.available}</b><span>Available</span></div>
          <div className="stat bad"><b>{stats.occupied}</b><span>Occupied</span></div>
          <div className="stat"><b>{stats.occupancyPct}%</b><span>Occupancy</span></div>
        </div>
      )}
      {alert && <div className="alert">{alert}</div>}
      {slots.length === 0 && (
        <p className="muted">No slots yet — an admin can add them, enable Demo Mode, or connect an ESP32.</p>
      )}
      {zones.map((z) => (
        <div key={z} className="zone">
          <h3>Zone {z}</h3>
          <div className="grid">
            {slots.filter((s) => s.zone === z).map((s) => (
              <div key={s.slotId} className={`slot ${s.status}`} title={s.sensorId ? `Sensor: ${s.sensorId}` : 'No sensor yet'}>
                <b>{s.label}</b>
                <span>{s.status === 'occupied' ? '🚗 Occupied' : '✅ Free'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
