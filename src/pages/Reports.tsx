import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area 
} from "recharts";
import { 
  Download, FileText, Ticket, Wrench, Globe, ShieldAlert, 
  CheckCircle2, AlertTriangle, Clock, Search, TrendingUp, Info,
  Mail, Settings, Send, Trash2, Check
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { 
  getEmailSettings, 
  saveEmailSettings, 
  sendEmailAlert, 
  getMailtoLink, 
  getAlertRecipients, 
  saveAlertRecipients 
} from "../lib/emailService";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
  unassigned: '#64748b'
};

export default function Reports() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [isps, setIsps] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tickets' | 'repairs' | 'isps' | 'licenses'>('tickets');
  const [searchQuery, setSearchQuery] = useState('');

  // Email Alerts settings and log states
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState<string>("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [emailjsEnabled, setEmailjsEnabled] = useState(false);
  const [emailjsServiceId, setEmailjsServiceId] = useState("");
  const [emailjsTemplateId, setEmailjsTemplateId] = useState("");
  const [emailjsPublicKey, setEmailjsPublicKey] = useState("");

  // Process data for charts
  const [ticketData, setTicketData] = useState<any[]>([]);
  const [ticketPriorityData, setTicketPriorityData] = useState<any[]>([]);
  const [repairData, setRepairData] = useState<any[]>([]);
  const [ispDowntimeData, setIspDowntimeData] = useState<any[]>([]);

  const [seeding, setSeeding] = useState(false);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      let fetchedTickets: any[] = [];
      let fetchedRepairs: any[] = [];
      let fetchedIsps: any[] = [];
      let fetchedLicenses: any[] = [];
      let fetchedUsers: any[] = [];
      let fetchedEmailLogs: any[] = [];

      try {
        const snap = await getDocs(collection(db, "tickets"));
        fetchedTickets = snap.docs.map(t => ({ id: t.id, ...t.data() } as any));
      } catch (err) {
        console.error("Error loading tickets collection:", err);
      }

      try {
        const snap = await getDocs(collection(db, "repairs"));
        fetchedRepairs = snap.docs.map(r => ({ id: r.id, ...r.data() } as any));
      } catch (err) {
        console.error("Error loading repairs collection:", err);
      }

      try {
        const snap = await getDocs(collection(db, "isp_accounts"));
        fetchedIsps = snap.docs.map(i => ({ id: i.id, ...i.data() } as any));
      } catch (err) {
        console.error("Error loading isp_accounts collection:", err);
      }

      try {
        const snap = await getDocs(collection(db, "software_licenses"));
        fetchedLicenses = snap.docs.map(l => ({ id: l.id, ...l.data() } as any));
      } catch (err) {
        console.error("Error loading software_licenses collection:", err);
      }

      try {
        const snap = await getDocs(collection(db, "users"));
        fetchedUsers = snap.docs.map(u => ({ id: u.id, ...u.data() } as any));
      } catch (err) {
        console.error("Error loading users collection:", err);
      }

      setTickets(fetchedTickets);
      setRepairs(fetchedRepairs);
      setIsps(fetchedIsps);
      setLicenses(fetchedLicenses);
      setUsers(fetchedUsers);
      setEmailLogs(fetchedEmailLogs);

      try {
        const emailSettings = await getEmailSettings();
        setRecipients(emailSettings.recipients || []);
        setEmailjsEnabled(!!emailSettings.emailjs_enabled);
        setEmailjsServiceId(emailSettings.emailjs_service_id || "");
        setEmailjsTemplateId(emailSettings.emailjs_template_id || "");
        setEmailjsPublicKey(emailSettings.emailjs_public_key || "");
      } catch (err) {
        console.error("Error getting alert email settings:", err);
      }

      // Process tickets by status
      const tStats: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
      fetchedTickets.forEach((t: any) => { 
        if (t.status in tStats) tStats[t.status]++; 
      });
      setTicketData(Object.keys(tStats).map(key => ({ 
        name: key.replace('_', ' ').toUpperCase(), 
        value: tStats[key] 
      })));

      // Process ISP Downtime
      const downtimeByISP = fetchedIsps.map((isp: any) => {
        const totalHours = (isp.downtimeRecords || []).reduce((sum: number, r: any) => {
          const hrs = parseFloat(r.duration || '0');
          return sum + (isNaN(hrs) ? 0 : hrs);
        }, 0);
        return { name: isp.ispName, hours: parseFloat(totalHours.toFixed(1)) };
      }).filter(i => i.hours > 0);
      setIspDowntimeData(downtimeByISP);

      // Process tickets by priority trend
      const sortedTickets = [...fetchedTickets].sort((a: any, b: any) => {
        const ad = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || (a.createdAt ? new Date(a.createdAt).getTime() : 0) || 0;
        const bd = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || (b.createdAt ? new Date(b.createdAt).getTime() : 0) || 0;
        return ad - bd;
      });

      const pStats: Record<string, any> = {};
      sortedTickets.forEach(t => { 
        let dateStr = 'Unknown';
        if (t.createdAt?.toDate) {
          dateStr = format(t.createdAt.toDate(), 'MMM dd');
        } else if (t.createdAt?.seconds) {
          dateStr = format(new Date(t.createdAt.seconds * 1000), 'MMM dd');
        } else if (t.createdAt) {
          try {
            dateStr = format(new Date(t.createdAt), 'MMM dd');
          } catch {
            dateStr = 'Unknown';
          }
        }
        if (!pStats[dateStr]) {
          pStats[dateStr] = { date: dateStr, low: 0, medium: 0, high: 0, critical: 0, unassigned: 0 };
        }
        const p = t.priority || 'unassigned';
        pStats[dateStr][p] = (pStats[dateStr][p] || 0) + 1;
      });
      setTicketPriorityData(Object.values(pStats));

      // Process repairs by status
      const rStats: Record<string, number> = { pending: 0, ongoing: 0, completed: 0 };
      fetchedRepairs.forEach(r => { 
        if (r.status in rStats) rStats[r.status]++; 
      });
      setRepairData(Object.keys(rStats).map(key => ({ 
        name: key.toUpperCase(), 
        value: rStats[key] 
      })));

    } catch (e) {
      console.error("Error processing fetched data:", e);
    } finally {
      setLoading(false);
    }
  };

  const seedSampleData = async () => {
    setSeeding(true);
    try {
      const currentUserId = auth.currentUser?.uid || "system_seeder";

      // 1. Seed tickets
      const sampleTickets = [
        {
          title: "Main office router overheating",
          description: "Main Cisco router in Server Room B is overheating frequently, causing intermittent drops for the marketing team.",
          status: "in_progress",
          priority: "high",
          supportType: "network",
          ticketCode: "TK-4821",
          requestDept: "Marketing",
          requestUsername: "sarah.m",
          authorId: currentUserId,
          authorRole: "admin",
          assigneeId: "unassigned",
          history: [{ note: "Ticket created", date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() }, { note: "Investigating ventilation", date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          title: "Active Directory account locked",
          description: "New staff member cannot sign in, keeps getting password incorrect / account locked out.",
          status: "resolved",
          priority: "low",
          supportType: "account",
          ticketCode: "TK-1052",
          requestDept: "HR",
          requestUsername: "david.k",
          authorId: currentUserId,
          authorRole: "admin",
          assigneeId: "unassigned",
          history: [{ note: "Ticket created", date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() }, { note: "Account unlocked and password reset", date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          title: "Blue screen of death on workstation",
          description: "Finance assistant computer crashes with blue screen code PAGE_FAULT_IN_NONPAGED_AREA.",
          status: "open",
          priority: "critical",
          supportType: "hardware",
          ticketCode: "TK-9923",
          requestDept: "Finance",
          requestUsername: "elizabeth.c",
          authorId: currentUserId,
          authorRole: "admin",
          assigneeId: "unassigned",
          history: [{ note: "Ticket created", date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          title: "VGA Adapter for Projector Room 3",
          description: "The projector VGA cable is damaged and needs immediate replacement for the board meeting.",
          status: "open",
          priority: "medium",
          supportType: "hardware",
          ticketCode: "TK-2345",
          requestDept: "Executive",
          requestUsername: "john.d",
          authorId: currentUserId,
          authorRole: "admin",
          assigneeId: "unassigned",
          history: [{ note: "Ticket created", date: new Date().toISOString() }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      ];

      for (const t of sampleTickets) {
        await addDoc(collection(db, "tickets"), t);
      }

      // 2. Seed repairs
      const sampleRepairs = [
        {
          title: "Replace workstation PSU",
          repairCode: "RP-8831",
          device: "Dell OptiPlex 7090 Workstation",
          status: "completed",
          shopCenterName: "Internal Lab",
          reportedIssues: "Power supply fan failure and random power downs.",
          mechanicId: "unassigned",
          history: [{ note: "Logged repair", date: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString() }, { note: "PSU replaced & tested", date: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString() }],
          completionDate: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          title: "Keyboard & Battery Replacement",
          repairCode: "RP-1249",
          device: "MacBook Pro 16\" (2021)",
          status: "ongoing",
          shopCenterName: "Apple Authorized Repair",
          reportedIssues: "Sticky keys and battery swelling.",
          mechanicId: "unassigned",
          history: [{ note: "Shipped to diagnostic center", date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      ];

      for (const r of sampleRepairs) {
        await addDoc(collection(db, "repairs"), r);
      }

      // 3. Seed ISP accounts
      const sampleIsps = [
        {
          ispName: "Mytel Fiber Pro",
          branchOffice: "Yangon HQ",
          speed: "150 Mbps",
          currentStatus: "online",
          userIdDeviceId: "MYT-YGN-4921",
          contactName: "U Maung Maung",
          downtimeRecords: [{ date: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(), duration: "2.5", reason: "Fibre cut during construction work", status: "offline", resolvedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000 + 2.5 * 3600 * 1000).toISOString() }],
          authorId: currentUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          ispName: "ATOM Enterprise",
          branchOffice: "Mandalay Branch",
          speed: "80 Mbps",
          currentStatus: "online",
          userIdDeviceId: "ATM-MDY-9031",
          contactName: "Daw Yee Yee",
          downtimeRecords: [{ date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), duration: "1.2", reason: "ISP gateway routing failure", status: "offline", resolvedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 1.2 * 3600 * 1000).toISOString() }],
          authorId: currentUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      ];

      for (const i of sampleIsps) {
        await addDoc(collection(db, "isp_accounts"), i);
      }

      // 4. Seed software licenses
      const sampleLicenses = [
        {
          name: "office365.management.com",
          type: "ms_license",
          status: "active",
          expiryDate: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString(),
          notes: "Annual renewal for 50 Enterprise seats",
          authorId: currentUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          name: "companyportal-prd.com",
          type: "domain",
          status: "active",
          expiryDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
          notes: "Main customer-facing domain hosted on GoDaddy",
          authorId: currentUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          name: "core-router-ssl-cert",
          type: "server",
          status: "expired",
          expiryDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          notes: "Internal wildcard SSL certificate",
          authorId: currentUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      ];

      for (const l of sampleLicenses) {
        await addDoc(collection(db, "software_licenses"), l);
      }

      alert("Sample operational data successfully seeded into Firestore! Reloading dashboard...");
      await fetchAllData();
    } catch (e) {
      console.error("Seeding failed:", e);
      alert(`Seeding failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Helper formatting functions
  const formatDate = (ts: any) => {
    if (!ts) return "N/A";
    try {
      if (ts.toDate) return format(ts.toDate(), "yyyy-MM-dd HH:mm");
      if (ts.seconds) return format(new Date(ts.seconds * 1000), "yyyy-MM-dd HH:mm");
      return format(new Date(ts), "yyyy-MM-dd HH:mm");
    } catch {
      return "N/A";
    }
  };

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      map[u.id] = u.displayName || u.username || u.email;
    });
    return map;
  }, [users]);

  // Derived KPI Metrics
  const metrics = useMemo(() => {
    const totalT = tickets.length;
    const resolvedT = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const resolutionRate = totalT ? Math.round((resolvedT / totalT) * 100) : 0;
    
    const activeRepairsCount = repairs.filter(r => r.status === 'ongoing').length;
    
    const totalDowntimeHrs = isps.reduce((acc, isp) => {
      const records = isp.downtimeRecords || [];
      const sum = records.reduce((s: number, r: any) => s + parseFloat(r.duration || '0'), 0);
      return acc + sum;
    }, 0);

    const expiringSoonCount = licenses.filter(lic => {
      if (!lic.expiryDate) return false;
      const days = differenceInDays(new Date(lic.expiryDate), new Date());
      return days >= 0 && days <= 30;
    }).length;

    const criticalTicketsCount = tickets.filter(t => t.priority === 'critical' && t.status !== 'resolved').length;

    return {
      totalT,
      resolvedT,
      resolutionRate,
      activeRepairsCount,
      totalDowntimeHrs: parseFloat(totalDowntimeHrs.toFixed(1)),
      expiringSoonCount,
      criticalTicketsCount
    };
  }, [tickets, repairs, isps, licenses]);

  // Export CSV based on currently selected tab
  const exportCSV = () => {
    let dataToExport: any[] = [];
    let filename = "reports_data.csv";

    if (activeTab === 'tickets') {
      dataToExport = tickets.map(t => ({
        Code: t.ticketCode || "N/A",
        Title: t.title || "",
        Priority: t.priority || "",
        Type: t.supportType || "",
        Status: t.status || "",
        Department: t.requestDept || "",
        User: t.requestUsername || "",
        Assignee: usersMap[t.assigneeId] || "Unassigned",
        CreatedDate: formatDate(t.createdAt)
      }));
      filename = "support_tickets_report.csv";
    } else if (activeTab === 'repairs') {
      dataToExport = repairs.map(r => ({
        Code: r.repairCode || "N/A",
        Title: r.title || "",
        Device: r.device || "",
        Status: r.status || "",
        ShopName: r.shopCenterName || "N/A",
        Mechanic: usersMap[r.mechanicId] || "Unassigned",
        CreatedDate: formatDate(r.createdAt)
      }));
      filename = "device_repairs_report.csv";
    } else if (activeTab === 'isps') {
      dataToExport = isps.map(isp => ({
        ISP: isp.ispName || "",
        Branch: isp.branchOffice || "",
        Speed: isp.speed || "",
        DeviceID: isp.userIdDeviceId || "",
        Status: isp.currentStatus || "",
        DowntimeCount: (isp.downtimeRecords || []).length,
        TotalDowntimeHrs: (isp.downtimeRecords || []).reduce((sum: number, r: any) => sum + parseFloat(r.duration || '0'), 0)
      }));
      filename = "isp_accounts_report.csv";
    } else if (activeTab === 'licenses') {
      dataToExport = licenses.map(l => ({
        Name: l.name || "",
        Type: l.type || "",
        Status: l.status || "",
        ExpiryDate: l.expiryDate ? format(new Date(l.expiryDate), 'yyyy-MM-dd') : "N/A",
        Notes: l.notes || ""
      }));
      filename = "software_and_domains_report.csv";
    }

    if (!dataToExport.length) return;

    const headers = Object.keys(dataToExport[0]).join(",");
    const rows = dataToExport.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPDF = () => {
    window.print();
  };

  // Filter lists based on Search Query
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => 
      (t.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (t.ticketCode?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (t.requestDept?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (t.requestUsername?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
  }, [tickets, searchQuery]);

  const filteredRepairs = useMemo(() => {
    return repairs.filter(r => 
      (r.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (r.repairCode?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (r.device?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
  }, [repairs, searchQuery]);

  const filteredIsps = useMemo(() => {
    return isps.filter(isp => 
      (isp.ispName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (isp.branchOffice?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
  }, [isps, searchQuery]);

  const filteredLicenses = useMemo(() => {
    return licenses.filter(l => 
      (l.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (l.type?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (l.notes?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
  }, [licenses, searchQuery]);

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500">Comprehensive IT operation analytics, KPI metrics, and exports</p>
        </div>
        <div className="flex gap-2">
          {tickets.length === 0 && repairs.length === 0 && isps.length === 0 && (
            <button 
              onClick={seedSampleData} 
              disabled={seeding}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" /> {seeding ? "Seeding..." : "Seed Operational Data"}
            </button>
          )}
          <button onClick={exportCSV} className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg shadow-sm hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> Export CSV ({activeTab.toUpperCase()})
          </button>
          <button onClick={printPDF} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 flex items-center gap-2 transition-colors">
             <FileText className="w-4 h-4" /> Print to PDF
          </button>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-y-auto space-y-8 bg-slate-50/50">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 font-medium">
            <Clock className="w-5 h-5 animate-spin mr-2" /> Loading reports and calculating analytics...
          </div>
        ) : (
          <>
            {/* KPI Metrics Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-12 w-12 bg-blue-50 rounded-bl-3xl flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Support Tickets</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.totalT}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>Resolution Rate:</span>
                  <span className="font-bold text-emerald-600">{metrics.resolutionRate}%</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-12 w-12 bg-amber-50 rounded-bl-3xl flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Repairs</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.activeRepairsCount}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>Total Repairs Logged:</span>
                  <span className="font-bold text-slate-700">{repairs.length}</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-12 w-12 bg-red-50 rounded-bl-3xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ISP Downtime</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.totalDowntimeHrs}h</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>Unstable ISP Connections:</span>
                  <span className="font-bold text-red-600">
                    {isps.filter(i => i.currentStatus !== 'online').length}
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-12 w-12 bg-emerald-50 rounded-bl-3xl flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Licenses Expiring</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.expiringSoonCount}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>Total Monitored:</span>
                  <span className="font-bold text-slate-700">{licenses.length} items</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-12 w-12 bg-rose-50 rounded-bl-3xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical Tickets</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.criticalTicketsCount}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>Needs Instant Action:</span>
                  <span className={`font-bold ${metrics.criticalTicketsCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {metrics.criticalTicketsCount > 0 ? 'Urgent Response' : 'All Clear'}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tickets Status Chart */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500" /> Tickets by Current Status
                  </h2>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">Live</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ticketData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '0.5rem', fontSize: '12px' }} cursor={{fill: '#f8fafc'}} />
                      <Bar dataKey="value" fill="#3b82f6" name="Tickets count" radius={[6, 6, 0, 0]}>
                        {ticketData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tickets Priority Trend Chart */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Tickets Priority Trend
                  </h2>
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100">Date Log</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ticketPriorityData}>
                      <defs>
                        <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '0.5rem', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b', paddingTop: '10px' }} />
                      <Area type="monotone" dataKey="critical" stroke="#ef4444" fillOpacity={1} fill="url(#colorCritical)" strokeWidth={2.5} name="Critical" />
                      <Area type="monotone" dataKey="high" stroke="#f59e0b" fillOpacity={1} fill="url(#colorHigh)" strokeWidth={2.5} name="High" />
                      <Area type="monotone" dataKey="medium" stroke="#3b82f6" fillOpacity={0} strokeWidth={1.5} name="Medium" />
                      <Area type="monotone" dataKey="low" stroke="#10b981" fillOpacity={0} strokeWidth={1.5} name="Low" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Repairs Overview Chart */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-500" /> Device Repairs Overview
                  </h2>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={repairData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {repairData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '0.5rem', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ISP Downtime Chart */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-4 h-4 text-red-500" /> Total Downtime by ISP (Hours)
                  </h2>
                </div>
                <div className="h-72">
                  {ispDowntimeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ispDowntimeData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={120} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '0.5rem', fontSize: '12px' }} />
                        <Bar dataKey="hours" fill="#ef4444" radius={[0, 6, 6, 0]} name="Downtime Hours" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <Globe className="w-10 h-10 mb-2 stroke-1 opacity-40" />
                      <p className="text-xs">No downtime hours logged yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detailed logs & tables section (NEW ADDED DETAIL SECTIONS) */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden print:hidden">
              <div className="border-b border-slate-200 bg-slate-50/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" /> Detailed Operation Logs & Records
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Audit, search, and view granular system data</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search records..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 w-full sm:w-60 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/30">
                <button 
                  onClick={() => { setActiveTab('tickets'); setSearchQuery(''); }}
                  className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'tickets' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Tickets ({filteredTickets.length})
                </button>
                <button 
                  onClick={() => { setActiveTab('repairs'); setSearchQuery(''); }}
                  className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'repairs' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Repairs ({filteredRepairs.length})
                </button>
                <button 
                  onClick={() => { setActiveTab('isps'); setSearchQuery(''); }}
                  className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'isps' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  ISP Nodes ({filteredIsps.length})
                </button>
                <button 
                  onClick={() => { setActiveTab('licenses'); setSearchQuery(''); }}
                  className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'licenses' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Software & Domains ({filteredLicenses.length})
                </button>
              </div>

              {/* Tab Contents */}
              <div className="overflow-x-auto">
                {activeTab === 'tickets' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">
                        <th className="px-6 py-3">Code</th>
                        <th className="px-6 py-3">Ticket Title</th>
                        <th className="px-6 py-3">Priority</th>
                        <th className="px-6 py-3">Department</th>
                        <th className="px-6 py-3">Reporter</th>
                        <th className="px-6 py-3">Assignee</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Created At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredTickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-3 font-mono font-bold text-slate-500">{t.ticketCode || "N/A"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-800">{t.title}</td>
                          <td className="px-6 py-3">
                            <span 
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border"
                              style={{ 
                                color: PRIORITY_COLORS[t.priority] || '#64748b', 
                                borderColor: (PRIORITY_COLORS[t.priority] || '#64748b') + '30',
                                backgroundColor: (PRIORITY_COLORS[t.priority] || '#64748b') + '10'
                              }}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-600 font-medium">{t.requestDept || "General"}</td>
                          <td className="px-6 py-3 text-slate-500">{t.requestUsername || "N/A"}</td>
                          <td className="px-6 py-3 text-slate-700 font-medium">{usersMap[t.assigneeId] || 'Unassigned'}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              t.status === 'resolved' || t.status === 'closed' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : t.status === 'in_progress' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {t.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-500 font-mono">{formatDate(t.createdAt)}</td>
                        </tr>
                      ))}
                      {filteredTickets.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400">No support tickets found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'repairs' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">
                        <th className="px-6 py-3">Code</th>
                        <th className="px-6 py-3">Repair Project</th>
                        <th className="px-6 py-3">Device Target</th>
                        <th className="px-6 py-3">Shop/Center</th>
                        <th className="px-6 py-3">Mechanic / Handler</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Created At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredRepairs.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-3 font-mono font-bold text-slate-500">{r.repairCode || "N/A"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-800">{r.title}</td>
                          <td className="px-6 py-3 text-slate-600 font-medium">{r.device}</td>
                          <td className="px-6 py-3 text-slate-500">{r.shopCenterName || "Internal"}</td>
                          <td className="px-6 py-3 text-slate-700 font-medium">{usersMap[r.mechanicId] || 'Unassigned'}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              r.status === 'completed' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : r.status === 'ongoing' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-500 font-mono">{formatDate(r.createdAt)}</td>
                        </tr>
                      ))}
                      {filteredRepairs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400">No repair logs found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'isps' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">
                        <th className="px-6 py-3">ISP Partner</th>
                        <th className="px-6 py-3">Branch Office</th>
                        <th className="px-6 py-3">Bandwidth Speed</th>
                        <th className="px-6 py-3">Device / ID</th>
                        <th className="px-6 py-3">Incidents logged</th>
                        <th className="px-6 py-3">Cumulative Downtime</th>
                        <th className="px-6 py-3">Current Node State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredIsps.map((isp) => {
                        const totalHours = (isp.downtimeRecords || []).reduce((sum: number, r: any) => sum + parseFloat(r.duration || '0'), 0);
                        return (
                          <tr key={isp.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-3 font-semibold text-slate-800">{isp.ispName}</td>
                            <td className="px-6 py-3 text-slate-600 font-medium">{isp.branchOffice}</td>
                            <td className="px-6 py-3 text-slate-500 font-mono">{isp.speed || "N/A"}</td>
                            <td className="px-6 py-3 text-slate-500 font-mono">{isp.userIdDeviceId || "N/A"}</td>
                            <td className="px-6 py-3 text-slate-600 font-bold">{(isp.downtimeRecords || []).length} occurrences</td>
                            <td className="px-6 py-3 font-semibold text-red-600 font-mono">{totalHours.toFixed(1)} Hours</td>
                            <td className="px-6 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                isp.currentStatus === 'online' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : isp.currentStatus === 'offline' 
                                    ? 'bg-red-50 text-red-700 border-red-100' 
                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {isp.currentStatus || 'online'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredIsps.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400">No ISP accounts found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'licenses' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">
                        <th className="px-6 py-3">Resource/Domain Name</th>
                        <th className="px-6 py-3">Resource Type</th>
                        <th className="px-6 py-3">Urgency Status</th>
                        <th className="px-6 py-3">Expiry Date</th>
                        <th className="px-6 py-3">Days Remaining</th>
                        <th className="px-6 py-3">Notes / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredLicenses.map((l) => {
                        let daysLeft = 0;
                        if (l.expiryDate) {
                          daysLeft = differenceInDays(new Date(l.expiryDate), new Date());
                        }
                        return (
                          <tr key={l.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-3 font-semibold text-slate-800">{l.name}</td>
                            <td className="px-6 py-3 uppercase text-[10px] text-slate-500 font-bold">{l.type || "N/A"}</td>
                            <td className="px-6 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                daysLeft < 0 
                                  ? 'bg-red-50 text-red-700 border-red-100' 
                                  : daysLeft <= 30 
                                    ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              }`}>
                                {daysLeft < 0 ? "EXPIRED" : daysLeft <= 30 ? "URGENT EXPIRY" : "ACTIVE"}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-600 font-mono">
                              {l.expiryDate ? format(new Date(l.expiryDate), 'yyyy-MM-dd') : "N/A"}
                            </td>
                            <td className={`px-6 py-3 font-bold font-mono ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-slate-600'}`}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days`}
                            </td>
                            <td className="px-6 py-3 text-slate-500 max-w-xs truncate" title={l.notes || l.details}>
                              {l.notes || l.details || "N/A"}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredLicenses.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-400">No tracked items found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
