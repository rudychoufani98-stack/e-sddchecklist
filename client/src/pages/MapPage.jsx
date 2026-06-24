import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import api from '../api';

// Fully-free basemap: ESRI satellite imagery + place-name labels + AWS terrarium DEM. No API key.
const MAP_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri — World Imagery',
    },
    // Transparent overlay with country borders, city & place names
    places: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Labels © Esri',
    },
    terrainDEM: {
      type: 'raster-dem',
      tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
    },
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'satellite' },
    // Hillshade adds depth/relief shading even when looking straight down
    { id: 'hillshade', type: 'hillshade', source: 'terrainDEM', paint: { 'hillshade-exaggeration': 0.4 } },
    { id: 'places', type: 'raster', source: 'places', paint: { 'raster-opacity': 0.9 } },
  ],
};

// Deterministic color per project
const PROJ_COLORS = ['#FFD400', '#00E0FF', '#FF5D8F', '#7CFF6B', '#FF9F1C', '#B388FF'];
function colorForProject(project, projects) {
  const i = Math.max(0, projects.indexOf(project));
  return PROJ_COLORS[i % PROJ_COLORS.length];
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MapPage({ user }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);

  const [projects, setProjects] = useState([]);
  const [features, setFeatures] = useState([]);
  const [selProject, setSelProject] = useState('');
  const [visible, setVisible] = useState({}); // project -> bool
  const [mode, setMode] = useState('view'); // 'view' | 'road' | 'extraction'
  const [draftRoad, setDraftRoad] = useState([]); // [[lng,lat], ...]
  const [draftPoint, setDraftPoint] = useState(null); // [lng,lat]
  const [form, setForm] = useState({ name: '', category: '', notes: '' });
  const [pasteText, setPasteText] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [exaggeration, setExaggeration] = useState(1.6);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const canEdit = user?.role === 'admin' || user?.role === 'construction';

  // Refs to read latest state inside the map click handler (avoids stale closure)
  const modeRef = useRef(mode);   useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Load projects + features ──
  const load = useCallback(async () => {
    try {
      const [rStruct, rFeat] = await Promise.all([
        api.get('/construction/structure'),
        api.get('/map'),
      ]);
      const projs = rStruct.data.projects || [];
      setProjects(projs);
      setFeatures(rFeat.data);
      setVisible(prev => {
        const v = { ...prev };
        projs.forEach(p => { if (v[p] === undefined) v[p] = true; });
        return v;
      });
      setSelProject(s => s || projs[0] || '');
    } catch (e) { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Init map once ──
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [6.5, 8.5], // Nigeria
      zoom: 5.3,
      pitch: 60,
      bearing: -20,
      maxPitch: 85,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    map.on('load', () => {
      // 3D terrain
      map.setTerrain({ source: 'terrainDEM', exaggeration: 1.6 });
      try {
        map.setSky({
          'sky-color': '#5a8fcf', 'horizon-color': '#cfe0f2',
          'fog-color': '#eaf1f9', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6,
          'fog-ground-blend': 0.3, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 0.4, 13, 0.1],
        });
      } catch { /* older versions */ }
      map.addControl(new maplibregl.TerrainControl({ source: 'terrainDEM', exaggeration: 1.6 }), 'top-right');

      // GeoJSON source for roads
      map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'roads-line', type: 'line', source: 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9 },
      });
      // Draft road (dashed, while drawing)
      map.addSource('draft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'draft-line', type: 'line', source: 'draft',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      });
      map.addLayer({
        id: 'draft-points', type: 'circle', source: 'draft',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#1a3c5e', 'circle-stroke-width': 2 },
      });
      setMapReady(true);
    });

    // Click handler — uses refs to read latest mode
    map.on('click', (e) => {
      const lngLat = [e.lngLat.lng, e.lngLat.lat];
      if (modeRef.current === 'road') {
        setDraftRoad(prev => [...prev, lngLat]);
      } else if (modeRef.current === 'extraction') {
        setDraftPoint(lngLat);
      }
    });

    // Cursor feedback
    map.on('mousemove', () => {
      map.getCanvas().style.cursor = modeRef.current === 'view' ? '' : 'crosshair';
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Render saved roads to the GeoJSON source ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getSource('roads')) return;
    const roadFeatures = features
      .filter(f => f.type === 'road' && visible[f.project])
      .map(f => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: f.coordinates },
        properties: { color: f.color || colorForProject(f.project, projects), id: f.id, name: f.name },
      }));
    map.getSource('roads').setData({ type: 'FeatureCollection', features: roadFeatures });
  }, [features, visible, projects, mapReady]);

  // ── Render extraction markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    features.filter(f => f.type === 'extraction' && visible[f.project]).forEach(f => {
      const color = f.color || colorForProject(f.project, projects);
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
      el.innerHTML = `
        <div style="width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #1a3c5e;box-shadow:0 2px 4px rgba(0,0,0,.4)"></div>
        <span style="margin-top:3px;font-size:10px;font-weight:700;color:#fff;background:rgba(26,60,94,.85);padding:1px 5px;border-radius:4px;white-space:nowrap">${f.name}</span>`;
      const popup = new maplibregl.Popup({ offset: 24, closeButton: true }).setHTML(
        `<div style="font-family:system-ui;font-size:12px;min-width:140px">
           <div style="font-weight:700;color:#1a3c5e;margin-bottom:2px">${f.name}</div>
           ${f.category ? `<div style="color:#e63946;font-weight:600;font-size:11px">${f.category}</div>` : ''}
           ${f.notes ? `<div style="color:#555;margin-top:4px">${f.notes}</div>` : ''}
           <div style="color:#999;margin-top:4px;font-size:10px">${f.coordinates[1].toFixed(5)}, ${f.coordinates[0].toFixed(5)}</div>
           ${f.created_at ? `<div style="color:#999;margin-top:2px;font-size:10px">📅 Added ${fmtDate(f.created_at)}${f.created_by ? ` · ${f.created_by}` : ''}</div>` : ''}
         </div>`
      );
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(f.coordinates).setPopup(popup).addTo(map);
      markersRef.current.push(marker);
    });
  }, [features, visible, projects, mapReady]);

  // ── Render draft (road being drawn or extraction point) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getSource('draft')) return;
    const draftFeatures = [];
    if (mode === 'road' && draftRoad.length) {
      if (draftRoad.length >= 2)
        draftFeatures.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: draftRoad }, properties: {} });
      draftRoad.forEach(c => draftFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }));
    }
    if (mode === 'extraction' && draftPoint)
      draftFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: draftPoint }, properties: {} });
    map.getSource('draft').setData({ type: 'FeatureCollection', features: draftFeatures });
  }, [draftRoad, draftPoint, mode, mapReady]);

  // Toggle place-name labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer('places')) return;
    map.setLayoutProperty('places', 'visibility', showLabels ? 'visible' : 'none');
  }, [showLabels, mapReady]);

  // Terrain exaggeration slider
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setTerrain({ source: 'terrainDEM', exaggeration });
  }, [exaggeration, mapReady]);

  // When typing manual coordinates for an extraction point, place + fly to it
  useEffect(() => {
    if (mode !== 'extraction') return;
    const lat = parseFloat(latInput), lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setDraftPoint([lng, lat]);
    }
  }, [latInput, lngInput, mode]);

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 3500); }

  function startMode(m) {
    setMode(m);
    setDraftRoad([]); setDraftPoint(null);
    setForm({ name: '', category: '', notes: '' });
    setPasteText(''); setLatInput(''); setLngInput('');
  }

  function flyToDraftPoint() {
    if (draftPoint) mapRef.current?.flyTo({ center: draftPoint, zoom: 14, pitch: 60, duration: 1500 });
  }

  function cancelDraft() { startMode('view'); }

  function parsePastedCoords() {
    // Accept "lng,lat" or "lat,lng"? We assume "lng, lat" per line. Also tolerate spaces/tabs.
    const coords = pasteText.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const parts = l.split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
      return parts.length >= 2 ? [parts[0], parts[1]] : null;
    }).filter(Boolean);
    if (coords.length >= 2) {
      setDraftRoad(coords);
      // Fly to the first point
      mapRef.current?.flyTo({ center: coords[0], zoom: 12 });
      flash(`Loaded ${coords.length} points from text.`);
    } else {
      flash('Need at least 2 valid "lng, lat" lines.');
    }
  }

  async function saveRoad() {
    if (draftRoad.length < 2) { flash('A road needs at least 2 points.'); return; }
    if (!form.name.trim()) { flash('Give the road a name.'); return; }
    setSaving(true);
    try {
      await api.post('/map', {
        project: selProject, type: 'road', name: form.name.trim(),
        notes: form.notes.trim() || null,
        color: colorForProject(selProject, projects),
        coordinates: draftRoad,
      });
      flash('✓ Road saved.');
      startMode('view'); load();
    } catch { flash('Error saving road.'); }
    setSaving(false);
  }

  async function saveExtraction() {
    if (!draftPoint) { flash('Click on the map to place the point.'); return; }
    if (!form.name.trim()) { flash('Give the site a name.'); return; }
    setSaving(true);
    try {
      await api.post('/map', {
        project: selProject, type: 'extraction', name: form.name.trim(),
        category: form.category.trim() || null, notes: form.notes.trim() || null,
        color: colorForProject(selProject, projects),
        coordinates: draftPoint,
      });
      flash('✓ Extraction site saved.');
      startMode('view'); load();
    } catch { flash('Error saving site.'); }
    setSaving(false);
  }

  async function deleteFeature(f) {
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    try { await api.delete(`/map/${f.id}`); load(); } catch { flash('Error deleting.'); }
  }

  function flyTo(f) {
    const map = mapRef.current; if (!map) return;
    const center = f.type === 'road' ? f.coordinates[Math.floor(f.coordinates.length / 2)] : f.coordinates;
    map.flyTo({ center, zoom: 13, pitch: 65, duration: 1500 });
  }

  // Group features by project for the sidebar list
  const byProject = projects.map(p => ({ project: p, items: features.filter(f => f.project === p) }))
    .filter(g => g.items.length || true);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#FDF6E3]">
      {/* ── Sidebar ── */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-amber-100 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h1 className="text-lg font-black text-[#1a3c5e]">3D Site Map</h1>
          <p className="text-xs text-slate-400 mt-0.5">Roads & extraction sites · tilt with right-drag</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Project picker */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Active project</label>
            <select value={selProject} onChange={e => setSelProject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: colorForProject(selProject, projects) }} />
              <span className="text-xs text-slate-500">New features use this color</span>
            </div>
          </div>

          {/* Add tools */}
          {canEdit && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Add to map</label>
              {mode === 'view' && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => startMode('road')}
                    className="px-3 py-2 text-xs font-bold bg-[#1a3c5e] text-white rounded-lg hover:bg-[#122d47] transition-colors">
                    ✏️ Draw Road
                  </button>
                  <button onClick={() => startMode('extraction')}
                    className="px-3 py-2 text-xs font-bold bg-[#e63946] text-white rounded-lg hover:bg-[#c92a37] transition-colors">
                    📍 Extraction
                  </button>
                </div>
              )}

              {/* Road panel — coordinate entry first */}
              {mode === 'road' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2.5">
                  <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Paste the road coordinates</p>
                  <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={6}
                    placeholder={'One point per line: longitude, latitude\n\n6.421, 8.512\n6.430, 8.520\n6.438, 8.529'}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono" />
                  <button onClick={parsePastedCoords} className="w-full px-2 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    ↧ Load {pasteText.trim() ? `(${pasteText.trim().split('\n').filter(Boolean).length} lines)` : 'points'}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">
                    {draftRoad.length ? `✓ ${draftRoad.length} points loaded` : 'or click on the map to add points'}
                  </p>
                  <div className="border-t border-blue-100 pt-2 space-y-2">
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Road name (e.g. Section 1 alignment)"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                    <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setDraftRoad(p => p.slice(0, -1))} disabled={!draftRoad.length}
                      className="flex-1 px-2 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40">↶ Undo</button>
                    <button onClick={cancelDraft} className="flex-1 px-2 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg">Cancel</button>
                    <button onClick={saveRoad} disabled={saving || draftRoad.length < 2}
                      className="flex-1 px-2 py-1.5 text-xs font-bold bg-[#1a3c5e] text-white rounded-lg disabled:opacity-40">Save</button>
                  </div>
                </div>
              )}

              {/* Extraction panel */}
              {mode === 'extraction' && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2.5">
                  <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Enter coordinates</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Latitude</label>
                      <input type="number" step="any" value={latInput} onChange={e => setLatInput(e.target.value)}
                        placeholder="8.51234"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Longitude</label>
                      <input type="number" step="any" value={lngInput} onChange={e => setLngInput(e.target.value)}
                        placeholder="6.42100"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono" />
                    </div>
                  </div>
                  <button onClick={flyToDraftPoint} disabled={!draftPoint}
                    className="w-full px-2 py-1.5 text-xs font-bold bg-slate-700 text-white rounded-lg disabled:opacity-40">
                    🎯 Go to coordinate
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">
                    {draftPoint ? `✓ ${draftPoint[1].toFixed(5)}, ${draftPoint[0].toFixed(5)}` : 'or click directly on the map'}
                  </p>
                  <div className="border-t border-red-100 pt-2 space-y-2">
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Site name (e.g. Borrow pit A)"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                    <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="Category (e.g. Quarry, Borrow pit, Soil)"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                    <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={cancelDraft} className="flex-1 px-2 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg">Cancel</button>
                    <button onClick={saveExtraction} disabled={saving || !draftPoint}
                      className="flex-1 px-2 py-1.5 text-xs font-bold bg-[#e63946] text-white rounded-lg disabled:opacity-40">Save</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {msg && <p className={`text-xs font-semibold ${msg.startsWith('✓') ? 'text-green-600' : 'text-amber-600'}`}>{msg}</p>}

          {/* Display controls */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Display</label>
            <label className="flex items-center gap-2 text-xs text-slate-600 mb-2 cursor-pointer">
              <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
              Show city & country names
            </label>
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                <span>3D terrain intensity</span><span>{exaggeration.toFixed(1)}×</span>
              </div>
              <input type="range" min="0" max="3" step="0.2" value={exaggeration}
                onChange={e => setExaggeration(Number(e.target.value))} className="w-full" />
            </div>
          </div>

          {/* Layers / feature list */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Layers</label>
            <div className="space-y-3">
              {byProject.map(({ project, items }) => (
                <div key={project} className="border border-slate-100 rounded-xl overflow-hidden">
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={!!visible[project]}
                      onChange={e => setVisible(v => ({ ...v, [project]: e.target.checked }))} />
                    <span className="w-3 h-3 rounded-full" style={{ background: colorForProject(project, projects) }} />
                    <span className="text-xs font-bold text-slate-700 flex-1">{project}</span>
                    <span className="text-[10px] text-slate-400">{items.length}</span>
                  </label>
                  {items.length > 0 && (
                    <ul className="divide-y divide-slate-50">
                      {items.map(f => (
                        <li key={f.id} className="flex items-center gap-2 px-3 py-2 group hover:bg-amber-50/40">
                          <span className="text-sm">{f.type === 'road' ? '🛣️' : '📍'}</span>
                          <button onClick={() => flyTo(f)} className="flex-1 text-left min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p>
                            {f.category && <p className="text-[10px] text-red-500 truncate">{f.category}</p>}
                            {f.created_at && <p className="text-[10px] text-slate-400 truncate">📅 {fmtDate(f.created_at)}</p>}
                          </button>
                          {canEdit && (
                            <button onClick={() => deleteFeature(f)}
                              className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs">✕</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {projects.length === 0 && <p className="text-xs text-slate-400 italic">No projects found.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="absolute inset-0" />
        {mode !== 'view' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#1a3c5e] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-10">
            {mode === 'road' ? '✏️ Drawing road — click to add points' : '📍 Click to place extraction site'}
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-white/85 text-[10px] text-slate-600 px-2 py-1 rounded-md shadow z-10 max-w-[260px]">
          🛰️ Esri World Imagery — newest available, date varies by area. Each pin shows the date you added it.
        </div>
      </div>
    </div>
  );
}
