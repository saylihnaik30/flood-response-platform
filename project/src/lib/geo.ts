import type { Report, Resource } from './supabase';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface MatchResult {
  resource: Resource;
  distanceKm: number;
}

export function findNearestResource(
  report: Report,
  resources: Resource[]
): MatchResult | null {
  if (!report.lat || !report.lng) return null;

  const candidates = resources.filter(
    (r) =>
      r.available &&
      r.type === report.need_type &&
      r.lat != null &&
      r.lng != null
  );

  if (candidates.length === 0) return null;

  let best: MatchResult | null = null;

  for (const resource of candidates) {
    const dist = haversineKm(
      report.lat,
      report.lng,
      resource.lat!,
      resource.lng!
    );
    if (!best || dist < best.distanceKm) {
      best = { resource, distanceKm: dist };
    }
  }

  return best;
}

export function getResourceForReport(
  report: Report,
  resources: Resource[]
): Resource | null {
  if (!report.assigned_resource_id) return null;
  return resources.find((r) => r.id === report.assigned_resource_id) ?? null;
}
