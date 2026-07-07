'use client';

import { useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

type LatLng = { lat: number; lng: number };

type Props = {
  value: LatLng | null;
  onChange: (coords: LatLng) => void;
  /** Map fallback centre when no value is set (defaults to Dubai). */
  defaultCenter?: LatLng;
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const DUBAI: LatLng = { lat: 25.2048, lng: 55.2708 };

/** Load the Leaflet script/style once and resolve when `window.L` is ready. */
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if ((window as any).L) return Promise.resolve((window as any).L);

  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).L));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/**
 * Interactive map location picker built on Leaflet + OpenStreetMap (no API
 * key required). Click the map or drag the marker to set coordinates; a
 * search box geocodes an address via the free Nominatim endpoint.
 *
 * Swapping to Google Maps later only requires replacing this component —
 * the wizard contract is just `value` / `onChange` lat-lng.
 */
export function MapLocationPicker({ value, onChange, defaultCenter = DUBAI }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Initialise the map once.
  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const start = value ?? defaultCenter;
        const map = L.map(containerRef.current).setView([start.lat, start.lng], value ? 15 : 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);

        marker.on('dragend', () => {
          const p = marker.getLatLng();
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        });
        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        mapRef.current = map;
        markerRef.current = marker;
        setReady(true);

        // Leaflet needs a size recalculation once the container is laid out.
        setTimeout(() => map.invalidateSize(), 0);
      })
      .catch(() => setError('Map failed to load. You can still type your address above.'));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync when the value changes from the outside.
  useEffect(() => {
    if (!ready || !value || !markerRef.current || !mapRef.current) return;
    markerRef.current.setLatLng([value.lat, value.lng]);
  }, [ready, value]);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      );
      const results = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (results.length === 0) {
        setError('No matching location found.');
        return;
      }
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      onChangeRef.current({ lat, lng });
      if (mapRef.current) mapRef.current.setView([lat, lng], 15);
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSearch();
            }
          }}
          placeholder="Search for your store address…"
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={searching}
          className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
        style={{ minHeight: '18rem' }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">
          Click the map or drag the pin to set your exact store location.
        </span>
        {value && (
          <span className="font-medium text-slate-700">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        )}
      </div>

      {error && <p className="text-xs font-medium text-amber-600">{error}</p>}
    </div>
  );
}
