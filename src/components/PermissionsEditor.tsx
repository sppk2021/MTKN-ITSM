import React from "react";
import { 
  TabKey, 
  UserPermissions, 
  DEFAULT_ROLE_PERMISSIONS, 
  TAB_LABELS, 
  UserRole 
} from "../types";
import { 
  Check, 
  Square, 
  CheckSquare, 
  Eye, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  ShieldCheck, 
  ShieldAlert,
  Sparkles,
  LayoutDashboard,
  Users,
  BarChart3,
  CalendarDays,
  Wrench,
  Ticket,
  Server,
  Globe
} from "lucide-react";

interface PermissionsEditorProps {
  permissions: UserPermissions;
  onChange: (updated: UserPermissions) => void;
  currentRole?: string;
  disabled?: boolean;
}

const TAB_ICONS: Record<TabKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  users: Users,
  reports: BarChart3,
  calendar: CalendarDays,
  repairs: Wrench,
  tickets: Ticket,
  software: Server,
  isp: Globe,
};

const ALL_TABS: TabKey[] = [
  'dashboard',
  'tickets',
  'repairs',
  'calendar',
  'software',
  'isp',
  'reports',
  'users',
];

export function PermissionsEditor({
  permissions,
  onChange,
  currentRole = 'staff',
  disabled = false,
}: PermissionsEditorProps) {
  const togglePermission = (tab: TabKey, action: 'view' | 'edit' | 'delete') => {
    if (disabled) return;
    const current = permissions[tab] || { view: false, edit: false, delete: false };
    const nextVal = !current[action];
    
    // If enabling edit or delete, view should automatically be enabled
    const updatedTab = {
      ...current,
      [action]: nextVal,
    };
    if ((action === 'edit' || action === 'delete') && nextVal) {
      updatedTab.view = true;
    }
    // If disabling view, edit and delete should automatically be disabled
    if (action === 'view' && !nextVal) {
      updatedTab.edit = false;
      updatedTab.delete = false;
    }

    onChange({
      ...permissions,
      [tab]: updatedTab,
    });
  };

  const toggleAllAction = (action: 'view' | 'edit' | 'delete') => {
    if (disabled) return;
    const allChecked = ALL_TABS.every(tab => permissions[tab]?.[action]);
    const nextVal = !allChecked;

    const nextState = { ...permissions };
    ALL_TABS.forEach(tab => {
      const current = nextState[tab] || { view: false, edit: false, delete: false };
      const updated = { ...current, [action]: nextVal };
      if ((action === 'edit' || action === 'delete') && nextVal) {
        updated.view = true;
      }
      if (action === 'view' && !nextVal) {
        updated.edit = false;
        updated.delete = false;
      }
      nextState[tab] = updated;
    });

    onChange(nextState);
  };

  const toggleRow = (tab: TabKey) => {
    if (disabled) return;
    const current = permissions[tab] || { view: false, edit: false, delete: false };
    const allActive = current.view && current.edit && current.delete;
    onChange({
      ...permissions,
      [tab]: {
        view: !allActive,
        edit: !allActive,
        delete: !allActive,
      },
    });
  };

  const applyPreset = (preset: 'all' | 'none' | 'view_only' | 'role_default') => {
    if (disabled) return;
    if (preset === 'all') {
      const nextState: any = {};
      ALL_TABS.forEach(tab => {
        nextState[tab] = { view: true, edit: true, delete: true };
      });
      onChange(nextState);
    } else if (preset === 'none') {
      const nextState: any = {};
      ALL_TABS.forEach(tab => {
        nextState[tab] = { view: false, edit: false, delete: false };
      });
      onChange(nextState);
    } else if (preset === 'view_only') {
      const nextState: any = {};
      ALL_TABS.forEach(tab => {
        nextState[tab] = { view: true, edit: false, delete: false };
      });
      onChange(nextState);
    } else if (preset === 'role_default') {
      const roleKey = (currentRole in DEFAULT_ROLE_PERMISSIONS ? currentRole : 'staff') as UserRole;
      onChange(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[roleKey])));
    }
  };

  return (
    <div className="space-y-3">
      {/* Quick Action Presets Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Quick Presets:</span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset('all')}
            disabled={disabled}
            className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 font-medium transition-colors cursor-pointer text-[11px]"
          >
            Grant All
          </button>
          <button
            type="button"
            onClick={() => applyPreset('view_only')}
            disabled={disabled}
            className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 font-medium transition-colors cursor-pointer text-[11px]"
          >
            View Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset('role_default')}
            disabled={disabled}
            className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded font-medium transition-colors cursor-pointer text-[11px] flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Role Defaults</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('none')}
            disabled={disabled}
            className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-medium transition-colors cursor-pointer text-[11px]"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Permissions Grid Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
              <th className="px-3 py-2.5">Tab / Module</th>
              <th className="px-2.5 py-2.5 text-center w-20">
                <button
                  type="button"
                  onClick={() => toggleAllAction('view')}
                  disabled={disabled}
                  className="hover:text-blue-700 font-bold flex items-center justify-center gap-1 w-full text-center group cursor-pointer"
                  title="Toggle all View permissions"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                  <span>View</span>
                </button>
              </th>
              <th className="px-2.5 py-2.5 text-center w-20">
                <button
                  type="button"
                  onClick={() => toggleAllAction('edit')}
                  disabled={disabled}
                  className="hover:text-amber-700 font-bold flex items-center justify-center gap-1 w-full text-center group cursor-pointer"
                  title="Toggle all Edit permissions"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                  <span>Edit</span>
                </button>
              </th>
              <th className="px-2.5 py-2.5 text-center w-20">
                <button
                  type="button"
                  onClick={() => toggleAllAction('delete')}
                  disabled={disabled}
                  className="hover:text-red-700 font-bold flex items-center justify-center gap-1 w-full text-center group cursor-pointer"
                  title="Toggle all Delete permissions"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-600" />
                  <span>Delete</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ALL_TABS.map((tab) => {
              const Icon = TAB_ICONS[tab];
              const perm = permissions[tab] || { view: false, edit: false, delete: false };
              const isAllChecked = perm.view && perm.edit && perm.delete;
              const hasSomeChecked = perm.view || perm.edit || perm.delete;

              return (
                <tr 
                  key={tab} 
                  className={`hover:bg-slate-50/70 transition-colors ${
                    hasSomeChecked ? 'bg-white' : 'bg-slate-50/30'
                  }`}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleRow(tab)}
                      disabled={disabled}
                      className="flex items-center gap-2 text-left w-full group cursor-pointer"
                      title="Click to toggle all permissions for this tab"
                    >
                      <div className={`p-1 rounded ${
                        hasSomeChecked ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className={`font-semibold transition-colors ${
                        hasSomeChecked ? 'text-slate-800' : 'text-slate-500'
                      }`}>
                        {TAB_LABELS[tab]}
                      </span>
                    </button>
                  </td>

                  {/* View Checkbox */}
                  <td className="px-2.5 py-2 text-center">
                    <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!perm.view}
                        onChange={() => togglePermission(tab, 'view')}
                        disabled={disabled}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 focus:ring-1 cursor-pointer accent-blue-600"
                      />
                    </label>
                  </td>

                  {/* Edit Checkbox */}
                  <td className="px-2.5 py-2 text-center">
                    <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!perm.edit}
                        onChange={() => togglePermission(tab, 'edit')}
                        disabled={disabled}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 focus:ring-1 cursor-pointer accent-amber-600"
                      />
                    </label>
                  </td>

                  {/* Delete Checkbox */}
                  <td className="px-2.5 py-2 text-center">
                    <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!perm.delete}
                        onChange={() => togglePermission(tab, 'delete')}
                        disabled={disabled}
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 focus:ring-1 cursor-pointer accent-red-600"
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function formatPermissionsSummary(permissions?: UserPermissions): { label: string; tone: 'full' | 'partial' | 'limited' | 'none' } {
  if (!permissions) return { label: 'Role Defaults', tone: 'partial' };

  const tabs = Object.keys(permissions) as TabKey[];
  const totalTabs = tabs.length;
  const viewCount = tabs.filter(t => permissions[t]?.view).length;
  const editCount = tabs.filter(t => permissions[t]?.edit).length;
  const deleteCount = tabs.filter(t => permissions[t]?.delete).length;

  if (viewCount === totalTabs && editCount === totalTabs && deleteCount === totalTabs) {
    return { label: 'Full Access (All)', tone: 'full' };
  }
  if (viewCount === 0) {
    return { label: 'No Tab Access', tone: 'none' };
  }
  return {
    label: `${viewCount} View • ${editCount} Edit • ${deleteCount} Delete`,
    tone: 'partial'
  };
}
