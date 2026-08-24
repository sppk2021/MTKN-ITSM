import React, { useRef } from "react";
import { X, Upload, Sparkles, Shield, Server, Wrench, Globe, Ticket, Rocket, Building, Terminal, Smartphone, BarChart3 } from "lucide-react";
import { cn } from "../lib/utils";

interface AppLogoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLogo: string | null;
  onSelectLogo: (logoDataOrSvg: string) => void;
}

const PRESET_ICONS = [
  { id: 'shield', name: 'IT Security Shield', icon: Shield, bg: 'from-blue-600 to-indigo-600', textColor: 'text-white' },
  { id: 'server', name: 'Server Infrastructure', icon: Server, bg: 'from-slate-800 to-slate-900', textColor: 'text-blue-400' },
  { id: 'wrench', name: 'Hardware & Repairs', icon: Wrench, bg: 'from-amber-600 to-orange-600', textColor: 'text-white' },
  { id: 'globe', name: 'ISP & Network', icon: Globe, bg: 'from-emerald-600 to-teal-600', textColor: 'text-white' },
  { id: 'ticket', name: 'Support Tickets', icon: Ticket, bg: 'from-purple-600 to-indigo-600', textColor: 'text-white' },
  { id: 'rocket', name: 'High Performance', icon: Rocket, bg: 'from-rose-600 to-pink-600', textColor: 'text-white' },
  { id: 'building', name: 'Enterprise Hub', icon: Building, bg: 'from-cyan-600 to-blue-600', textColor: 'text-white' },
  { id: 'smartphone', name: 'Mobile App Icon', icon: Smartphone, bg: 'from-violet-600 to-purple-600', textColor: 'text-white' },
  { id: 'terminal', name: 'System Console', icon: Terminal, bg: 'from-slate-900 to-zinc-900', textColor: 'text-emerald-400' },
  { id: 'analytics', name: 'Metrics & Reports', icon: BarChart3, bg: 'from-blue-700 to-cyan-700', textColor: 'text-white' },
];

export function AppLogoSelectorModal({ isOpen, onClose, currentLogo, onSelectLogo }: AppLogoSelectorModalProps) {
  const [selectedTab, setSelectedTab] = React.useState<'presets' | 'upload'>('presets');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image must be smaller than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          onSelectLogo(reader.result as string);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePresetSelect = (preset: typeof PRESET_ICONS[0]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 180, 180);
      if (preset.id === 'shield') { gradient.addColorStop(0, '#2563eb'); gradient.addColorStop(1, '#4f46e5'); }
      else if (preset.id === 'server') { gradient.addColorStop(0, '#1e293b'); gradient.addColorStop(1, '#0f172a'); }
      else if (preset.id === 'wrench') { gradient.addColorStop(0, '#d97706'); gradient.addColorStop(1, '#c2410c'); }
      else if (preset.id === 'globe') { gradient.addColorStop(0, '#059669'); gradient.addColorStop(1, '#0d9488'); }
      else if (preset.id === 'ticket') { gradient.addColorStop(0, '#9333ea'); gradient.addColorStop(1, '#4f46e5'); }
      else if (preset.id === 'rocket') { gradient.addColorStop(0, '#e11d48'); gradient.addColorStop(1, '#db2777'); }
      else if (preset.id === 'building') { gradient.addColorStop(0, '#0891b2'); gradient.addColorStop(1, '#2563eb'); }
      else if (preset.id === 'smartphone') { gradient.addColorStop(0, '#7c3aed'); gradient.addColorStop(1, '#9333ea'); }
      else if (preset.id === 'terminal') { gradient.addColorStop(0, '#0f172a'); gradient.addColorStop(1, '#18181b'); }
      else { gradient.addColorStop(0, '#1d4ed8'); gradient.addColorStop(1, '#0891b2'); }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(0, 0, 180, 180, 36);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MT', 90, 90);

      const dataUrl = canvas.toDataURL('image/png');
      onSelectLogo(dataUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">iOS & Android App Logo & Icon</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose a professional app icon or upload custom branding</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-6 bg-slate-50/50 dark:bg-slate-900/30">
          <button
            onClick={() => setSelectedTab('presets')}
            className={cn(
              "py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer",
              selectedTab === 'presets'
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            )}
          >
            Curated App Icons (iOS & Android)
          </button>
          <button
            onClick={() => setSelectedTab('upload')}
            className={cn(
              "py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer",
              selectedTab === 'upload'
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            )}
          >
            Upload Custom Image
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {selectedTab === 'presets' ? (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Select one of these ready-made professional app icons optimized for iPhone home screen, Android app drawer, and browser tab:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESET_ICONS.map((preset) => {
                  const IconComp = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className="group flex flex-col items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-slate-800/80 hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm hover:shadow-md text-center"
                    >
                      <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md mb-2 group-hover:scale-105 transition-transform", preset.bg, preset.textColor)}>
                        <IconComp className="w-7 h-7" />
                      </div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Upload Logo Image File</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-6">
                PNG, JPG or SVG. Recommended square aspect ratio (e.g., 512x512px for iOS & Android app icon standards). Max size 2MB.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Browse Files
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">Instant sync across iOS, Android & Web PWA</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
