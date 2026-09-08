import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  CloudRain,
  Flame,
  HelpCircle,
  Link2,
  MapPin,
  RefreshCw,
  Sparkles,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  supabase,
  type Report,
  type Resource,
  type UrgencyLevel,
  type CredibilityLevel,
  type NeedType,
} from '@/lib/supabase';
import { NEED_TYPE_MAP } from '@/lib/constants';
import { findNearestResource, getResourceForReport } from '@/lib/geo';
import LiveMap from '@/components/LiveMap';

const NEED_TYPE_COLORS: Record<string, string> = {
  rescue: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medical: 'bg-red-500/20 text-red-300 border-red-500/30',
  shelter: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  food: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const NEED_TYPE_ICON_BG: Record<string, string> = {
  rescue: 'bg-orange-500',
  medical: 'bg-red-500',
  shelter: 'bg-blue-500',
  food: 'bg-green-500',
};

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; badge: string; dot: string }> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    dot: 'bg-red-500',
  },
  high: {
    label: 'High',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    dot: 'bg-orange-500',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    dot: 'bg-yellow-500',
  },
  low: {
    label: 'Low',
    badge: 'bg-green-500/20 text-green-300 border-green-500/40',
    dot: 'bg-green-500',
  },
};

const URGENCY_ORDER: Record<UrgencyLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const CREDIBILITY_CONFIG: Record<CredibilityLevel, { icon: LucideIcon; label: string; color: string; order: number }> = {
  high: { icon: CheckCircle2, label: 'High credibility', color: 'text-green-400', order: 0 },
  medium: { icon: HelpCircle, label: 'Medium credibility', color: 'text-yellow-400', order: 1 },
  low: { icon: AlertCircle, label: 'Low credibility', color: 'text-red-400', order: 2 },
};

