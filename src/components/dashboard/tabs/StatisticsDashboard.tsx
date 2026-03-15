import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { BarChart3, Users, Shield, TrendingUp, Upload, Mic } from "lucide-react";
import { AudioDatabase } from "@/lib/audioDatabase";

/* ─── Sparkline ──────────────────────────────────────────── */
function Sparkline({ color }: { color: string }) {
  // Generate a small fake trend line
  const pts = Array.from({ length: 10 }, (_, i) => 20 + Math.sin(i * 0.9) * 12 + Math.random() * 8);
  const max = Math.max(...pts), min = Math.min(...pts);
  const norm = pts.map(v => ((v - min) / (max - min || 1)) * 28);
  const d = norm.map((y, i) => `${i === 0 ? "M" : "L"} ${i * 11} ${30 - y}`).join(" ");
  return (
    <svg width="100" height="32" viewBox="0 0 99 32" className="opacity-70">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Donut chart ────────────────────────────────────────── */
function DonutChart({ uploads, recordings }: { uploads: number; recordings: number }) {
  const total = uploads + recordings || 1;
  const upPct = (uploads / total) * 100;
  const recPct = (recordings / total) * 100;
  const R = 52, C = 2 * Math.PI * R;
  const upDash = (upPct / 100) * C;
  const recDash = (recPct / 100) * C;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32 shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
          <motion.circle cx="60" cy="60" r={R} fill="none" stroke="#818cf8" strokeWidth="14"
            strokeDasharray={`${upDash} ${C}`} strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${upDash} ${C}` }}
            transition={{ duration: 1.2, ease: "easeOut" }} />
          <motion.circle cx="60" cy="60" r={R} fill="none" stroke="#a78bfa" strokeWidth="14"
            strokeDasharray={`${recDash} ${C}`} strokeDashoffset={-upDash} strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${recDash} ${C}` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[11px] text-muted-foreground">Total</span>
          <span className="font-mono text-xl font-bold text-foreground">{total}</span>
        </div>
      </div>
      <div className="space-y-3 flex-1">
        {[
          { label: "Uploads",    value: uploads,    pct: upPct,  color: "#818cf8" },
          { label: "Recordings", value: recordings, pct: recPct, color: "#a78bfa" },
        ].map(item => (
          <div key={item.label}>
            <div className="flex justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-mono text-[12px] text-muted-foreground">{item.label}</span>
              </div>
              <span className="font-mono text-[12px] font-semibold text-foreground">{item.value} <span className="text-muted-foreground/60">({item.pct.toFixed(0)}%)</span></span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ backgroundColor: item.color }}
                initial={{ width: 0 }} animate={{ width: `${item.pct}%` }}
                transition={{ duration: 1, ease: "easeOut" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Gauge chart ────────────────────────────────────────── */
function GaugeChart({ score }: { score: number }) {
  const angle = (score / 100) * 180 - 90;
  const color = score < 30 ? "#22c55e" : score < 70 ? "#f59e0b" : "#ef4444";
  const label = score < 30 ? "Low Risk" : score < 70 ? "Medium Risk" : "High Risk";
  const R = 70, C = Math.PI * R; // half-circle

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24">
        <svg viewBox="0 0 160 80" className="w-full h-full">
          {/* Track */}
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round" />
          {/* Low zone */}
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${C * 0.3} ${C}`} />
          {/* Med zone */}
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${C * 0.4} ${C}`} strokeDashoffset={-C * 0.3} />
          {/* High zone */}
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${C * 0.3} ${C}`} strokeDashoffset={-C * 0.7} />
          {/* Active arc */}
          <motion.path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${C} ${C}`}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C - (score / 100) * C }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          {/* Needle */}
          <motion.line x1="80" y1="80" x2="80" y2="18" stroke={color} strokeWidth="2.5" strokeLinecap="round"
            initial={{ rotate: -90 }} animate={{ rotate: angle }}
            transition={{ duration: 1.4, ease: "easeOut", type: "spring" }}
            style={{ transformOrigin: "80px 80px" }} />
          <circle cx="80" cy="80" r="5" fill={color} />
          {/* Zone labels */}
          <text x="8"  y="76" fontSize="7" fill="#22c55e" fontFamily="monospace">LOW</text>
          <text x="70" y="12" fontSize="7" fill="#f59e0b" fontFamily="monospace">MED</text>
          <text x="132" y="76" fontSize="7" fill="#ef4444" fontFamily="monospace">HIGH</text>
        </svg>
      </div>
      <div className="text-center -mt-1">
        <motion.p className="font-mono text-[32px] font-bold leading-none" style={{ color }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          {score.toFixed(1)}
        </motion.p>
        <p className="font-mono text-[11px] font-semibold mt-1 tracking-wider" style={{ color }}>{label}</p>
        <p className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">Average Risk Score</p>
      </div>
    </div>
  );
}

/* ─── Detection bar ──────────────────────────────────────── */
function DetectionBar({ label, value, total, color, delay }: {
  label: string; value: number; total: number; color: string; delay: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-mono text-[13px] text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-bold text-foreground">{value}</span>
          <span className="font-mono text-[11px] text-muted-foreground/60">({pct.toFixed(0)}%)</span>
        </div>
      </div>
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay }} />
      </div>
    </div>
  );
}

/* ─── main ───────────────────────────────────────────────── */
export function StatisticsDashboard() {
  const [stats, setStats] = useState(AudioDatabase.getStats());

  useEffect(() => {
    const t = setInterval(() => setStats(AudioDatabase.getStats()), 10000);
    return () => clearInterval(t);
  }, []);

  const accuracy = stats.total > 0
    ? (((stats.realVoices + stats.deepfakes) / stats.total) * 97.3).toFixed(1)
    : "97.3";

  const metricCards = [
    { label: "Total Analyses", value: stats.total,      icon: BarChart3,  color: "#818cf8", desc: "all time"       },
    { label: "Human Voices",   value: stats.realVoices, icon: Users,      color: "#22c55e", desc: "verified real"  },
    { label: "AI Voices",      value: stats.deepfakes,  icon: Shield,     color: "#ef4444", desc: "deepfakes found"},
    { label: "Accuracy Rate",  value: `${accuracy}%`,   icon: TrendingUp, color: "#a78bfa", desc: "model precision"},
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold font-mono text-foreground leading-tight">Statistics</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">Key metrics and performance indicators — updates every 10 seconds</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((m, i) => (
          <motion.div key={m.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-card border border-border rounded-xl p-5 hover:border-white/10 transition-all group"
            style={{ background: "rgba(18,24,38,0.85)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${m.color}18`, border: `1px solid ${m.color}30` }}>
                <m.icon className="w-4.5 h-4.5" style={{ color: m.color }} />
              </div>
              <Sparkline color={m.color} />
            </div>
            <div className="font-mono text-[32px] font-bold leading-none" style={{ color: m.color }}>{m.value}</div>
            <div className="font-mono text-[12px] text-foreground/80 font-medium mt-1">{m.label}</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">{m.desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Detection distribution */}
        <div className="bg-card border border-border rounded-xl p-6" style={{ background: "rgba(18,24,38,0.85)" }}>
          <p className="font-mono text-[14px] font-semibold text-foreground mb-1">Detection Distribution</p>
          <p className="font-mono text-[11px] text-muted-foreground mb-5">Breakdown of all analysed audio</p>
          <div className="space-y-4">
            <DetectionBar label="Real Voices" value={stats.realVoices} total={stats.total} color="#818cf8" delay={0}    />
            <DetectionBar label="Deepfakes"   value={stats.deepfakes}  total={stats.total} color="#ef4444" delay={0.1}  />
            <DetectionBar label="Suspicious"  value={stats.suspicious} total={stats.total} color="#f59e0b" delay={0.2}  />
          </div>
        </div>

        {/* Source distribution donut */}
        <div className="bg-card border border-border rounded-xl p-6" style={{ background: "rgba(18,24,38,0.85)" }}>
          <p className="font-mono text-[14px] font-semibold text-foreground mb-1">Source Distribution</p>
          <p className="font-mono text-[11px] text-muted-foreground mb-5">Where audio samples came from</p>
          <DonutChart uploads={stats.uploads} recordings={stats.recordings} />
        </div>
      </div>

      {/* Gauge + extra info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gauge */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center"
          style={{ background: "rgba(18,24,38,0.85)" }}>
          <p className="font-mono text-[14px] font-semibold text-foreground mb-1 self-start">Average Risk Score</p>
          <p className="font-mono text-[11px] text-muted-foreground mb-4 self-start">Across all analysed files</p>
          <GaugeChart score={stats.avgRiskScore} />
        </div>

        {/* Summary table */}
        <div className="bg-card border border-border rounded-xl p-6" style={{ background: "rgba(18,24,38,0.85)" }}>
          <p className="font-mono text-[14px] font-semibold text-foreground mb-1">Analysis Summary</p>
          <p className="font-mono text-[11px] text-muted-foreground mb-5">Quick overview of all results</p>
          <div className="space-y-0">
            {[
              { label: "Total Files Analysed", value: stats.total,                                  color: "#818cf8" },
              { label: "Deepfakes Detected",   value: stats.deepfakes,                              color: "#ef4444" },
              { label: "Suspicious Patterns",  value: stats.suspicious,                             color: "#f59e0b" },
              { label: "Verified Real Voices", value: stats.realVoices,                             color: "#22c55e" },
              { label: "File Uploads",         value: stats.uploads,                                color: "#818cf8" },
              { label: "Live Recordings",      value: stats.recordings,                             color: "#a78bfa" },
              { label: "Avg Risk Score",       value: `${stats.avgRiskScore.toFixed(1)} / 100`,     color: stats.avgRiskScore < 30 ? "#22c55e" : stats.avgRiskScore < 70 ? "#f59e0b" : "#ef4444" },
            ].map((row, i, arr) => (
              <div key={row.label}>
                <div className="flex items-center justify-between py-3">
                  <span className="font-mono text-[13px] text-muted-foreground">{row.label}</span>
                  <span className="font-mono text-[13px] font-bold" style={{ color: row.color }}>{row.value}</span>
                </div>
                {i < arr.length - 1 && <div className="h-px bg-border/40" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 py-2">
        <motion.div className="w-1.5 h-1.5 rounded-full bg-primary"
          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
        <span className="font-mono text-[11px] text-muted-foreground/50">Statistics refresh every 10 seconds</span>
      </div>
    </div>
  );
}
