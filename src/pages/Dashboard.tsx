import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/dashboard/Navbar";
import { Activity, FileAudio, BarChart3, Shield, Users, Radar, PieChart } from "lucide-react";
import { RealTimeAnalysis } from "@/components/dashboard/tabs/RealTimeAnalysis";
import { FileAnalysis } from "@/components/dashboard/tabs/FileAnalysis";
import { VoiceAnalytics } from "@/components/dashboard/tabs/VoiceAnalytics";
import { SecurityLogs } from "@/components/dashboard/tabs/SecurityLogs";
import { VoiceCompare } from "@/components/dashboard/tabs/VoiceCompare";
import { ThreatRadar } from "@/components/dashboard/tabs/ThreatRadar";
import { StatisticsDashboard } from "@/components/dashboard/tabs/StatisticsDashboard";

type TabType = "realtime" | "file" | "compare" | "logs" | "radar" | "analytics" | "statistics";

const NAV_GROUPS = [
  {
    label: "Analysis",
    items: [
      { id: "realtime" as TabType, label: "Real-time Analysis", icon: Activity },
      { id: "file"     as TabType, label: "File Analysis",      icon: FileAudio },
      { id: "compare"  as TabType, label: "Voice Compare",      icon: Users },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { id: "logs"  as TabType, label: "Security Logs", icon: Shield },
      { id: "radar" as TabType, label: "Threat Radar",  icon: Radar },
    ],
  },
  {
    label: "Insights",
    items: [
      { id: "analytics"  as TabType, label: "Voice Analytics", icon: BarChart3 },
      { id: "statistics" as TabType, label: "Statistics",       icon: PieChart },
    ],
  },
];

const TAB_COMPONENTS: Record<TabType, JSX.Element> = {
  realtime:   <RealTimeAnalysis />,
  file:       <FileAnalysis />,
  compare:    <VoiceCompare />,
  logs:       <SecurityLogs />,
  radar:      <ThreatRadar />,
  analytics:  <VoiceAnalytics />,
  statistics: <StatisticsDashboard />,
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("realtime");

  return (
    <div className="min-h-screen bg-background cyber-grid">
      <Navbar />

      <div className="flex">
        {/* ── Sidebar ── */}
        <motion.aside
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-60 border-r border-border bg-[#0b0d14]/80 backdrop-blur-xl min-h-[calc(100vh-57px)] sticky top-[57px] flex flex-col"
        >
          <nav className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-[0.18em] px-3 mb-2">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ id, label, icon: Icon }) => {
                    const active = activeTab === id;
                    return (
                      <motion.button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        whileTap={{ scale: 0.97 }}
                        className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-[13px] transition-all duration-150 group ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        }`}
                      >
                        {/* Left accent border */}
                        {active && (
                          <motion.span
                            layoutId="sidebar-active"
                            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-primary"
                            style={{ boxShadow: "0 0 8px rgba(129,140,248,0.7)" }}
                          />
                        )}
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                        <span className="truncate">{label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom status */}
          <div className="px-4 py-4 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
              <span className="text-[11px] font-mono text-green-400">System Active</span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground/50 mt-1">
              Last scan: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </motion.aside>

        {/* ── Main Content ── */}
        <div className="flex-1 p-8 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {TAB_COMPONENTS[activeTab]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
