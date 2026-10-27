// Leaflet + OpenStreetMap. The map never asks for the viewer's GPS; it only shows or picks a meeting pin.
export const CAMPUS = { lat: 20.0436, lng: 99.8954 }; // Mae Fah Luang University

const ready = () => typeof window.L !== 'undefined';

function fallback(container, message) {
  container.classList.add('map-fallback');
  container.textContent = message;
}

function addTiles(map, container) {
  window.L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
  }).addTo(map).once('tileerror', () => {
    if (container.nextElementSibling?.dataset.tileError) return;
    container.insertAdjacentHTML('afterend', '<p class="help" data-tile-error="1">โหลดภาพแผนที่ไม่สำเร็จ ใช้ชื่อสถานที่และรายละเอียดจุดนัดพบแทนได้</p>');
  });
}

// Read-only map showing one pin. Returns a cleanup function.
export function showPin(container, lat, lng) {
  if (!ready()) { fallback(container, 'แผนที่ไม่พร้อมใช้งาน กรุณาดูชื่อสถานที่และรายละเอียดจุดนัดพบด้านล่าง'); return () => {}; }
  const map = window.L.map(container, { scrollWheelZoom: false }).setView([lat, lng], 16);
  addTiles(map, container);
  window.L.marker([lat, lng], { keyboard: false }).addTo(map);
  return () => map.remove();
}

// Picker for the create form. onChange receives {lat, lng} or null.
export function createPicker(container, onChange, initial = null) {
  if (!ready()) { fallback(container, 'แผนที่ไม่พร้อมใช้งาน ระบุสถานที่เป็นข้อความได้'); return { clear() {}, destroy() {}, resize() {}, setPin(latlng) { onChange({ lat: Number(latlng.lat.toFixed(6)), lng: Number(latlng.lng.toFixed(6)) }); } }; }
  const start = initial ?? CAMPUS;
  const map = window.L.map(container, { scrollWheelZoom: false }).setView([start.lat, start.lng], 16);
  addTiles(map, container);
  let marker = null;
  const select = latlng => onChange({ lat: Number(latlng.lat.toFixed(6)), lng: Number(latlng.lng.toFixed(6)) });
  if (initial) {
    marker = window.L.marker([initial.lat, initial.lng], { draggable: true }).addTo(map);
    marker.on('dragend', () => select(marker.getLatLng()));
  }
  const place = latlng => {
    if (!marker) {
      marker = window.L.marker(latlng, { draggable: true }).addTo(map);
      marker.on('dragend', () => select(marker.getLatLng()));
    } else marker.setLatLng(latlng);
    select(window.L.latLng(latlng));
  };
  map.on('click', event => place(event.latlng));
  return {
    setPin(latlng) { place([latlng.lat, latlng.lng]); map.setView([latlng.lat, latlng.lng], 17); },
    clear() { marker?.remove(); marker = null; onChange(null); },
    destroy() { map.remove(); },
    resize() { setTimeout(() => map.invalidateSize(), 50); },
  };
}

// Place search (backlog 3.2) with OpenStreetMap Nominatim, called from the browser with only the typed words.
// Results near the campus come first. Nominatim's policy allows light, user-triggered use like this.
export async function searchPlaces(q) {
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', 'accept-language': 'th', countrycodes: 'th',
    viewbox: `${CAMPUS.lng - 0.08},${CAMPUS.lat + 0.08},${CAMPUS.lng + 0.08},${CAMPUS.lat - 0.08}` });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { referrerPolicy: 'strict-origin' });
  if (!response.ok) throw new Error('search failed');
  return (await response.json()).map(item => ({ name: item.display_name, lat: Number(Number(item.lat).toFixed(6)), lng: Number(Number(item.lon).toFixed(6)) }));
}
