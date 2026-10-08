import { useEffect, useState } from 'react';
import api from '../api.js';

function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Booking() {
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [start, setStart] = useState(() => toLocalInput(new Date(Date.now() + 3600000)));
  const [end, setEnd] = useState(() => toLocalInput(new Date(Date.now() + 7200000)));
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get('/slots').then(({ data }) => {
      setSlots(data.slots);
      if (!slotId && data.slots.length) setSlotId(data.slots[0].slotId);
    }).catch(() => {});
    api.get('/bookings').then(({ data }) => setBookings(data.bookings)).catch(() => {});
  };
  useEffect(load, []);

  const book = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/bookings', { slotId, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() });
      setMsg('✅ Booking confirmed!');
      load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Booking failed'));
    }
  };

  const cancel = async (id) => {
    await api.delete(`/bookings/${id}`);
    load();
  };

  return (
    <div>
      <h2>Book a Slot</h2>
      <form onSubmit={book} className="card form rowform">
        <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
          {slots.map((s) => <option key={s.slotId} value={s.slotId}>{s.label} ({s.status})</option>)}
        </select>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        <button type="submit">Reserve</button>
      </form>
      {msg && <p>{msg}</p>}
      <h3>My bookings</h3>
      {bookings.length === 0 && <p className="muted">No bookings yet.</p>}
      <div className="list">
        {bookings.map((b) => (
          <div key={b._id} className="listrow">
            <span><b>{b.slotId}</b> · {new Date(b.startTime).toLocaleString()} → {new Date(b.endTime).toLocaleString()}</span>
            <span className={`pill ${b.status}`}>{b.status}</span>
            {b.status === 'active' && <button className="linkbtn" onClick={() => cancel(b._id)}>Cancel</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
