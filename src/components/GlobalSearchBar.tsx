import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  Search, Ticket, Wrench, FolderKanban, Users, X, 
  Clock, ArrowRight, CornerDownLeft, Command, Shield, 
  AlertCircle, CheckCircle2, Building2, Mail, Phone,
  Layers, ChevronRight, Hash, UserCheck, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SupportTicket, Repair, User, OperationType } from "../types";
import { ITProject } from "../pages/ITProjects/types";
import { getTicketsLocal, getRepairsLocal } from "../lib/offlineStorage";

export type SearchCategory = 'all' | 'tickets' | 'repairs' | 'projects' | 'users';

interface SearchResultItem {
  id: string;
  category: 'tickets' | 'repairs' | 'projects' | 'users';
  title: string;
  subtitle: string;
  code?: string;
  badgeText?: string;
  badgeVariant?: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate';
  secondaryBadge?: string;
  secondaryBadgeVariant?: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate';
  detail: string;
  targetUrl: string;
  searchPayload: string;
  rawItem: any;
}

interface GlobalSearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  userRole?: string;
}

export function GlobalSearchBar({ isOpen, onClose, onOpen, userRole }: GlobalSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SearchCategory>("all");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Cached data sets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [projects, setProjects] = useState<ITProject[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("global_recent_searches");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Global keyboard shortcut (Cmd+K or Ctrl+K or '/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If pressing Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
        return;
      }

      // If pressing '/' when not in an active input or textarea
      if (e.key === "/" && !isOpen) {
        const activeElem = document.activeElement;
        const isInputField = activeElem && (
          activeElem.tagName === "INPUT" || 
          activeElem.tagName === "TEXTAREA" || 
          (activeElem as HTMLElement).isContentEditable
        );
        if (!isInputField) {
          e.preventDefault();
          onOpen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpen, onClose]);

  // Load / Refresh all data whenever the search modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Focus input on open
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Support Tickets (Firebase + Local Storage fallback)
        try {
          const ticketsSnap = await getDocs(collection(db, "support_tickets"));
          const fetchedTickets: SupportTicket[] = ticketsSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
          } as SupportTicket));
          setTickets(fetchedTickets);
        } catch (err) {
          console.warn("Offline ticket fallback:", err);
          const localTickets = await getTicketsLocal();
          setTickets(localTickets as SupportTicket[]);
        }

        // 2. Fetch Repairs (Firebase + Local Storage fallback)
        try {
          const repairsSnap = await getDocs(collection(db, "repairs"));
          const fetchedRepairs: Repair[] = repairsSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
          } as Repair));
          setRepairs(fetchedRepairs);
        } catch (err) {
          console.warn("Offline repair fallback:", err);
          const localRepairs = await getRepairsLocal();
          setRepairs(localRepairs as Repair[]);
        }

        // 3. Fetch IT Projects
        try {
          const projectsSnap = await getDocs(collection(db, "it_projects"));
          const fetchedProjects: ITProject[] = projectsSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
          } as ITProject));
          setProjects(fetchedProjects);
        } catch (err) {
          console.warn("Error fetching projects for global search:", err);
        }

        // 4. Fetch Users
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          const fetchedUsers: User[] = usersSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
          } as User));
          setUsers(fetchedUsers);
        } catch (err) {
          console.warn("Error fetching users for global search:", err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [isOpen]);

  // Convert raw records into normalized search items
  const allSearchItems: SearchResultItem[] = useMemo(() => {
    const items: SearchResultItem[] = [];

    // Map Tickets
    tickets.forEach(ticket => {
      const code = ticket.ticketCode || `TIC-${ticket.id.slice(0, 4).toUpperCase()}`;
      const statusVariant = 
        ticket.status === 'resolved' || ticket.status === 'closed' ? 'emerald' :
        ticket.status === 'in_progress' ? 'blue' : 'amber';

      const priorityVariant = 
        ticket.priority === 'critical' ? 'rose' :
        ticket.priority === 'high' ? 'amber' :
        ticket.priority === 'medium' ? 'blue' : 'slate';

      items.push({
        id: `ticket-${ticket.id}`,
        category: 'tickets',
        title: ticket.title || 'Untitled Ticket',
        subtitle: `${code} • Requested by ${ticket.requestUsername || 'Unknown'} (${ticket.requestDept || 'General'})`,
        code: code,
        badgeText: ticket.status?.replace('_', ' ')?.toUpperCase() || 'OPEN',
        badgeVariant: statusVariant,
        secondaryBadge: ticket.priority?.toUpperCase() || 'LOW',
        secondaryBadgeVariant: priorityVariant,
        detail: ticket.description || 'No description provided',
        targetUrl: `/tickets?search=${encodeURIComponent(code || ticket.title)}`,
        searchPayload: `${code} ${ticket.title} ${ticket.description} ${ticket.requestUsername} ${ticket.requestDept} ${ticket.priority} ${ticket.status} ${ticket.supportType}`.toLowerCase(),
        rawItem: ticket
      });
    });

    // Map Repairs
    repairs.forEach(repair => {
      const code = repair.repairCode || `REP-${repair.id.slice(0, 4).toUpperCase()}`;
      const statusVariant = 
        repair.status === 'completed' ? 'emerald' :
        repair.status === 'ongoing' ? 'blue' : 'amber';

      items.push({
        id: `repair-${repair.id}`,
        category: 'repairs',
        title: repair.title || repair.device || 'Hardware Repair',
        subtitle: `${code} • Device: ${repair.device || 'Unspecified'} ${repair.shopCenterName ? `• Center: ${repair.shopCenterName}` : ''}`,
        code: code,
        badgeText: repair.status?.toUpperCase() || 'PENDING',
        badgeVariant: statusVariant,
        detail: (repair as any).reportedIssues || `Repair tracking item for ${repair.device || 'hardware equipment'}`,
        targetUrl: `/repairs?search=${encodeURIComponent(code || repair.title || repair.device)}`,
        searchPayload: `${code} ${repair.title} ${repair.device} ${(repair as any).reportedIssues || ''} ${repair.shopCenterName || ''} ${repair.status}`.toLowerCase(),
        rawItem: repair
      });
    });

    // Map Projects
    projects.forEach(project => {
      const healthVariant = 
        project.health === 'green' ? 'emerald' :
        project.health === 'amber' ? 'amber' : 'rose';

      items.push({
        id: `project-${project.id}`,
        category: 'projects',
        title: project.title || 'Untitled Project',
        subtitle: `Dept: ${project.department || 'IT Operations'} • Sponsor: ${project.sponsorName || 'Leadership'} • Progress: ${project.progressPercent || 0}%`,
        code: `PRJ-${(project.templateUsed || 'IT').toUpperCase()}`,
        badgeText: project.status?.replace('_', ' ')?.toUpperCase() || 'ACTIVE',
        badgeVariant: project.status === 'completed' ? 'emerald' : 'blue',
        secondaryBadge: `HEALTH: ${(project.health || 'GREEN').toUpperCase()}`,
        secondaryBadgeVariant: healthVariant,
        detail: project.description || `IT project portfolio item for ${project.department || 'department'}`,
        targetUrl: `/projects?search=${encodeURIComponent(project.title)}`,
        searchPayload: `${project.title} ${project.department} ${project.sponsorName} ${project.description} ${project.templateUsed} ${project.health} ${project.status}`.toLowerCase(),
        rawItem: project
      });
    });

    // Map Users
    users.forEach(u => {
      const roleVariant = 
        u.role === 'admin' ? 'rose' :
        u.role === 'management' ? 'purple' :
        u.role === 'it_assistant' ? 'blue' : 'slate';

      const name = u.displayName || u.fullName || u.username || u.email.split('@')[0];

      items.push({
        id: `user-${u.id}`,
        category: 'users',
        title: name,
        subtitle: `${u.email} • Dept: ${u.department || 'Staff'} ${u.phone ? `• Tel: ${u.phone}` : ''}`,
        badgeText: u.role?.replace('_', ' ')?.toUpperCase() || 'STAFF',
        badgeVariant: roleVariant,
        secondaryBadge: (u.status || 'active').toUpperCase(),
        secondaryBadgeVariant: u.status === 'disabled' ? 'rose' : 'emerald',
        detail: `User account @${u.username || u.email.split('@')[0]} in department ${u.department || 'Standard Staff'}`,
        targetUrl: `/users?search=${encodeURIComponent(name || u.email)}`,
        searchPayload: `${name} ${u.username || ''} ${u.email} ${u.role} ${u.department || ''} ${u.phone || ''} ${u.status}`.toLowerCase(),
        rawItem: u
      });
    });

    return items;
  }, [tickets, repairs, projects, users]);

  // Filtered & Ranked Results
  const filteredResults = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Category filter
    let baseItems = allSearchItems;
    if (activeCategory !== 'all') {
      baseItems = allSearchItems.filter(item => item.category === activeCategory);
    }

    if (!trimmedQuery) {
      // Return top recent/active items if no search text
      return baseItems.slice(0, 12);
    }

    const searchTokens = trimmedQuery.split(/\s+/).filter(Boolean);

    const scored = baseItems.map(item => {
      let score = 0;
      const lowerTitle = item.title.toLowerCase();
      const lowerCode = (item.code || '').toLowerCase();
      const lowerSubtitle = item.subtitle.toLowerCase();
      const lowerDetail = item.detail.toLowerCase();

      // Check each word token
      const matchesAllTokens = searchTokens.every(token => {
        let tokenMatch = false;

        // Exact code match gets maximum priority
        if (lowerCode === token || lowerCode.includes(token)) {
          score += 150;
          tokenMatch = true;
        }

        // Title match
        if (lowerTitle.includes(token)) {
          score += lowerTitle.startsWith(token) ? 80 : 50;
          tokenMatch = true;
        }

        // Subtitle (requester, email, department)
        if (lowerSubtitle.includes(token)) {
          score += 30;
          tokenMatch = true;
        }

        // Detail
        if (lowerDetail.includes(token)) {
          score += 15;
          tokenMatch = true;
        }

        // General payload match
        if (item.searchPayload.includes(token)) {
          score += 10;
          tokenMatch = true;
        }

        return tokenMatch;
      });

      return { item, score, matches: matchesAllTokens };
    });

    return scored
      .filter(entry => entry.matches)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);
  }, [allSearchItems, query, activeCategory]);

  // Count items per category for tab badges
  const categoryCounts = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return {
        all: allSearchItems.length,
        tickets: tickets.length,
        repairs: repairs.length,
        projects: projects.length,
        users: users.length
      };
    }

    const searchTokens = trimmedQuery.split(/\s+/).filter(Boolean);
    const filterFn = (item: SearchResultItem) => {
      return searchTokens.every(token => item.searchPayload.includes(token));
    };

    return {
      all: allSearchItems.filter(filterFn).length,
      tickets: allSearchItems.filter(item => item.category === 'tickets' && filterFn(item)).length,
      repairs: allSearchItems.filter(item => item.category === 'repairs' && filterFn(item)).length,
      projects: allSearchItems.filter(item => item.category === 'projects' && filterFn(item)).length,
      users: allSearchItems.filter(item => item.category === 'users' && filterFn(item)).length
    };
  }, [allSearchItems, query, tickets.length, repairs.length, projects.length, users.length]);

  // Reset selected index when query or category changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  // Save recent search
  const saveSearchToRecent = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    const updated = [searchTerm.trim(), ...recentSearches.filter(s => s !== searchTerm.trim())].slice(0, 6);
    setRecentSearches(updated);
    try {
      localStorage.setItem("global_recent_searches", JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save recent search:", e);
    }
  };

  // Remove a recent search
  const removeRecentSearch = (e: React.MouseEvent, termToRemove: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== termToRemove);
    setRecentSearches(updated);
    try {
      localStorage.setItem("global_recent_searches", JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not remove recent search:", e);
    }
  };

  // Execute selection
  const handleSelectItem = (item: SearchResultItem) => {
    if (query.trim()) {
      saveSearchToRecent(query.trim());
    }
    onClose();
    navigate(item.targetUrl, {
      state: {
        searchQuery: item.code || item.title,
        highlightId: item.rawItem?.id
      }
    });
  };

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, Math.max(0, filteredResults.length - 1)));
      scrollSelectedIntoView(selectedIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      scrollSelectedIntoView(selectedIndex - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelectItem(filteredResults[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const scrollSelectedIntoView = (index: number) => {
    if (!resultsContainerRef.current) return;
    const elements = resultsContainerRef.current.querySelectorAll('[data-result-item]');
    const targetElement = elements[index] as HTMLElement;
    if (targetElement) {
      targetElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  // Category Icon helper
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'tickets':
        return <Ticket className="w-4 h-4 text-blue-500" />;
      case 'repairs':
        return <Wrench className="w-4 h-4 text-purple-500" />;
      case 'projects':
        return <FolderKanban className="w-4 h-4 text-emerald-500" />;
      case 'users':
        return <Users className="w-4 h-4 text-amber-500" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  // Badge Color Helper
  const getBadgeStyle = (variant?: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate') => {
    switch (variant) {
      case 'blue':
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case 'purple':
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case 'emerald':
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case 'amber':
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case 'rose':
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case 'slate':
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 backdrop-blur-sm bg-slate-950/60 transition-all">
          {/* Modal Overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0"
          />

          {/* Search Box Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden flex flex-col max-h-[85vh] z-10"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Search className="w-4 h-4" />
              </div>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type keyword, code (TIC-001), user, repair, or project..."
                className="flex-1 bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-medium"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Clear search query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700/60 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                title="Close search"
              >
                ESC
              </button>
            </div>

            {/* Category Filter Pills Bar */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto [scrollbar-width:none]">
              {[
                { id: 'all', label: 'All Items', icon: Layers, count: categoryCounts.all },
                { id: 'tickets', label: 'Tickets', icon: Ticket, count: categoryCounts.tickets },
                { id: 'repairs', label: 'Repairs', icon: Wrench, count: categoryCounts.repairs },
                { id: 'projects', label: 'Projects', icon: FolderKanban, count: categoryCounts.projects },
                { id: 'users', label: 'Users', icon: Users, count: categoryCounts.users },
              ].map(cat => {
                const isSelected = activeCategory === cat.id;
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id as SearchCategory)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Results Body / List */}
            <div 
              ref={resultsContainerRef}
              className="flex-1 overflow-y-auto p-2 sm:p-3 divide-y divide-slate-100 dark:divide-slate-800/50"
            >
              {/* Recent Searches Pills (when query is empty) */}
              {!query && recentSearches.length > 0 && (
                <div className="p-3 mb-2 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecentSearches([]);
                        localStorage.removeItem("global_recent_searches");
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium cursor-pointer"
                    >
                      Clear history
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map(term => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setQuery(term);
                          inputRef.current?.focus();
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-medium group transition-colors cursor-pointer"
                      >
                        <Search className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                        <span>{term}</span>
                        <span
                          onClick={(e) => removeRecentSearch(e, term)}
                          className="hover:text-rose-500 p-0.5 rounded ml-0.5"
                          title="Remove"
                        >
                          <X className="w-3 h-3 text-slate-400 group-hover:text-rose-400" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoading && filteredResults.length === 0 && (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Searching enterprise system database...</span>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && filteredResults.length === 0 && (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-1 text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No results found for &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Try checking spelling or search by ticket code (e.g. TIC-001), repair code (REP-001), user email, or project title.
                  </p>
                </div>
              )}

              {/* Result List Items */}
              {filteredResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    data-result-item
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`group flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30 shadow-sm'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Category Icon Badge */}
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      {getCategoryIcon(item.category)}
                    </div>

                    {/* Main Item Information */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {item.code && (
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                            {item.code}
                          </span>
                        )}
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </h4>
                        
                        {item.badgeText && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getBadgeStyle(item.badgeVariant)}`}>
                            {item.badgeText}
                          </span>
                        )}

                        {item.secondaryBadge && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getBadgeStyle(item.secondaryBadgeVariant)}`}>
                            {item.secondaryBadge}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1">
                        {item.subtitle}
                      </p>

                      <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1">
                        {item.detail}
                      </p>
                    </div>

                    {/* Jump Arrow / Action Indicator */}
                    <div className="flex items-center gap-1.5 shrink-0 self-center pl-2 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <span className="text-[10px] font-medium hidden sm:inline-block">Open</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom Keyboard Instructions Footer */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono shadow-2xs font-semibold">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono shadow-2xs font-semibold">↓</kbd>
                  <span>Navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono shadow-2xs font-semibold">↵ Enter</kbd>
                  <span>Select</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono shadow-2xs font-semibold">ESC</kbd>
                  <span>Close</span>
                </span>
              </div>

              <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                MTKN ITSM Global Index
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
