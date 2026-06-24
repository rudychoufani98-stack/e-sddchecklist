import { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { kml as kmlToGeoJSON } from '@tmcw/togeojson';
import api from '../api';

// MapLibre is loaded from CDN in public/index.html (window.maplibregl) so that
// Create React App's minifier never mangles MapLibre's web worker — bundling it
// breaks GeoJSON tiling, which silently stops vector layers (roads) from drawing.
const maplibregl = window.maplibregl;

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
    { id: 'places', type: 'raster', source: 'places', paint: { 'raster-opacity': 0.9 } },
  ],
};

// State-boundary outlines and state-name pins that came in with the KMZ import
// are not roads — hide them so only the real alignments show. (Data is kept in the
// DB; this only filters the view.) Matched case-insensitively by exact name.
const HIDDEN_NAMES = new Set([
  'lagos', 'lagos state', 'ogun', 'oyo', 'ondo', 'edo', 'delta', 'bayelsa',
  'rivers', 'abia', 'cross river', 'akwa ibom', 'kogi', 'enugu', 'anambra', 'imo',
  // Broken "connect points into one road" artifact (7 pts, 235km zigzag jumps)
  '1st legacy project sbs 23062026',
]);
const isHidden = (f) => HIDDEN_NAMES.has(String(f.name || '').trim().toLowerCase());

// Deterministic color per project (kept for the project legend dot)
const PROJ_COLORS = ['#FFD400', '#00E0FF', '#FF5D8F', '#7CFF6B', '#FF9F1C', '#B388FF'];
function colorForProject(project, projects) {
  const i = Math.max(0, projects.indexOf(project));
  return PROJ_COLORS[i % PROJ_COLORS.length];
}

// Distinct colour per section/road — each feature gets its own stable colour
// derived from its name, so every alignment is visually separable.
const SECTION_COLORS = [
  '#FFD400', '#00E0FF', '#FF5D8F', '#7CFF6B', '#FF9F1C', '#B388FF',
  '#36D399', '#F87272', '#3ABFF8', '#FBBD23', '#E879F9', '#A3E635',
  '#FB7185', '#22D3EE', '#FACC15', '#C084FC', '#4ADE80', '#FB923C',
];
function colorForFeature(f) {
  const name = String(f.name || f.id || '');
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SECTION_COLORS[h % SECTION_COLORS.length];
}

