import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import api from '../api.js';
import { PARKING } from '../config.js';

// Vite breaks Leaflet's default marker paths — wire the bundled images explicitly.
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 16); }, [pos, map]);
  return null;
}

function distanceKm(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))).toFixed(2);
}

export default function Location() {
  const [stats, setStats] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [geoMsg, setGeoMsg] = useState('');
  const lot = [PARKING.lat, PARKING.lng];
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${PARKING.lat},${PARKING.lng}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${PARKING.lat},${PARKING.lng}`;

  useEffect(() => {
    api.get('/slots/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const findMe = () => {
    if (!navigator.geolocation) { setGeoMsg('Your browser does not support location.'); return; }
    setGeoMsg('Locating you…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserPos([p.coords.latitude, p.coords.longitude]); setGeoMsg(''); },
      () => setGeoMsg('Could not get your location — please allow location access.'),
      { timeout: 10000 },
    );
  };

  return (
    <div>
      <h2>📍 Parking Location</h2>
      <p className="muted">{PARKING.name} · {PARKING.address}</p>

      {stats && (
        <div className="statrow">
          <div className="stat"><b>{stats.total}</b><span>Total slots</span></div>
          <div className="stat ok"><b>{stats.available}</b><span>Free right now</span></div>
          <div className="stat bad"><b>{stats.occupied}</b><span>Occupied</span></div>
          <div className="stat"><b>{stats.occupancyPct}%</b><span>Full</span></div>
        </div>
      )}

      <div className="mapbox">
        <MapContainer center={lot} zoom={16} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle center={lot} radius={130} pathOptions={{ color: '#0d9488', fillColor: '#0d9488', fillOpacity: 0.12 }} />
          <Marker position={lot}>
            <Popup>
              <b>{PARKING.name}</b><br />
              {PARKING.address}<br />
              {stats ? <>🅿️ {stats.available} of {stats.total} bays free right now</> : 'Loading live availability…'}
            </Popup>
          </Marker>
          {userPos && (
            <Marker position={userPos}>
              <Popup>You are here — about {distanceKm(userPos, lot)} km from the parking lot.</Popup>
            </Marker>
          )}
          <FlyTo pos={userPos} />
        </MapContainer>
      </div>

      <div className="btnrow">
        <a href={directionsUrl} target="_blank" rel="noreferrer"><button>🧭 Get directions</button></a>
        <a href={mapsUrl} target="_blank" rel="noreferrer"><button className="btn-amber">Open in Google Maps</button></a>
        <button onClick={findMe}>📍 Show my location</button>
      </div>
      {geoMsg && <p className="muted">{geoMsg}</p>}
      {userPos && <p className="peak">You are about {distanceKm(userPos, lot)} km from the parking lot.</p>}
      <p className="muted">Map: Leaflet + OpenStreetMap (free, no API key). The teal circle is the parking area — the pin sits at the campus centre by default; the exact gate can be set in <i>src/config.js</i>.</p>

      <div className="photocard">
        <img src="/images/hero-aerial.jpg" alt="Aerial view of the campus parking area" />
        <div className="pc-in">
          <h3>The lot from above 🛰️</h3>
          <p>Baghdad-ul-Jadeed Campus, Hasilpur Road — about 8 km from Bahawalpur city centre. Head to the main gate and follow the PARQCO signs to Zone A.</p>
        </div>
      </div>
    </div>
  );
}
