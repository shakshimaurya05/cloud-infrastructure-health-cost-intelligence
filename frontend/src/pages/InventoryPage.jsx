import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Server, HardDrive, Globe, Search, RefreshCw, ChevronLeft, ChevronRight,
  Lock, Unlock, Tag, Clock, X, AlertTriangle, Wifi, WifiOff, Shield,
  Database, MapPin, Cpu, Key, Monitor
} from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorAlert from '../components/common/ErrorAlert';
import EmptyState from '../components/common/EmptyState';
import {
  fetchInventoryInstances,
  fetchInventoryVolumes,
  fetchInventoryElasticIps
} from '../api/client';

const PAGE_SIZE = 10;

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatBytes(gb) {
  if (gb == null) return '—';
  return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb} GiB`;
}

function LastRefreshed({ ts }) {
  if (!ts) return null;
  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-400">
      <Clock className="w-3 h-3" />
      Refreshed {formatDate(ts)}
    </span>
  );
}

function Pagination({ page, totalPages, total, pageSize, onChange }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60">
      <span className="text-xs text-slate-500">
        Showing <strong className="text-slate-800">{start}–{end}</strong> of <strong className="text-slate-800">{total}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-7 h-7 rounded-md text-xs font-semibold transition-colors ${
                p === page ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Tab nav pills ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'instances',   label: 'EC2 Instances',  icon: Server    },
  { id: 'volumes',     label: 'EBS Volumes',    icon: HardDrive },
  { id: 'elastic-ips', label: 'Elastic IPs',   icon: Globe     },
];

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ item, type, onClose }) {
  if (!item) return null;

  const rows = useMemo(() => {
    if (type === 'instances') return [
      ['Instance ID',        item.instanceId,                       'mono'],
      ['Name',               item.name],
      ['State',              <StatusBadge key="s" type="instanceState" value={item.state} />],
      ['Instance Type',      item.instanceType,                     'mono'],
      ['Region',             item.region],
      ['Availability Zone',  item.availabilityZone],
      ['Launch Time',        formatDate(item.launchTime)],
      ['Public IP',          item.publicIp  || '—',                'mono'],
      ['Private IP',         item.privateIp || '—',                'mono'],
      ['Platform',           item.platform  || '—'],
      ['VPC ID',             item.vpcId     || '—',                'mono'],
      ['Subnet ID',          item.subnetId  || '—',                'mono'],
      ['AMI ID',             item.imageId   || '—',                'mono'],
      ['Key Pair',           item.keyName   || '—'],
      ['Monitoring',         item.monitoring || '—'],
    ];
    if (type === 'volumes') return [
      ['Volume ID',          item.volumeId,                         'mono'],
      ['Name',               item.name],
      ['State',              <StatusBadge key="s" type="volumeState" value={item.state} />],
      ['Type',               item.volumeType,                       'mono'],
      ['Size',               formatBytes(item.size)],
      ['Availability Zone',  item.availabilityZone],
      ['Encrypted',          item.encrypted ? '✅ Yes' : '❌ No'],
      ['IOPS',               item.iops ?? '—'],
      ['Throughput',         item.throughput ? `${item.throughput} MiB/s` : '—'],
      ['Attached Instance',  item.attachedInstanceId || '—',       'mono'],
      ['Device',             item.attachmentDevice   || '—',       'mono'],
      ['Attach State',       item.attachmentState    || '—'],
      ['Delete on Term',     item.deleteOnTermination == null ? '—' : item.deleteOnTermination ? 'Yes' : 'No'],
      ['Snapshot ID',        item.snapshotId || '—',               'mono'],
      ['Created',            formatDate(item.createTime)],
    ];
    // elastic-ips
    return [
      ['Allocation ID',      item.allocationId,                     'mono'],
      ['Name',               item.name],
      ['Public IP',          item.publicIp,                         'mono'],
      ['Association',        <StatusBadge key="a" type="eipAssociation" value={item.associated} />],
      ['Association ID',     item.associationId || '—',             'mono'],
      ['Instance ID',        item.associatedInstanceId || '—',      'mono'],
      ['Network Interface',  item.associatedNetworkInterfaceId || '—', 'mono'],
      ['Private IP',         item.privateIpAddress || '—',          'mono'],
      ['Domain',             item.domain],
      ['IP Pool',            item.publicIpv4Pool || '—'],
      ['Network Border',     item.networkBorderGroup || '—'],
    ];
  }, [item, type]);

  const tags = item.tags || {};
  const hasTag = Object.keys(tags).length > 0;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Resource detail"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {item.name || item.publicIp || item.volumeId}
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {item.instanceId || item.volumeId || item.allocationId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close detail panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {rows.map(([label, val, style]) => (
              <div key={label} className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">{label}</span>
                {React.isValidElement(val)
                  ? val
                  : <span className={`text-xs font-semibold text-slate-800 break-all ${style === 'mono' ? 'font-mono' : ''}`}>{val}</span>
                }
              </div>
            ))}
          </div>

          {/* Tags */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-500" /> Resource Tags
            </h4>
            {hasTag ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(tags).map(([k, v]) => (
                  <span key={k} className="px-2 py-1 rounded bg-slate-100 text-[11px] font-mono text-slate-700">
                    <strong className="text-slate-900">{k}:</strong> {v}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">No tags configured</span>
            )}
          </div>
        </div>

        <div className="p-5 pt-0">
          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Instances Tab ────────────────────────────────────────────────────────────

function InstancesTab({ refreshSignal }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [data, setData]       = useState({ instances: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [search, setSearch]         = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        search: opts.search ?? search,
        state: (opts.stateFilter ?? stateFilter) === 'all' ? '' : (opts.stateFilter ?? stateFilter),
        page:  opts.page ?? page,
        pageSize: PAGE_SIZE
      };
      const res = await fetchInventoryInstances(params);
      setData(res.data);
      setLastRefreshed(res.data?.lastRefreshed || new Date().toISOString());
    } catch (err) {
      setError(err.message || 'Failed to load EC2 inventory.');
    } finally {
      setLoading(false);
    }
  }, [search, stateFilter, page]);

  useEffect(() => { setPage(1); load({ page: 1 }); }, [refreshSignal]);

  const handleSearch = (v) => { setSearch(v); setPage(1); load({ search: v, page: 1 }); };
  const handleState  = (v) => { setStateFilter(v); setPage(1); load({ stateFilter: v, page: 1 }); };
  const handlePage   = (p) => { setPage(p); load({ page: p }); };

  const instances = data.instances || [];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full md:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            id="inv-instances-search"
            type="text"
            placeholder="ID, name, type, AZ, IP…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        {/* State filter */}
        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
          {['all', 'running', 'stopped', 'terminated'].map((s) => (
            <button
              key={s}
              id={`inv-state-${s}`}
              onClick={() => handleState(s)}
              className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                stateFilter === s ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <LastRefreshed ts={lastRefreshed} />
          <span className="text-xs text-slate-500">
            <strong className="text-slate-800">{data.total}</strong> total
          </span>
          <button
            id="inv-instances-refresh"
            onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => load()} />}

      {loading ? (
        <LoadingSpinner message="Scanning EC2 instance inventory…" />
      ) : instances.length === 0 ? (
        <EmptyState
          title="No instances found"
          description="Try adjusting your filters or search keywords."
          icon={Server}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Instance</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Region / AZ</th>
                  <th className="py-3.5 px-4">Launch Time</th>
                  <th className="py-3.5 px-4">IPs</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {instances.map((inst) => (
                  <tr key={inst.instanceId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-900">{inst.name}</div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">{inst.instanceId}</div>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge type="instanceState" value={inst.state} />
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {inst.instanceType}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1 text-slate-700 font-medium">
                        <MapPin className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        {inst.region}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 ml-4">{inst.availabilityZone}</div>
                    </td>
                    <td className="py-4 px-4 text-slate-500">{formatDate(inst.launchTime)}</td>
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                      {inst.privateIp && <div>Priv: {inst.privateIp}</div>}
                      {inst.publicIp  && <div className="text-slate-400">Pub: {inst.publicIp}</div>}
                      {!inst.privateIp && !inst.publicIp && <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        id={`inst-detail-${inst.instanceId}`}
                        onClick={() => setSelected(inst)}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page} totalPages={data.totalPages}
            total={data.total} pageSize={data.pageSize}
            onChange={handlePage}
          />
        </div>
      )}

      {selected && (
        <DetailModal item={selected} type="instances" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Volumes Tab ──────────────────────────────────────────────────────────────

function VolumesTab({ refreshSignal }) {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [data, setData]         = useState({ volumes: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [search, setSearch]         = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [encFilter, setEncFilter]     = useState('all');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        search:     opts.search     ?? search,
        state:      (opts.stateFilter ?? stateFilter) === 'all' ? '' : (opts.stateFilter ?? stateFilter),
        volumeType: (opts.typeFilter  ?? typeFilter) === 'all' ? '' : (opts.typeFilter ?? typeFilter),
        encrypted:  (opts.encFilter   ?? encFilter) === 'all' ? undefined : (opts.encFilter ?? encFilter) === 'encrypted',
        page:       opts.page ?? page,
        pageSize:   PAGE_SIZE
      };
      const res = await fetchInventoryVolumes(params);
      setData(res.data);
      setLastRefreshed(res.data?.lastRefreshed || new Date().toISOString());
    } catch (err) {
      setError(err.message || 'Failed to load EBS volume inventory.');
    } finally {
      setLoading(false);
    }
  }, [search, stateFilter, typeFilter, encFilter, page]);

  useEffect(() => { setPage(1); load({ page: 1 }); }, [refreshSignal]);

  const handleSearch = (v) => { setSearch(v); setPage(1); load({ search: v, page: 1 }); };
  const handleState  = (v) => { setStateFilter(v); setPage(1); load({ stateFilter: v, page: 1 }); };
  const handleType   = (v) => { setTypeFilter(v); setPage(1); load({ typeFilter: v, page: 1 }); };
  const handleEnc    = (v) => { setEncFilter(v); setPage(1); load({ encFilter: v, page: 1 }); };
  const handlePage   = (p) => { setPage(p); load({ page: p }); };

  const volumes = data.volumes || [];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            id="inv-volumes-search"
            type="text"
            placeholder="Volume ID, name, instance…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* State filter */}
        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
          {['all', 'in-use', 'available'].map((s) => (
            <button key={s} id={`vol-state-${s}`} onClick={() => handleState(s)}
              className={`px-3 py-1.5 rounded-md capitalize transition-all ${stateFilter === s ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
            >{s}</button>
          ))}
        </div>

        {/* Type filter */}
        <select
          id="vol-type-filter"
          value={typeFilter}
          onChange={(e) => handleType(e.target.value)}
          className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 text-slate-700"
        >
          <option value="all">All Types</option>
          {['gp2','gp3','io1','io2','st1','sc1'].map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>

        {/* Encryption filter */}
        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
          {[['all','All'],['encrypted','🔒 Encrypted'],['unencrypted','🔓 Unencrypted']].map(([v,l]) => (
            <button key={v} id={`vol-enc-${v}`} onClick={() => handleEnc(v)}
              className={`px-3 py-1.5 rounded-md transition-all ${encFilter === v ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
            >{l}</button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <LastRefreshed ts={lastRefreshed} />
          <span className="text-xs text-slate-500"><strong className="text-slate-800">{data.total}</strong> total</span>
          <button id="inv-volumes-refresh" onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => load()} />}

      {loading ? (
        <LoadingSpinner message="Scanning EBS volume inventory…" />
      ) : volumes.length === 0 ? (
        <EmptyState title="No volumes found" description="Try adjusting your filters." icon={HardDrive} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Volume</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4">Size / Type</th>
                  <th className="py-3.5 px-4">Availability Zone</th>
                  <th className="py-3.5 px-4">Encrypted</th>
                  <th className="py-3.5 px-4">Attached To</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {volumes.map((vol) => (
                  <tr key={vol.volumeId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-900">{vol.name}</div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">{vol.volumeId}</div>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge type="volumeState" value={vol.state} />
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{formatBytes(vol.size)}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">{vol.volumeType?.toUpperCase()}</span>
                        {vol.iops && <span className="text-[10px] text-slate-400">{vol.iops} IOPS</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-medium">{vol.availabilityZone}</td>
                    <td className="py-4 px-4">
                      {vol.encrypted
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700"><Lock className="w-3.5 h-3.5" /> Encrypted</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"><Unlock className="w-3.5 h-3.5" /> Unencrypted</span>
                      }
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px]">
                      {vol.attachedInstanceId
                        ? <div>
                            <div className="text-slate-700">{vol.attachedInstanceId}</div>
                            {vol.attachmentDevice && <div className="text-slate-400">{vol.attachmentDevice}</div>}
                          </div>
                        : <span className="text-slate-400 italic">Unattached</span>
                      }
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        id={`vol-detail-${vol.volumeId}`}
                        onClick={() => setSelected(vol)}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                      >Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page} totalPages={data.totalPages}
            total={data.total} pageSize={data.pageSize}
            onChange={handlePage}
          />
        </div>
      )}
      {selected && <DetailModal item={selected} type="volumes" onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Elastic IPs Tab ──────────────────────────────────────────────────────────

function ElasticIpsTab({ refreshSignal }) {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [data, setData]         = useState({ elasticIps: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [search, setSearch]       = useState('');
  const [assocFilter, setAssocFilter] = useState('all');
  const [page, setPage]           = useState(1);
  const [selected, setSelected]   = useState(null);

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const af = opts.assocFilter ?? assocFilter;
      const params = {
        search:     opts.search ?? search,
        associated: af === 'all' ? undefined : af === 'associated' ? true : false,
        page:       opts.page ?? page,
        pageSize:   PAGE_SIZE
      };
      const res = await fetchInventoryElasticIps(params);
      setData(res.data);
      setLastRefreshed(res.data?.lastRefreshed || new Date().toISOString());
    } catch (err) {
      setError(err.message || 'Failed to load Elastic IP inventory.');
    } finally {
      setLoading(false);
    }
  }, [search, assocFilter, page]);

  useEffect(() => { setPage(1); load({ page: 1 }); }, [refreshSignal]);

  const handleSearch = (v) => { setSearch(v); setPage(1); load({ search: v, page: 1 }); };
  const handleAssoc  = (v) => { setAssocFilter(v); setPage(1); load({ assocFilter: v, page: 1 }); };
  const handlePage   = (p) => { setPage(p); load({ page: p }); };

  const eips = data.elasticIps || [];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full md:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            id="inv-eips-search"
            type="text"
            placeholder="IP, allocation ID, instance…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
          {[['all','All'],['associated','Associated'],['unassociated','Unassociated']].map(([v,l]) => (
            <button key={v} id={`eip-assoc-${v}`} onClick={() => handleAssoc(v)}
              className={`px-3 py-1.5 rounded-md transition-all ${assocFilter === v ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
            >{l}</button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <LastRefreshed ts={lastRefreshed} />
          <span className="text-xs text-slate-500"><strong className="text-slate-800">{data.total}</strong> total</span>
          <button id="inv-eips-refresh" onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => load()} />}

      {/* Unassociated EIP warning */}
      {!loading && eips.some((e) => !e.associated) && (
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
          <span>
            <strong>Cost Alert:</strong> Unassociated Elastic IPs incur charges (~$3.65/mo each). Consider releasing IPs that are no longer in use.
          </span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Scanning Elastic IP inventory…" />
      ) : eips.length === 0 ? (
        <EmptyState title="No Elastic IPs found" description="Try adjusting your filters." icon={Globe} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Elastic IP</th>
                  <th className="py-3.5 px-4">Association</th>
                  <th className="py-3.5 px-4">Allocation ID</th>
                  <th className="py-3.5 px-4">Associated Resource</th>
                  <th className="py-3.5 px-4">Private IP</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {eips.map((eip) => (
                  <tr key={eip.allocationId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5">
                        {eip.associated
                          ? <Wifi className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          : <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        }
                        <span className="font-mono font-bold text-slate-900">{eip.publicIp}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 ml-5">{eip.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge type="eipAssociation" value={eip.associated} />
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-500">{eip.allocationId}</td>
                    <td className="py-4 px-4 font-mono text-[11px]">
                      {eip.associatedInstanceId
                        ? <span className="text-slate-700">{eip.associatedInstanceId}</span>
                        : <span className="text-slate-400 italic">—</span>
                      }
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                      {eip.privateIpAddress || '—'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        id={`eip-detail-${eip.allocationId}`}
                        onClick={() => setSelected(eip)}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                      >Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page} totalPages={data.totalPages}
            total={data.total} pageSize={data.pageSize}
            onChange={handlePage}
          />
        </div>
      )}
      {selected && <DetailModal item={selected} type="elastic-ips" onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('instances');
  const [refreshSignal, setRefreshSignal] = useState(0);

  const handleGlobalRefresh = () => setRefreshSignal((n) => n + 1);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Tab pills */}
          <nav className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-xs gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`inv-tab-${id}`}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Global refresh */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-lg">
            <Shield className="w-3 h-3 text-emerald-500" />
            Read-only
          </span>
          <button
            id="inv-global-refresh"
            onClick={handleGlobalRefresh}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh All
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'instances'   && <InstancesTab  refreshSignal={refreshSignal} />}
      {activeTab === 'volumes'     && <VolumesTab    refreshSignal={refreshSignal} />}
      {activeTab === 'elastic-ips' && <ElasticIpsTab refreshSignal={refreshSignal} />}
    </div>
  );
}