// Red → amber → green by construction % complete
function progressColor(pct) {
  if (pct == null) return '#9ca3af';        // gray = not linked / no data
  if (pct >= 80) return '#22c55e';           // green
  if (pct >= 50) return '#84cc16';           // lime
  if (pct >= 25) return '#f59e0b';           // amber
  return '#ef4444';                          // red
}
// The construction section a road is linked to is stored in its `category` field.
function linkedSection(f) { return (f.category || '').trim() || null; }

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// A road's coordinates are either a LineString ([[lng,lat],...]) or a
// MultiLineString ([[[lng,lat],...],...]). Detect by nesting depth.
function isMultiLine(coords) {
  return Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0]);
}
function roadGeometry(coords) {
  return isMultiLine(coords)
    ? { type: 'MultiLineString', coordinates: coords }
    : { type: 'LineString', coordinates: coords };
}
function firstVertex(coords) {
  return isMultiLine(coords) ? coords[0][0] : coords[0];
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
  // 0 = flat top-down (lines render reliably via hillshade relief).
  // >0 = true draped 3D terrain (tilt to see it).
  const [exaggeration, setExaggeration] = useState(0);
  const [importing, setImporting] = useState(false);
  const [joinPoints, setJoinPoints] = useState(false);
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // Construction link: colorMode 'section' (per-road colours) or 'progress' (by % complete)
  const [colorMode, setColorMode] = useState('section');
  const [sections, setSections] = useState([]); // [{ label, avg }] from construction data
  const [view, setView] = useState('map'); // 'map' | 'table'

  const canEdit = user?.role === 'admin' || user?.role === 'construction';

  // Refs to read latest state inside the map click handler (avoids stale closure)
  const modeRef = useRef(mode);   useEffect(() => { modeRef.current = mode; }, [mode]);
  const fittedRef = useRef(false);

  // ── Load projects + features ──
  const load = useCallback(async () => {
    // Load projects independently so the picker still works even if the
    // map_features table doesn't exist yet (the /map call would otherwise fail).
    try {
      const rStruct = await api.get('/construction/structure');
      const projs = rStruct.data.projects || [];
      setProjects(projs);
      setVisible(prev => {
        const v = { ...prev };
        projs.forEach(p => { if (v[p] === undefined) v[p] = true; });
        return v;
      });
      setSelProject(s => s || projs[0] || '');
    } catch (e) { /* ignore */ }

    try {
      const rFeat = await api.get('/map');
      setFeatures(rFeat.data);
    } catch (e) {
      setFeatures([]);
      flash('Map storage not set up yet — run the map_features SQL in Supabase to save features.');
    }

    // Construction progress per section → avg % (for the road colour-by-progress mode)
    try {
      const rC = await api.get('/construction');
      const acc = {};
      rC.data.forEach(r => {
        if (r.pct_progress == null) return;
        const label = `${r.project} / ${r.section}`;
        (acc[label] = acc[label] || []).push(Number(r.pct_progress));
      });
      setSections(Object.entries(acc).map(([label, vals]) => ({
        label, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      })).sort((a, b) => a.label.localeCompare(b.label)));
    } catch (e) { /* construction may be empty */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // When returning to the map tab, MapLibre needs a resize (its container was hidden)
  useEffect(() => {
    if (view === 'map' && mapRef.current) {
      const t = setTimeout(() => mapRef.current && mapRef.current.resize(), 50);
      return () => clearTimeout(t);
    }
  }, [view]);

  // ── Init map once ──
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [6.5, 8.5], // Nigeria
      zoom: 5.3,
      pitch: 0,      // top-down sky view by default; right-drag to tilt into 3D
      bearing: 0,
      maxPitch: 85,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    map.on('load', () => {
      // Terrain stays OFF by default so line layers render reliably (draped terrain
      // hides GeoJSON lines in MapLibre). The 3D slider turns on true terrain on demand.

      // GeoJSON source for roads
      map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // White casing underneath for contrast on satellite imagery
      map.addLayer({
        id: 'roads-casing', type: 'line', source: 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.6 },
      });
      map.addLayer({
        id: 'roads-line', type: 'line', source: 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 1 },
      });
      // Click a road → show its construction-progress link
      map.on('click', 'roads-line', (e) => {
        if (modeRef.current !== 'view') return;
        const p = e.features[0].properties;
        const pctTxt = p.pct === '' || p.pct == null
          ? '<span style="color:#888">not linked to a construction section</span>'
          : `<b>${p.link}</b> — <span style="color:${progressColor(Number(p.pct))};font-weight:700">${p.pct}% complete</span>`;
        new maplibregl.Popup({ offset: 8, closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:system-ui;font-size:12px;min-width:160px">
              <div style="font-weight:700;color:#1a3c5e;margin-bottom:3px">${p.name}</div>
              <div style="font-size:11px">${pctTxt}</div>
            </div>`)
          .addTo(map);
      });
      map.on('mouseenter', 'roads-line', () => { if (modeRef.current === 'view') map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'roads-line', () => { map.getCanvas().style.cursor = ''; });
      // Draft road (dashed, while drawing)
      map.addSource('draft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'draft-line', type: 'line', source: 'draft',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      });
      map.addLayer({
        id: 'draft-points', type: 'circle', source: 'draft',
        filter: ['==', ['geometry-type'], 'Point'],
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
      .filter(f => f.type === 'road' && visible[f.project] && !isHidden(f))
      .map(f => ({
        type: 'Feature',
        geometry: roadGeometry(f.coordinates),
        properties: (() => {
          const link = linkedSection(f);
          const pct = link ? sectionAvg(link) : null;
          return { color: featureColor(f), id: f.id, name: f.name, link: link || '', pct: pct == null ? '' : pct };
        })(),
      }));
    map.getSource('roads').setData({ type: 'FeatureCollection', features: roadFeatures });

    // Auto-frame everything once, the first time features arrive
    if (!fittedRef.current && features.length) {
      fittedRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      features.filter(f => !isHidden(f)).forEach(f => {
        if (f.type === 'extraction') bounds.extend(f.coordinates);
        else if (isMultiLine(f.coordinates)) f.coordinates.forEach(line => line.forEach(c => bounds.extend(c)));
        else f.coordinates.forEach(c => bounds.extend(c));
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, duration: 1200, maxZoom: 12 });
    }
  }, [features, visible, projects, mapReady, colorMode, sections]);

  // ── Render extraction markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    features.filter(f => f.type === 'extraction' && visible[f.project] && !isHidden(f)).forEach(f => {
      const color = featureColor(f);
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
  }, [features, visible, projects, mapReady, colorMode, sections]);

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

  // Terrain exaggeration slider — 0 keeps terrain off so lines stay visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (exaggeration > 0) {
      map.setTerrain({ source: 'terrainDEM', exaggeration });
      if (map.getPitch() < 10) map.easeTo({ pitch: 55, duration: 800 });
    } else {
      map.setTerrain(null);
    }
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

  function sectionAvg(label) {
    const s = sections.find(x => x.label === label);
    return s ? s.avg : null;
  }
  // Colour a feature: per-section palette, or by construction % when in progress mode
  function featureColor(f) {
    if (colorMode === 'progress' && f.type === 'road') {
      const link = linkedSection(f);
      return progressColor(link ? sectionAvg(link) : null);
    }
    return colorForFeature(f);
  }
  // Link a road to a construction section (stored in its category field)
  async function setLink(f, label) {
    try {
      await api.patch(`/map/${f.id}`, { category: label || null });
      setFeatures(prev => prev.map(x => x.id === f.id ? { ...x, category: label || null } : x));
    } catch { flash('Could not save link.'); }
  }

  function startMode(m) {
    setMode(m);
    setDraftRoad([]); setDraftPoint(null);
    setForm({ name: '', category: '', notes: '' });
    setPasteText(''); setLatInput(''); setLngInput('');
  }

  function flyToDraftPoint() {
    if (draftPoint) mapRef.current?.flyTo({ center: draftPoint, zoom: 14, duration: 1500 });
  }

  function cancelDraft() { startMode('view'); }

  // ── Import a KMZ/KML file (from Google Earth) ──
  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!selProject) { flash('Pick an active project first.'); return; }
    setImporting(true);
    try {
      let kmlText;
      if (file.name.toLowerCase().endsWith('.kmz')) {
        const zip = await JSZip.loadAsync(file);
        // KMZ holds one or more .kml entries; use the first (usually doc.kml)
        const kmlEntry = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml'));
        if (!kmlEntry) throw new Error('No .kml inside the .kmz');
        kmlText = await kmlEntry.async('string');
      } else {
        kmlText = await file.text();
      }

      const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
      const geo = kmlToGeoJSON(dom);

      // Recursively collect all line segments and points from a geometry,
      // including those nested in MultiGeometry (-> GeometryCollection in togeojson).
      function collectLines(g, acc) {
        if (!g) return;
        if (g.type === 'LineString') acc.push(g.coordinates.map(c => [c[0], c[1]]));
        else if (g.type === 'MultiLineString') g.coordinates.forEach(l => acc.push(l.map(c => [c[0], c[1]])));
        // Polygons are area outlines (e.g. state boundaries), not roads — skip them.
        else if (g.type === 'GeometryCollection') (g.geometries || []).forEach(sub => collectLines(sub, acc));
      }
      function collectPoints(g, acc) {
        if (!g) return;
        if (g.type === 'Point') acc.push([g.coordinates[0], g.coordinates[1]]);
        else if (g.type === 'MultiPoint') g.coordinates.forEach(c => acc.push([c[0], c[1]]));
        else if (g.type === 'GeometryCollection') (g.geometries || []).forEach(sub => collectPoints(sub, acc));
      }

      // Merge all segments within one placemark into a SINGLE road feature
      // (stored as a MultiLineString-style nested array when there are several).
      const collected = [];
      let unnamed = 0;
      for (const f of geo.features || []) {
        const name = (f.properties?.name || '').trim() || `Imported ${++unnamed}`;
        const notes = (f.properties?.description || '').toString().replace(/<[^>]*>/g, '').trim().slice(0, 500) || null;
        const lines = []; collectLines(f.geometry, lines);
        const pts = []; collectPoints(f.geometry, pts);
        if (lines.length) {
          collected.push({ type: 'road', name, notes, coordinates: lines.length === 1 ? lines[0] : lines });
        }
        pts.forEach(p => collected.push({ type: 'extraction', name, notes, coordinates: p }));
      }

      // Optionally connect all imported single points (in file order) into one road.
      let toSave;
      if (joinPoints) {
        const pointCoords = collected.filter(c => c.type === 'extraction').map(c => c.coordinates);
        const realRoads = collected.filter(c => c.type === 'road');
        toSave = [...realRoads];
        if (pointCoords.length >= 2) {
          const baseName = file.name.replace(/\.(kmz|kml)$/i, '');
          toSave.push({ type: 'road', name: baseName || 'Imported road', notes: null, coordinates: pointCoords });
        }
      } else {
        toSave = collected;
      }

      if (!toSave.length) { flash('No roads or points found in that file.'); setImporting(false); return; }

      const color = colorForProject(selProject, projects);
      let ok = 0;
      for (const feat of toSave) {
        try {
          await api.post('/map', { project: selProject, color, ...feat });
          ok++;
        } catch { /* skip individual failures */ }
      }
      flash(`✓ Imported ${ok} feature${ok !== 1 ? 's' : ''} into ${selProject}.`);
      await load();

      // Fly to the first imported feature
      const first = toSave[0];
      const center = first.type === 'road' ? firstVertex(first.coordinates) : first.coordinates;
      mapRef.current?.flyTo({ center, zoom: 11, duration: 1500 });
    } catch (err) {
      console.error(err);
      flash('Could not read that file. Make sure it is a valid .kmz or .kml.');
    }
    setImporting(false);
  }

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
    const center = f.type === 'road' ? firstVertex(f.coordinates) : f.coordinates;
    map.flyTo({ center, zoom: 12, duration: 1500 });
  }

  // Group features by project for the sidebar list
  const byProject = projects.map(p => ({ project: p, items: features.filter(f => f.project === p && !isHidden(f)) }))
    .filter(g => g.items.length || true);

  // All real (non-junk) extraction sites, for the table
  const extractionRows = features.filter(f => f.type === 'extraction' && !isHidden(f));

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#FDF6E3]">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-amber-100 flex-shrink-0">
        <button onClick={() => setView('map')}
          className={`px-4 py-1.5 text-sm font-bold rounded-lg ${view === 'map' ? 'bg-[#1a3c5e] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
          🗺️ Map
        </button>
        <button onClick={() => setView('table')}
          className={`px-4 py-1.5 text-sm font-bold rounded-lg ${view === 'table' ? 'bg-[#1a3c5e] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
          📋 Extraction Sites{extractionRows.length ? ` (${extractionRows.length})` : ''}
        </button>
      </div>

      {/* ── Extraction table view ── */}
      <div className={`flex-1 overflow-auto p-6 ${view === 'table' ? 'block' : 'hidden'}`}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-black text-[#1a3c5e] mb-1">Extraction Sites</h2>
          <p className="text-sm text-slate-500 mb-4">{extractionRows.length} site{extractionRows.length !== 1 ? 's' : ''} · click 📍 to locate on the map, ✕ to delete</p>
          {extractionRows.length === 0 ? (
            <div className="bg-white border border-amber-100 rounded-2xl p-10 text-center text-slate-400">
              No extraction sites yet. Switch to the Map tab, click <b>📍 Extraction</b>, and place one.
            </div>
          ) : (
            <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left">
                    {['Site', 'Project', 'Category', 'Notes', 'Coordinates', 'Added', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {extractionRows.map(f => (
                    <tr key={f.id} className="hover:bg-amber-50/30">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorForFeature(f) }} />{f.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{f.project}</td>
                      <td className="px-4 py-3">{f.category
                        ? <span className="px-2 py-0.5 text-xs font-semibold bg-red-50 text-red-600 rounded-full">{f.category}</span>
                        : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[220px]">{f.notes || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{f.coordinates[1].toFixed(5)}, {f.coordinates[0].toFixed(5)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(f.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => { setView('map'); setTimeout(() => flyTo(f), 100); }}
                          className="px-2 py-1 text-xs font-semibold text-[#1a3c5e] hover:bg-blue-50 rounded mr-1" title="Locate on map">📍</button>
                        {canEdit && (
                          <button onClick={() => deleteFeature(f)}
                            className="px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 rounded" title="Delete">✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Map view (kept mounted; hidden when on table so MapLibre persists) ── */}
      <div className={`flex-1 min-h-0 ${view === 'map' ? 'flex' : 'hidden'}`}>
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
                <div className="space-y-2">
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
                  <input ref={fileInputRef} type="file" accept=".kmz,.kml" onChange={handleImportFile} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={importing}
                    className="w-full px-3 py-2 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                    {importing ? 'Importing…' : '🌍 Import KMZ / KML (Google Earth)'}
                  </button>
                  <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer bg-green-50 border border-green-100 rounded-lg px-2.5 py-2">
                    <input type="checkbox" checked={joinPoints} onChange={e => setJoinPoints(e.target.checked)} className="mt-0.5" />
                    <span><b>Connect points into one road.</b> Use this if your file is a series of pins along a route instead of a drawn path.</span>
                  </label>
                  <p className="text-[10px] text-slate-400 text-center">Imports into the active project above</p>
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
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                <span>3D terrain intensity</span><span>{exaggeration.toFixed(1)}×</span>
              </div>
              <input type="range" min="0" max="3" step="0.2" value={exaggeration}
                onChange={e => setExaggeration(Number(e.target.value))} className="w-full" />
            </div>
            {/* Road colour mode */}
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Colour roads by</p>
              <div className="flex gap-1">
                <button onClick={() => setColorMode('section')}
                  className={`flex-1 px-2 py-1 text-[10px] font-bold rounded-lg border ${colorMode === 'section' ? 'bg-[#1a3c5e] text-white border-[#1a3c5e]' : 'bg-white text-slate-500 border-slate-200'}`}>
                  Section
                </button>
                <button onClick={() => setColorMode('progress')}
                  className={`flex-1 px-2 py-1 text-[10px] font-bold rounded-lg border ${colorMode === 'progress' ? 'bg-[#1a3c5e] text-white border-[#1a3c5e]' : 'bg-white text-slate-500 border-slate-200'}`}>
                  Construction %
                </button>
              </div>
              {colorMode === 'progress' && (
                <div className="flex flex-wrap gap-1.5 mt-2 text-[9px]">
                  {[['<25%','#ef4444'],['25–49%','#f59e0b'],['50–79%','#84cc16'],['≥80%','#22c55e'],['no link','#9ca3af']].map(([l,c]) => (
                    <span key={l} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:c}} />{l}</span>
                  ))}
                </div>
              )}
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
                          <span className="w-3 h-3 rounded-full flex-shrink-0 mt-1 border border-white/40" style={{ background: featureColor(f) }} />
                          <div className="flex-1 min-w-0">
                            <button onClick={() => flyTo(f)} className="text-left w-full min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p>
                              {f.type === 'extraction' && f.category && <p className="text-[10px] text-red-500 truncate">{f.category}</p>}
                            </button>
                            {/* Construction link — roads only */}
                            {f.type === 'road' && (
                              <div className="mt-1 flex items-center gap-1.5">
                                {canEdit ? (
                                  <select value={linkedSection(f) || ''} onChange={e => setLink(f, e.target.value)}
                                    className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-white max-w-[150px]">
                                    <option value="">— link to section —</option>
                                    {sections.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                                  </select>
                                ) : linkedSection(f) && (
                                  <span className="text-[10px] text-slate-500">{linkedSection(f)}</span>
                                )}
                                {linkedSection(f) && sectionAvg(linkedSection(f)) != null && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                                    style={{ background: progressColor(sectionAvg(linkedSection(f))) }}>
                                    {sectionAvg(linkedSection(f))}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {canEdit && (
                            <button onClick={() => deleteFeature(f)}
                              className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs mt-1">✕</button>
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
    </div>
  );
}
