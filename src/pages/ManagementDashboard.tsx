import React, { useEffect, useState, useMemo } from "react";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Link } from "react-router-dom";
import { 
  Users, Ticket, Wrench, AlertTriangle, Globe, ArrowRight, 
  Clock, ShieldAlert, CheckCircle2, Server, HelpCircle, Activity,
  Flame, Grid, BarChart3, Layers
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ScatterChart, Scatter, ZAxis, BarChart, Bar, Legend
} from "recharts";
import { format, differenceInDays } from "date-fns";
import { UserPermissions } from "../types";

const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

function normalizeCategory(supportType?: string): string {
  if (!supportType) return 'Other';
  const st = supportType.toLowerCase();
  if (st.includes('hard')) return 'Hardware';
  if (st.includes('soft')) return 'Software';
  if (st.includes('net')) return 'Network';
  if (st.includes('acc') || st.includes('user')) return 'Account';
  return 'Other';
}

function normalizePriority(priority?: string): string {
  if (!priority) return 'Low';
  const p = priority.toLowerCase();
  if (p.includes('crit')) return 'Critical';
  if (p.includes('high')) return 'High';
  if (p.includes('med')) return 'Medium';
  return 'Low';
}

const CustomHeatmapTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (!data) return null;
    return (
      <div className="bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl border border-slate-700 space-y-1.5 min-w-[170px]">
        <div className="font-bold text-slate-100 border-b border-slate-800 pb-1 flex items-center justify-between gap-2">
          <span>{data.category}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-extrabold ${ data.priority === 'Critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : data.priority === 'High' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : data.priority === 'Medium' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' }`}>
            {data.priority}
          </span>
        </div>
        <div className="pt-0.5 flex items-center justify-between text-slate-300">
          <span className="text-[11px]">Open Tickets:</span>
          <span className="font-mono font-bold text-white text-sm">{data.count}</span>
        </div>
      </div>
    );
  }
  return null;
};

const renderHeatmapCell = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;

  const count = payload.count || 0;
  const priority = payload.priority;

  const width = 56;
  const height = 32;
  const xPos = cx - width / 2;
  const yPos = cy - height / 2;

  let fillColor = "#f8fafc";
  let textColor = "#94a3b8";
  let strokeColor = "#e2e8f0";

  if (count > 0) {
    if (priority === 'Critical') {
      fillColor = count >= 4 ? "#be123c" : count >= 2 ? "#f43f5e" : "#ffe4e6";
      textColor = count >= 2 ? "#ffffff" : "#9f1239";
      strokeColor = "#fda4af";
    } else if (priority === 'High') {
      fillColor = count >= 4 ? "#c2410c" : count >= 2 ? "#f97316" : "#ffedd5";
      textColor = count >= 2 ? "#ffffff" : "#c2410c";
      strokeColor = "#fed7aa";
    } else if (priority === 'Medium') {
      fillColor = count >= 4 ? "#1d4ed8" : count >= 2 ? "#3b82f6" : "#dbeafe";
      textColor = count >= 2 ? "#ffffff" : "#1e40af";
      strokeColor = "#bfdbfe";
    } else {
      fillColor = count >= 4 ? "#047857" : count >= 2 ? "#10b981" : "#d1fae5";
      textColor = count >= 2 ? "#ffffff" : "#065f46";
      strokeColor = "#a7f3d0";
    }
  }

  return (
    <g className="transition-all duration-200 cursor-pointer">
      <rect
        x={xPos}
        y={yPos}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fill={textColor}
        fontSize={12}
        fontWeight={count > 0 ? "bold" : "normal"}
      >
        {count}
      </text>
    </g>
  );
};

interface ManagementDashboardProps {
  userRole?: string;
  userPermissions?: UserPermissions;
}

export default function ManagementDashboard({ userRole: propUserRole = "staff", userPermissions }: ManagementDashboardProps = {}) {
  const [stats, setStats] = useState({
    openTickets: 0,
    criticalTickets: 0,
    ongoingRepairs: 0,
    expiringLicenses: 0,
    activeUsers: 0,
    offlineISPs: 0
  });

  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [offlineISPs, setOfflineISPs] = useState<any[]>([]);
  const [expiringTrackers, setExpiringTrackers] = useState<any[]>([]);
  const [unassignedCriticalTickets, setUnassignedCriticalTickets] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>(propUserRole);

  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [categoryBreakdownData, setCategoryBreakdownData] = useState<any[]>([]);
  const [heatmapViewMode, setHeatmapViewMode] = useState<'grid' | 'bars'>('grid');
  const [heatmapMetrics, setHeatmapMetrics] = useState({ totalOpen: 0, peakCategory: 'None', peakCount: 0, criticalOrHigh: 0 });

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const u = auth.currentUser;
        if (u) {
          const userSnap = await getDoc(doc(db, "users", u.uid));
          if (userSnap.exists()) {
            setUserRole(userSnap.data()?.role || "staff");
          }
        }

        const [ticketsSnap, repairsSnap, usersSnap, ispSnap, licensesSnap] = await Promise.all([
          getDocs(collection(db, "tickets")),
          getDocs(collection(db, "repairs")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "isp_accounts")),
          getDocs(collection(db, "software_licenses"))
        ]);
        
        const allTickets = ticketsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allISPs = ispSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allRepairs = repairsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allLicenses = licensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const openTickets = allTickets.filter((t: any) => ["open", "in_progress"].includes(t.status));
        const criticalTickets = allTickets.filter((t: any) => ["critical", "high"].includes(t.priority) && t.status !== "resolved");
        const activeRepairs = allRepairs.filter((r: any) => r.status === "ongoing");
        const activeUsers = allUsers.filter((u: any) => u.status === "active");
        const issuesISPs = allISPs.filter((i: any) => i.currentStatus !== "online");

        // Calculate licenses/domains expiring within 30 days
        const expiringSoon = allLicenses.filter((lic: any) => {
          if (!lic.expiryDate) return false;
          const days = differenceInDays(new Date(lic.expiryDate), new Date());
          return days >= 0 && days <= 30;
        });

        // Find critical tickets that are currently unassigned
        const unassignedCritical = allTickets.filter((t: any) => 
          ["critical", "high"].includes(t.priority) && 
          (!t.assigneeId || t.assigneeId === "unassigned" || t.assigneeId === "") &&
          t.status !== "resolved" && t.status !== "closed"
        );

        setStats({
          openTickets: openTickets.length,
          criticalTickets: criticalTickets.length,
          ongoingRepairs: activeRepairs.length,
          expiringLicenses: expiringSoon.length,
          activeUsers: activeUsers.length,
          offlineISPs: issuesISPs.length
        });

        // Recent activity: sort tickets by createdAt
        const sortedTickets = allTickets.sort((a: any, b: any) => {
          const ad = a.createdAt?.toMillis?.() || 0;
          const bd = b.createdAt?.toMillis?.() || 0;
          return bd - ad;
        });

        setRecentTickets(sortedTickets.slice(0, 5));
        setOfflineISPs(issuesISPs);
        setExpiringTrackers(expiringSoon);
        setUnassignedCriticalTickets(unassignedCritical.slice(0, 4));

        // Group tickets by day for the trend chart
        const trendMap: Record<string, number> = {};
        const sortedForTrend = [...allTickets].sort((a: any, b: any) => {
          const ad = a.createdAt?.toMillis?.() || 0;
          const bd = b.createdAt?.toMillis?.() || 0;
          return ad - bd;
        });

        sortedForTrend.forEach((t: any) => {
          let dateStr = "";
          if (t.createdAt?.toDate) {
            dateStr = format(t.createdAt.toDate(), 'MM/dd');
          } else if (t.createdAt?.seconds) {
            dateStr = format(new Date(t.createdAt.seconds * 1000), 'MM/dd');
          }
          if (dateStr) {
            trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
          }
        });

        const trendList = Object.keys(trendMap).map(key => ({
          date: key,
          tickets: trendMap[key]
        }));
        setChartData(trendList.slice(-7)); // show last 7 active ticket dates

        // Compute Priority Heatmap density data for open/active tickets
        const activeOpenTickets = allTickets.filter((t: any) => t.status !== "resolved" && t.status !== "closed");
        const points: any[] = [];
        const catBreakdown: any[] = [];
        let maxCatTotal = 0;
        let peakCat = 'None';
        let critOrHighTotal = 0;

        CATEGORIES.forEach((cat, xIdx) => {
          const catObj: any = { category: cat, Low: 0, Medium: 0, High: 0, Critical: 0, total: 0 };

          PRIORITIES.forEach((pri, yIdx) => {
            const count = activeOpenTickets.filter((t: any) => 
              normalizeCategory(t.supportType) === cat &&
              normalizePriority(t.priority) === pri
            ).length;

            points.push({
              x: xIdx,
              y: yIdx,
              category: cat,
              priority: pri,
              count,
              z: count || 0.1
            });

            catObj[pri] = count;
            catObj.total += count;

            if (pri === 'Critical' || pri === 'High') {
              critOrHighTotal += count;
            }
          });

          if (catObj.total > maxCatTotal) {
            maxCatTotal = catObj.total;
            peakCat = cat;
          }

          catBreakdown.push(catObj);
        });

        setHeatmapData(points);
        setCategoryBreakdownData(catBreakdown);
        setHeatmapMetrics({
          totalOpen: activeOpenTickets.length,
          peakCategory: peakCat === 'None' && activeOpenTickets.length > 0 ? CATEGORIES[0] : peakCat,
          peakCount: maxCatTotal,
          criticalOrHigh: critOrHighTotal
        });

      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const cards = [
    { name: 'Active Tickets', value: stats.openTickets, icon: Ticket, color: "text-blue-500", bg: "bg-blue-50", link: "/tickets" },
    { name: 'Critical Tickets', value: stats.criticalTickets, icon: ShieldAlert, color: "text-rose-500", bg: "bg-rose-50", link: "/tickets" },
    { name: 'Ongoing Repairs', value: stats.ongoingRepairs, icon: Wrench, color: "text-amber-500", bg: "bg-amber-50", link: "/repairs" },
    { name: 'Offline ISP Nodes', value: stats.offlineISPs, icon: Globe, color: "text-red-600", bg: "bg-red-50", link: "/isp" },
    { name: 'Expiring Soon', value: stats.expiringLicenses, icon: Server, color: "text-purple-500", bg: "bg-purple-50", link: "/software" },
  ];

  return (
    <>
      <header className="min-h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-3 sm:py-0 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Executive Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Real-time IT infrastructure and support operations dashboard</p>
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400 font-medium">
            <Clock className="w-5 h-5 animate-spin mr-2" /> Loading real-time metrics...
          </div>
        ) : (
          <>
            {/* KPI Metrics Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              {cards.map((card) => (
                <Link 
                  key={card.name} 
                  to={card.link}
                  className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{card.name}</span>
                    <div className={`p-2 rounded-lg ${card.bg} transition-transform group-hover:scale-105`}>
                      <card.icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between mt-4">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">{card.value}</span>
                    <span className="text-[10px] text-blue-500 font-semibold group-hover:underline flex items-center gap-0.5">
                      View <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Main Grid Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               
               {/* Left/Middle Columns: Network, Performance, and Actions */}
               <div className="lg:col-span-2 space-y-8">
                  
                  {/* Critical Network Alerts */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Critical Network Alerts</h2>
                      </div>
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full border border-red-200">
                        {offlineISPs.length} Active Incidents
                      </span>
                    </div>
                    <div className="p-5 flex-1">
                      {offlineISPs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {offlineISPs.map(isp => (
                            <div key={isp.id} className="p-4 bg-rose-50/50 border border-red-100 rounded-xl flex items-start gap-3">
                              <Globe className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{isp.ispName}</p>
                                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{isp.branchOffice}</p>
                                 <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500 dark:text-slate-400">
                                   <span className="flex items-center gap-1">
                                     <Clock className="w-3 h-3 text-red-400" /> Current state:
                                   </span>
                                   <span className="font-extrabold uppercase text-red-600 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-red-200">
                                     {isp.currentStatus}
                                   </span>
                                 </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">All Network Nodes Stable</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No outstanding offline or degraded ISPs flagged currently.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Priority Heatmap Widget (Open Ticket Density) */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6 flex flex-col space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                            <Flame className="w-4 h-4" />
                          </div>
                          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Priority Heatmap (Open Ticket Density)</h2>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Visualize density of active issues based on priority level and category</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 dark:bg-slate-800/50 p-0.5 rounded-lg flex items-center text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => setHeatmapViewMode('grid')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${heatmapViewMode === 'grid' ? 'bg-white text-slate-900 dark:text-white shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            <Grid className="w-3.5 h-3.5" />
                            <span>Matrix</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeatmapViewMode('bars')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${heatmapViewMode === 'bars' ? 'bg-white text-slate-900 dark:text-white shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Stacked</span>
                          </button>
                        </div>

                        <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100">
                          {heatmapMetrics.totalOpen} Open Total
                        </span>
                      </div>
                    </div>

                    {/* Quick Insights Metric Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50/70 border border-slate-100 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Highest Category Load</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{heatmapMetrics.peakCategory}</p>
                        </div>
                        <span className="text-xs font-mono font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {heatmapMetrics.peakCount} Open
                        </span>
                      </div>

                      <div className="bg-slate-50/70 border border-slate-100 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">High & Critical Density</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">High Severity Cluster</p>
                        </div>
                        <span className="text-xs font-mono font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                          {heatmapMetrics.criticalOrHigh} Tickets
                        </span>
                      </div>

                      <div className="bg-slate-50/70 border border-slate-100 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Open Volume</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">Unresolved Total</p>
                        </div>
                        <span className="text-xs font-mono font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                          {heatmapMetrics.totalOpen} Issues
                        </span>
                      </div>
                    </div>

                    {/* Recharts Heatmap Container */}
                    <div className="h-64 pt-2">
                      {heatmapViewMode === 'grid' ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 15, right: 30, bottom: 15, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis 
                              type="number" 
                              dataKey="x" 
                              name="Category" 
                              domain={[-0.5, 4.5]} 
                              ticks={[0, 1, 2, 3, 4]} 
                              tickFormatter={(val) => CATEGORIES[val]} 
                              stroke="#64748b" 
                              fontSize={11} 
                              tickLine={false} 
                              axisLine={{ stroke: '#e2e8f0' }} 
                            />
                            <YAxis 
                              type="number" 
                              dataKey="y" 
                              name="Priority" 
                              domain={[-0.5, 3.5]} 
                              ticks={[0, 1, 2, 3]} 
                              tickFormatter={(val) => PRIORITIES[val]} 
                              stroke="#64748b" 
                              fontSize={11} 
                              tickLine={false} 
                              axisLine={{ stroke: '#e2e8f0' }} 
                            />
                            <ZAxis type="number" dataKey="z" range={[100, 1000]} />
                            <Tooltip content={<CustomHeatmapTooltip />} />
                            <Scatter data={heatmapData} shape={renderHeatmapCell} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={categoryBreakdownData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="category" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '0.5rem', fontSize: '11px' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                            <Bar dataKey="Low" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Low Priority" />
                            <Bar dataKey="Medium" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} name="Medium Priority" />
                            <Bar dataKey="High" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="High Priority" />
                            <Bar dataKey="Critical" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Critical Priority" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Heatmap Legend */}
                    {heatmapViewMode === 'grid' && (
                      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 gap-2">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Density Legend:</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"></span>
                            <span>0 (Clear)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span>
                            <span>1 (Low)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-blue-500"></span>
                            <span>2-3 (Moderate)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-rose-600"></span>
                            <span>4+ (High)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Support Tickets Load Trend */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-blue-500" /> Support Ticket Creation Trend
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Frequency of support tickets logged daily</p>
                      </div>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">7 Dates</span>
                    </div>
                    <div className="h-56">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '0.5rem', fontSize: '11px' }} />
                            <Area type="monotone" dataKey="tickets" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTickets)" strokeWidth={2.5} name="Tickets Logged" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-xs">
                          No ticket trend data available yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Urgent Attention / Action Items */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-500" /> Pending Action Items (Unassigned Critical)
                      </h2>
                    </div>
                    <div className="p-5">
                      {unassignedCriticalTickets.length > 0 ? (
                        <div className="space-y-3">
                          {unassignedCriticalTickets.map(ticket => (
                            <div key={ticket.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                              <div className="min-w-0 flex-1 pr-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                                    {ticket.ticketCode || "N/A"}
                                  </span>
                                  <span className="text-[10px] font-extrabold uppercase text-rose-600 bg-rose-50 border border-rose-100 px-1.5 rounded">
                                    {ticket.priority}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">{ticket.title}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{ticket.requestDept} • Reporter: {ticket.requestUsername}</p>
                              </div>
                              {userRole === 'management' ? (
                                <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold rounded shrink-0 font-mono">
                                  UNASSIGNED
                                </span>
                              ) : (
                                <Link 
                                  to="/tickets"
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors shrink-0"
                                >
                                  Assign Now
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Unassigned Critical Tickets</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">All high priority issues are currently assigned to IT Assistants.</p>
                        </div>
                      )}
                    </div>
                  </div>

               </div>

               {/* Right Column: Feeds, Expirations, and Fast Navigation */}
               <div className="space-y-8">
                  
                  {/* Quick System Links */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                    <h2 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Quick Shortcuts</h2>
                    {userRole === 'management' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Link to="/reports" className="p-3 text-center bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 border border-slate-100 dark:border-slate-800 rounded-lg transition-colors flex flex-col items-center gap-1.5 group">
                          <Ticket className="w-5 h-5 text-blue-500 group-hover:scale-105 transition-transform" />
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Ticket Analytics</span>
                        </Link>
                        <Link to="/reports" className="p-3 text-center bg-slate-50 dark:bg-slate-900 hover:bg-amber-50 border border-slate-100 dark:border-slate-800 rounded-lg transition-colors flex flex-col items-center gap-1.5 group">
                          <Wrench className="w-5 h-5 text-amber-500 group-hover:scale-105 transition-transform" />
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Repair Audits</span>
                        </Link>
                        <Link to="/reports" className="p-3 text-center bg-slate-50 dark:bg-slate-900 hover:bg-purple-50 border border-slate-100 dark:border-slate-800 rounded-lg transition-colors flex flex-col items-center gap-1.5 group">
                          <Server className="w-5 h-5 text-purple-500 group-hover:scale-105 transition-transform" />
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Licensing Reports</span>
                        </Link>
                        <Link to="/reports" className="p-3 text-center bg-slate-50 dark:bg-slate-900 hover:bg-emerald-50 border border-slate-100 dark:border-slate-800 rounded-lg transition-colors flex flex-col items-center gap-1.5 group">
                          <Globe className="w-5 h-5 text-emerald-500 group-hover:scale-105 transition-transform" />
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">ISP Outage Logs</span>
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <Link to="/tickets" className="p-3 text-center bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 border border-slate-100 dark:border-slate-800 rounded-lg transition-colors flex flex-col items-center gap-1.5 group">
                          <Ticket className="w-5 h-5 text-blue-500 group-hover:scale-105 transition-transform" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Add Ticket</span>
                        </Link>
                        <Link to="/repairs" className="p-3 text-center bg-slate-50 dark:bg-slate-900 hover:bg-amber-50 border border-slate-100 dark:border-slate-800 rounded-lg transition-colors flex flex-col items-center gap-1.5 group">
                          <Wrench className="w-5 h-5 text-amber-500 group-hover:scale-105 transition-transform" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Log Repair</span>
                        </Link>
                        <Link to="/software" className="p-3 text-center bg-slate-50 dark:bg-slate-900 hover:bg-purple-50 border border-slate-100 dark:border-slate-800 rounded-lg transition-colors flex flex-col items-center gap-1.5 group">
                          <Server className="w-5 h-5 text-purple-500 group-hover:scale-105 transition-transform" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Track Domain</span>
                        </Link>
                        <Link to="/reports" className="p-3 text-center bg-slate-50 dark:bg-slate-900 hover:bg-emerald-50 border border-slate-100 dark:border-slate-800 rounded-lg transition-colors flex flex-col items-center gap-1.5 group">
                          <Activity className="w-5 h-5 text-emerald-500 group-hover:scale-105 transition-transform" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Audit</span>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Software & Domain Expirations Alert */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                      <h2 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tracker Expirations (&le; 30 Days)</h2>
                      <span className="text-[10px] font-extrabold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                        {expiringTrackers.length} Items
                      </span>
                    </div>
                    <div className="p-4 flex-1">
                      {expiringTrackers.length > 0 ? (
                        <div className="space-y-3">
                          {expiringTrackers.map(lic => {
                            const days = lic.expiryDate ? differenceInDays(new Date(lic.expiryDate), new Date()) : 0;
                            return (
                              <div key={lic.id} className="flex items-center justify-between p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg text-xs">
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{lic.name}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-extrabold mt-0.5 tracking-wider">{lic.type}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-bold text-amber-700 font-mono">
                                    {days < 0 ? "Expired" : `${days} days left`}
                                  </span>
                                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    {lic.expiryDate ? format(new Date(lic.expiryDate), 'MMM dd') : ""}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-emerald-500 opacity-60" />
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">All Trackers Clear</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">No domains or Microsoft licenses expiring within 30 days.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Support Activity Feed */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                      <h2 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recent Support Activity Feed</h2>
                    </div>
                    <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
                      {recentTickets.length > 0 ? (
                        recentTickets.map(ticket => (
                          <div key={ticket.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase shrink-0 ${ ticket.priority === 'critical' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-600 dark:text-slate-400 border border-slate-200' }`}>
                              {ticket.priority?.[0] || 'T'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{ticket.title}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium truncate">
                                {ticket.requestDept || 'General'} • {ticket.status?.replace('_', ' ').toUpperCase()}
                              </p>
                            </div>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap pt-0.5">
                              {ticket.createdAt?.toDate 
                                ? format(ticket.createdAt.toDate(), 'MM/dd HH:mm') 
                                : ticket.createdAt?.seconds 
                                  ? format(new Date(ticket.createdAt.seconds * 1000), 'MM/dd HH:mm')
                                  : "Recently"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                          No recent support activity recorded
                        </div>
                      )}
                    </div>
                  </div>

               </div>

            </div>
          </>
        )}
      </div>
    </>
  );
}
