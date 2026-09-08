import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Report, Resource } from '@/lib/supabase';
import type { UrgencyLevel } from '@/lib/supabase';

const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const RESOURCE_COLOR = '#06b6d4';

function createReportMarker(color: string, highlighted: boolean): L.DivIcon {
  const size = highlighted ? 18 : 14;
  const ring = highlighted
    ? '<div class="report-marker-ring"></div>'
    : '';
  return L.divIcon({
    className: 'report-marker',
    html: `${ring}<div style="
      width:${size}px;height:${size}px;background:${color};
      border:2px solid white;border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.5);
      ${highlighted ? 'transform:scale(1.15);' : ''}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createResourceIcon(highlighted: boolean): L.DivIcon {
  const size = highlighted ? 36 : 30;
  return L.divIcon({
    className: 'resource-marker',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${RESOURCE_COLOR};
      border:2px solid white;border-radius:6px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      transform:rotate(45deg);
      ${highlighted ? 'transform:rotate(45deg) scale(1.15);' : ''}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface LiveMapProps {
  reports: Report[];
  resources: Resource[];
  selectedReportId: string | null;
  onSelectReport: (id: string) => void;
  matchLine: {
    fromLat: number;
    fromLng: number;
    toLat: number;
    toLng: number;
  } | null;
}

export default function LiveMap({
  reports,
  resources,
  selectedReportId,
  onSelectReport,
  matchLine,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const reportMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const resourceMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const lineRef = useRef<L.Polyline | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [18.5204, 73.8567],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Fix size after mount
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update report markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = reportMarkersRef.current;
    const currentIds = new Set(reports.map((r) => r.id));

    // Remove stale markers
    for (const [id, marker] of existing) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        existing.delete(id);
      }
    }

    // Add or update markers
    for (const report of reports) {
      if (!report.lat || !report.lng) continue;
      const color = report.urgency
        ? URGENCY_COLORS[report.urgency]
        : '#64748b';
      const highlighted = report.id === selectedReportId;
      const icon = createReportMarker(color, highlighted);

      const existingMarker = existing.get(report.id);
      if (existingMarker) {
        existingMarker.setIcon(icon);
        existingMarker.setLatLng([report.lat, report.lng]);
      } else {
        const marker = L.marker([report.lat, report.lng], { icon }).addTo(map);
        marker.on('click', () => onSelectReport(report.id));
        marker.bindPopup(
          `<div style="font-family:sans-serif;min-width:180px;">
            <div style="font-weight:700;color:#1e293b;margin-bottom:4px;text-transform:capitalize;">${report.need_type}</div>
            <div style="font-size:12px;color:#475569;margin-bottom:4px;">${report.location}</div>
            <div style="font-size:11px;color:#64748b;">${report.description.slice(0, 120)}${report.description.length > 120 ? '…' : ''}</div>
            ${report.urgency ? `<div style="margin-top:6px;font-size:11px;font-weight:600;color:${color};">Urgency: ${report.urgency}</div>` : ''}
            <div style="margin-top:4px;font-size:11px;color:#94a3b8;">Status: ${report.status}</div>
          </div>`
        );
        existing.set(report.id, marker);
      }
    }
  }, [reports, selectedReportId, onSelectReport]);

  // Update resource markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = resourceMarkersRef.current;
    const currentIds = new Set(resources.map((r) => r.id));

    for (const [id, marker] of existing) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        existing.delete(id);
      }
    }

    for (const resource of resources) {
      if (!resource.lat || !resource.lng) continue;
      const highlighted =
        selectedReportId != null &&
        reports.find((r) => r.id === selectedReportId)?.assigned_resource_id ===
          resource.id;
      const icon = createResourceIcon(highlighted);

      const existingMarker = existing.get(resource.id);
      if (existingMarker) {
        existingMarker.setIcon(icon);
        existingMarker.setLatLng([resource.lat, resource.lng]);
      } else {
        const marker = L.marker([resource.lat, resource.lng], { icon }).addTo(map);
        marker.bindPopup(
          `<div style="font-family:sans-serif;min-width:160px;">
            <div style="font-weight:700;color:#0e7490;margin-bottom:2px;">${resource.name}</div>
            <div style="font-size:12px;color:#475569;text-transform:capitalize;">Type: ${resource.type}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${resource.location}</div>
            <div style="margin-top:4px;font-size:11px;font-weight:600;color:${resource.available ? '#16a34a' : '#dc2626'};">
              ${resource.available ? 'Available' : 'Unavailable'}
            </div>
          </div>`
        );
        existing.set(resource.id, marker);
      }
    }
  }, [resources, selectedReportId, reports]);

  // Draw/remove match line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }

    if (matchLine) {
      lineRef.current = L.polyline(
        [
          [matchLine.fromLat, matchLine.fromLng],
          [matchLine.toLat, matchLine.toLng],
        ],
        {
          color: '#38bdf8',
          weight: 3,
          opacity: 0.7,
          dashArray: '8 6',
        }
      ).addTo(map);
    }
  }, [matchLine]);

  // Pan to selected report
  useEffect(() => {
    if (!selectedReportId || !mapRef.current) return;
    const report = reports.find((r) => r.id === selectedReportId);
    if (report?.lat && report?.lng) {
      mapRef.current.panTo([report.lat, report.lng], { animate: true });
    }
  }, [selectedReportId, reports]);

  return <div ref={containerRef} className="w-full h-full" />;
}
