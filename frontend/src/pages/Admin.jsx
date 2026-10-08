import { useEffect, useState } from 'react';
import api from '../api.js';

export default function Admin() {
  const [demo, setDemo] = useState(false);
  const [msg, setMsg] = useState('');
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => {
    api.get('/admin/demo-mode').then(({ data }) => setDemo(data.demoMode)).catch(() => {});
    api.get('/slots').then(({ data }) => setSlots(data.slots)).catch(() => {});
  };
  useEffect(load, []);

  const run = async (label, fn) => {
    setBusy(label); setMsg('');
    try { const r = await fn(); setMsg('✅ ' + label + ' done.' + (r?.data?.ml ? '' : '')); }
    catch (err) { setMsg('❌ ' + (err.response?.data?.error || label + ' failed')); }
    setBusy('');
    load();
  };

  const toggleDemo = () => run(demo ? 'Disabling demo mode' : 'Enabling demo mode',
    () => api.post('/admin/demo-mode', { enabled: !demo }));

  const addSlot = async (e) => {
    e.preventDefault();
    if (!newSlot.trim()) return;
    await run('Adding slot', () => api.post('/slots', { slotId: newSlot.trim() }));
    setNewSlot('');
  };

  const setStatus = (slotId, status) =>
    run(`Marking ${slotId} ${status}`, () => api.patch(`/slots/${slotId}`, { status }));

  const remove = (slotId) =>
    window.confirm(`Delete slot ${slotId}?`) && run(`Deleting ${slotId}`, () => api.delete(`/slots/${slotId}`));

  return (
    <div>
      <h2>Admin Panel</h2>

      <div className="card">
        <h3>AI model</h3>
        <p className="muted">Generate 28 days of sample history and train the prediction model. Do this once after first deploy.</p>
        <div className="btnrow">
          <button disabled={!!busy} onClick={() => run('Generating sample history', () => api.post('/admin/seed'))}>
            {busy ? 'Working…' : 'Generate sample history + train'}
          </button>
          <button disabled={!!busy} onClick={() => run('Retraining model', () => api.post('/admin/train'))}>Retrain model</button>
          <button disabled={!!busy} onClick={() => run('Sweeping bookings', () => api.post('/bookings/sweep'))}>Sweep past bookings</button>
        </div>
      </div>

      <div className="card">
        <h3>Demo mode {demo && <span className="pill active">ON</span>}</h3>
        <p className="muted">Simulates ESP32 sensor traffic when hardware isn't available (demo-day safety net).</p>
        <button onClick={toggleDemo} disabled={!!busy}>{demo ? 'Disable demo mode' : 'Enable demo mode'}</button>
      </div>

      <div className="card">
        <h3>Slots</h3>
        <form onSubmit={addSlot} className="rowform">
          <input placeholder="New slot ID, e.g. C1" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
          <button type="submit">Add slot</button>
        </form>
        <div className="list">
          {slots.map((s) => (
            <div key={s.slotId} className="listrow">
              <span><b>{s.label}</b> · zone {s.zone} · <span className={`pill ${s.status}`}>{s.status}</span></span>
              <span>
                <button className="linkbtn" onClick={() => setStatus(s.slotId, 'available')}>free</button>
                <button className="linkbtn" onClick={() => setStatus(s.slotId, 'occupied')}>occupied</button>
                <button className="linkbtn danger" onClick={() => remove(s.slotId)}>delete</button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {msg && <p>{msg}</p>}
    </div>
  );
}