type FilterType = 'all' | NeedType;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'rescue', label: 'Rescue' },
  { value: 'medical', label: 'Medical' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'food', label: 'Food' },
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CREDIBILITY_ORDER: Record<CredibilityLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortReports(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => {
    // Assigned reports always sort after unassigned
    const aAssigned = a.status === 'assigned' || !!a.assigned_resource_id;
    const bAssigned = b.status === 'assigned' || !!b.assigned_resource_id;
    if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;

    // Primary: urgency (critical first)
    const aUrgency = a.urgency ? URGENCY_ORDER[a.urgency] : 99;
    const bUrgency = b.urgency ? URGENCY_ORDER[b.urgency] : 99;
    if (aUrgency !== bUrgency) return aUrgency - bUrgency;

    // Tie-breaker 1: credibility (high credibility first)
    const aCred = a.credibility ? CREDIBILITY_ORDER[a.credibility] : 99;
    const bCred = b.credibility ? CREDIBILITY_ORDER[b.credibility] : 99;
    if (aCred !== bCred) return aCred - bCred;

    // Tie-breaker 2: most recent first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<Record<string, string>>({});

  const fetchReports = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Failed to load reports. Please try again.');
      return;
    }
    setReports(sortReports((data as Report[]) ?? []));
  }, []);

  const fetchResources = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .order('name');

    if (fetchError) {
      return;
    }
    setResources((data as Resource[]) ?? []);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchReports(), fetchResources()]);
    setLoading(false);
  }, [fetchReports, fetchResources]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('reports-resources-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          fetchReports();
          fetchResources();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        () => fetchResources()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll, fetchReports, fetchResources]);

  // Filter reports
  const filteredReports = useMemo(() => {
    if (filter === 'all') return reports;
    return reports.filter((r) => r.need_type === filter);
  }, [reports, filter]);

  // Split into active emergencies and assigned reports
  const activeReports = useMemo(
    () => filteredReports.filter((r) => r.status !== 'assigned' && !r.assigned_resource_id),
    [filteredReports]
  );
  const assignedReports = useMemo(
    () => filteredReports.filter((r) => r.status === 'assigned' || r.assigned_resource_id),
    [filteredReports]
  );

  // Filter resources for map display (all resources always show, but filter
  // affects which are emphasized). Actually per spec the filter affects report
  // markers on the map. Resources stay visible as context.
  const mapReports = filteredReports;

  // Compute match line for selected report
  const matchLine = useMemo(() => {
    if (!selectedReportId) return null;
    const report = reports.find((r) => r.id === selectedReportId);
    if (!report || !report.lat || !report.lng) return null;

    const assignedResource = getResourceForReport(report, resources);
    if (assignedResource?.lat && assignedResource?.lng) {
      return {
        fromLat: report.lat,
        fromLng: report.lng,
        toLat: assignedResource.lat,
        toLng: assignedResource.lng,
      };
    }

    // If not assigned but eligible for matching, show line to suggested
    if (
      report.urgency === 'critical' ||
      report.urgency === 'high'
    ) {
      const match = findNearestResource(report, resources);
      if (match?.resource.lat && match?.resource.lng) {
        return {
          fromLat: report.lat,
          fromLng: report.lng,
          toLat: match.resource.lat,
          toLng: match.resource.lng,
        };
      }
    }

    return null;
  }, [selectedReportId, reports, resources]);

  const handleAssign = async (report: Report, resourceId: string) => {
    setAssigningId(report.id);
    setAssignError((prev) => {
      const next = { ...prev };
      delete next[report.id];
      return next;
    });

    // Guard: don't assign if already assigned
    if (report.status === 'assigned' || report.assigned_resource_id) {
      setAssignError((prev) => ({
        ...prev,
        [report.id]: 'This report is already assigned.',
      }));
      setAssigningId(null);
      return;
    }

    // Guard: verify the resource is still available before claiming it.
    // Using .eq('available', true) prevents race conditions — if another
    // assignment already took it, this update affects 0 rows.
    const { data: updatedRows, error: resourceErr } = await supabase
      .from('resources')
      .update({ available: false })
      .eq('id', resourceId)
      .eq('available', true)
      .select('id');

    if (resourceErr) {
      setAssignError((prev) => ({
        ...prev,
        [report.id]: `Database error: ${resourceErr.message}`,
      }));
      setAssigningId(null);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      setAssignError((prev) => ({
        ...prev,
        [report.id]: 'This resource is no longer available.',
      }));
      setAssigningId(null);
      return;
    }

    // Resource successfully claimed — now update the report
    const { error: reportErr } = await supabase
      .from('reports')
      .update({
        status: 'assigned',
        assigned_resource_id: resourceId,
      })
      .eq('id', report.id)
      .is('assigned_resource_id', null);

    if (reportErr) {
      // Attempt to roll back the resource availability
      await supabase
        .from('resources')
        .update({ available: true })
        .eq('id', resourceId);
      setAssignError((prev) => ({
        ...prev,
        [report.id]: `Database error: ${reportErr.message}`,
      }));
      setAssigningId(null);
      return;
    }

    // Optimistic UI update: immediately reflect the assignment locally
    // so the card grays out without waiting for realtime.
    setResources((prev) =>
      prev.map((r) =>
        r.id === resourceId ? { ...r, available: false } : r
      )
    );
    setReports((prev) =>
      sortReports(
        prev.map((r) =>
          r.id === report.id
            ? { ...r, status: 'assigned', assigned_resource_id: resourceId }
            : r
        )
      )
    );
    setAssigningId(null);
  };

  // ── Report card renderer ──────────────────────────────────────────────
  // Extracted so both Active Emergencies and Assigned sections can use it.
  const renderReportCard = (props: {
    report: Report;
    resources: Resource[];
    selectedReportId: string | null;
    assigningId: string | null;
    assignError: Record<string, string>;
    onSelect: (id: string | null) => void;
    onAssign: (report: Report, resourceId: string) => void;
    showPriorityRank: boolean;
    rank: number;
  }): React.ReactNode => {
    const {
      report,
      resources: resList,
      selectedReportId: selId,
      assigningId: assignId,
      assignError: assignErr,
      onSelect,
      onAssign,
      showPriorityRank,
      rank,
    } = props;

    const ntCfg = NEED_TYPE_MAP[report.need_type];
    const Icon: LucideIcon = ntCfg?.icon ?? AlertCircle;
    const colorClass =
      NEED_TYPE_COLORS[report.need_type] ??
      'bg-slate-500/20 text-slate-300 border-slate-500/30';
    const iconBg =
      NEED_TYPE_ICON_BG[report.need_type] ?? 'bg-slate-500';

    const urgencyCfg = report.urgency ? URGENCY_CONFIG[report.urgency] : null;
    const credibilityCfg = report.credibility ? CREDIBILITY_CONFIG[report.credibility] : null;
    const CredibilityIcon = credibilityCfg?.icon;

    const isAssigned = report.status === 'assigned' || !!report.assigned_resource_id;
    const assignedResource = getResourceForReport(report, resList);
    const isCriticalOrHigh =
      report.urgency === 'critical' || report.urgency === 'high';
    const isCritical = report.urgency === 'critical';
    const suggestedMatch = !isAssigned && isCriticalOrHigh
      ? findNearestResource(report, resList)
      : null;
    const hasMatch = !!suggestedMatch;
    const isSelected = report.id === selId;
    const isAssigning = assignId === report.id;

    // Visual emphasis for critical unassigned reports
    const cardBorder = isCritical && !isAssigned
      ? 'border-red-500/40 ring-1 ring-red-500/20'
      : isAssigned
        ? 'border-slate-800'
        : isSelected
          ? 'border-sky-500 ring-1 ring-sky-500/50'
          : 'border-slate-800 hover:border-slate-700';

    return (
      <div
        key={report.id}
        onClick={() => onSelect(isSelected ? null : report.id)}
        className={`bg-slate-900 rounded-2xl p-5 border transition-all cursor-pointer ${cardBorder}`}
      >
        <div className="flex items-start gap-4">
          {/* Priority rank badge for active emergencies */}
          {showPriorityRank && (
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm tabular-nums ${
                isCritical
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : rank <= 3
                    ? 'bg-slate-800 text-slate-300 border border-slate-700'
                    : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
              }`}
            >
              {rank}
            </div>
          )}

          {/* Need type icon */}
          <div
            className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 ${isCritical && !isAssigned ? 'shadow-lg shadow-red-500/20' : ''}`}
          >
            <Icon className="w-6 h-6 text-white" strokeWidth={2} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Top row: emergency type + time + critical flame */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${colorClass}`}
              >
                {ntCfg?.label ?? report.need_type}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {timeAgo(report.created_at)}
              </span>
              {isCritical && !isAssigned && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                  <Flame className="w-3 h-3" />
                  Critical
                </span>
              )}
              {isAssigned && (
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Assigned
                </span>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-1.5">
              <MapPin className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span className="truncate">{report.location}</span>
            </div>

            {/* Description */}
            <p className="text-slate-400 text-sm leading-relaxed mb-3 line-clamp-2">
              {report.description}
            </p>

            {/* AI reasoning */}
            {report.reasoning && (
              <div className="flex items-start gap-1.5 mb-3 text-xs text-slate-500 italic bg-slate-800/50 rounded-lg px-3 py-2">
                <Sparkles className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{report.reasoning}</span>
              </div>
            )}

            {/* Resource matching section */}
            {isAssigned && assignedResource && (
              <div className="flex items-center gap-2 mb-3 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="text-sm text-sky-300 font-medium">
                  Assigned to {assignedResource.name}
                </span>
                <Link2 className="w-3.5 h-3.5 text-sky-500 ml-auto flex-shrink-0" />
              </div>
            )}

            {isAssigned && !assignedResource && (
              <div className="flex items-center gap-2 mb-3 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="text-sm text-sky-300 font-medium">
                  Assigned
                </span>
              </div>
            )}

            {!isAssigned && isCriticalOrHigh && suggestedMatch && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 flex-1 min-w-0">
                  <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">
                    Suggested match: <span className="font-semibold text-slate-100">{suggestedMatch.resource.name}</span>
                    <span className="text-slate-400"> — {suggestedMatch.distanceKm.toFixed(1)} km away</span>
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(report, suggestedMatch.resource.id);
                  }}
                  disabled={isAssigning}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  {isAssigning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Assign'
                  )}
                </button>
              </div>
            )}

            {!isAssigned && isCriticalOrHigh && !suggestedMatch && (
              <div className="flex items-center gap-2 mb-3 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
                <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-400">
                  No available matching resource
                </span>
              </div>
            )}

            {/* Assignment error */}
            {assignErr[report.id] && (
              <div className="flex items-center gap-2 mb-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-300">
                  {assignErr[report.id]}
                </span>
              </div>
            )}

            {/* Bottom row: urgency + credibility + resource availability + photo */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Urgency badge */}
              {urgencyCfg ? (
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${urgencyCfg.badge}`}
                >
                  <span className={`w-2 h-2 rounded-full ${urgencyCfg.dot}`} />
                  {urgencyCfg.label}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Not yet scored
                </span>
              )}

              {/* Credibility indicator */}
              {CredibilityIcon && credibilityCfg && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${credibilityCfg.color}`}
                  title={credibilityCfg.label}
                >
                  <CredibilityIcon className="w-4 h-4" />
                  {credibilityCfg.label.replace(' credibility', '')}
                </span>
              )}

              {/* Resource availability indicator (only for unassigned critical/high) */}
              {!isAssigned && isCriticalOrHigh && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                    hasMatch
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {hasMatch ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {hasMatch ? 'Resource available' : 'No resource'}
                </span>
              )}

              {/* Photo thumbnail */}
              {report.photo_url && (
                <a
                  href={report.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto"
                >
                  <img
                    src={report.photo_url}
                    alt="Report"
                    className="w-14 h-14 rounded-lg object-cover border border-slate-700 hover:border-slate-500 transition-colors"
                  />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center">
              <CloudRain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">
                FloodPulse — Live Dashboard
              </h1>
              <p className="text-xs text-slate-400">Disaster Response Coordination</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl">
              <Activity className="w-5 h-5 text-sky-400" />
              <div className="leading-tight">
                <span className="text-2xl font-bold tabular-nums">
                  {filteredReports.length}
                </span>
                <span className="text-xs text-slate-400 ml-1.5">
                  {filteredReports.length === 1 ? 'report' : 'reports'}
                </span>
              </div>
            </div>
            <button
              onClick={fetchAll}
              disabled={loading}
              className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center transition-colors"
              title="Refresh"
            >
              <RefreshCw
                className={`w-5 h-5 text-slate-300 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <Link
              to="/report"
              className="text-sm font-medium text-sky-400 hover:text-sky-300"
            >
              Report Page
            </Link>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="bg-slate-900/60 border-b border-slate-800 sticky top-[73px] z-10">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-3">
          <span className="text-sm text-slate-400 font-medium">Filter:</span>
          <div className="flex items-center gap-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === opt.value
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-5 py-6 grid lg:grid-cols-3 gap-6">
        {/* Reports list — takes 2/3 */}
        <div className="lg:col-span-2">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-300 flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!error && loading && reports.length === 0 && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-slate-900 rounded-2xl p-5 animate-pulse border border-slate-800"
                >
                  <div className="h-4 bg-slate-800 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-slate-800 rounded w-full mb-2" />
                  <div className="h-3 bg-slate-800 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {!error && !loading && filteredReports.length === 0 && (
            <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No reports{filter !== 'all' ? ` for ${filter}` : ''}</p>
              <p className="text-slate-600 text-sm mt-1">
                {filter !== 'all'
                  ? 'Try a different filter to see more reports.'
                  : 'Reports from citizens will appear here in real time.'}
              </p>
            </div>
          )}

          {!error && !loading && filteredReports.length > 0 && (
            <div className="space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
              {/* Active Emergencies section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-200">
                      Active Emergencies
                    </h2>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 tabular-nums">
                      {activeReports.length}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Priority queue
                  </span>
                </div>

                {activeReports.length === 0 ? (
                  <div className="bg-slate-900 rounded-2xl p-8 text-center border border-slate-800">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-slate-400 font-medium">No active emergencies</p>
                    <p className="text-slate-600 text-sm mt-1">All reports have been assigned.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeReports.map((report, index) => {
                      const card = renderReportCard({
                        report,
                        resources,
                        selectedReportId,
                        assigningId,
                        assignError,
                        onSelect: setSelectedReportId,
                        onAssign: handleAssign,
                        showPriorityRank: true,
                        rank: index + 1,
                      });
                      return card;
                    })}
                  </div>
                )}
              </div>

              {/* Assigned Reports section */}
              {assignedReports.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 pt-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-400">
                        Assigned Reports
                      </h2>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 tabular-nums">
                        {assignedReports.length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 opacity-60">
                    {assignedReports.map((report) =>
                      renderReportCard({
                        report,
                        resources,
                        selectedReportId,
                        assigningId,
                        assignError,
                        onSelect: setSelectedReportId,
                        onAssign: handleAssign,
                        showPriorityRank: false,
                        rank: 0,
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map — takes 1/3 */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Map View</h2>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 h-[400px] lg:h-[calc(100vh-220px)] overflow-hidden relative">
            <LiveMap
              reports={mapReports}
              resources={resources}
              selectedReportId={selectedReportId}
              onSelectReport={setSelectedReportId}
              matchLine={matchLine}
            />
            {/* Map legend */}
            <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl p-3 z-[1000] pointer-events-none">
              <div className="text-xs font-semibold text-slate-300 mb-2">Legend</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 border border-white" />
                  <span className="text-xs text-slate-400">Critical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500 border border-white" />
                  <span className="text-xs text-slate-400">High</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white" />
                  <span className="text-xs text-slate-400">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 border border-white" />
                  <span className="text-xs text-slate-400">Low</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-700 mt-1">
                  <div className="w-3 h-3 bg-cyan-500 border border-white rotate-45" />
                  <span className="text-xs text-slate-400">Resource</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
