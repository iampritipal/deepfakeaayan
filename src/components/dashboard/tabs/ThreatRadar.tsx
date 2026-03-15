import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle,
  Clock, RefreshCw, Radio, Zap,
} from "lucide-react";
import { AudioDatabase, type AudioRecord } from "@/lib/audioDatabase";

/* ─── types ─────────────────────────────────────────────── */
interface RadarPoint {
  id: string;
  angle: number;
  distance: number;
  riskScore: number;
  label: AudioRecord["result"]["label"];
  fileName: string;
  timestamp: number;
  active: boolean;
}

/* ─── helpers ────────────────────────────────────────────── */
function recordsToPoints(records: AudioRecord[]): RadarPoint[] {
  return records.slice(0, 24).map((r, i, arr) => ({
    id: r.id,
    angle: (i / Math.max(arr.length, 1)) * 360,
    distance: 15 + (r.result.riskScore / 100) * 75,
    riskScore: r.result.riskScore,
    label: r.result.label,
    fileName: r.fileName,
    timestamp: r.timestamp,
    active: false,
  }));
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const DOT_COLOR: Record<AudioRecord["result"]["label"], { dot: string; ring: string; hex: string }> = {
  "Deepfake Detected": { dot: "#ef4444", ring: "rgba(239,68,68,0.35)",  hex: "#ef4444" },
  "Suspicious":        { dot: "#f59e0b", ring: "rgba(245,158,11,0.35)", hex: "#f59e0b" },
  "Real Voice":        { dot: "#22c55e", ring: "rgba(34,197,94,0.35)",  hex: "#22c55e" },
};

/* ─── Spectrogram canvas ─────────────────────────────────── */
function SpectrogramCanvas({ data }: { data: number[][] | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!data || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rows = data.length, cols = data[0].length;
    canvas.width = cols; canvas.height = rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = data[r][c]; // 0-1
        // Inferno-like: dark→purple→orange→yellow
        const r2 = Math.min(255, Math.floor(v * v * 255 + v * 80));
        const g2 = Math.min(255, Math.floor(v * 160));
        const b2 = Math.min(255, Math.floor((1 - v) * 200 + v * 20));
        ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
        ctx.fillRect(c, rows - 1 - r, 1, 1);
      }
    }
  }, [data]);

  if (!data) return (
    <div className="h-32 flex items-center justify-center rounded-lg bg-black/30 border border-border/40">
      <p className="text-xs font-mono text-muted-foreground/50">No spectrogram — analyse an audio file first</p>
    </div>
  );

  return (
    <div className="space-y-1">
      <canvas ref={ref} className="w-full h-32 rounded-lg" style={{ imageRendering: "pixelated" }} />
      <div className="flex justify-between px-1">
        <span className="text-[10px] font-mono text-muted-foreground/50">0 s</span>
        <span className="text-[10px] font-mono text-muted-foreground/50">Time →</span>
        <span className="text-[10px] font-mono text-muted-foreground/50">Duration</span>
      </div>
      {/* Color legend */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] font-mono text-muted-foreground/50">Low</span>
        <div className="flex-1 h-2 rounded-full" style={{
          background: "linear-gradient(to right, #0d0221, #4b0082, #ff6600, #ffff00)"
        }} />
        <span className="text-[10px] font-mono text-muted-foreground/50">High</span>
      </div>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────── */
export function ThreatRadar() {
  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [points, setPoints]   = useState<RadarPoint[]>([]);
  const [scanAngle, setScanAngle] = useState(0);
  const [lastHit, setLastHit] = useState<RadarPoint | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const scanRef = useRef(0);

  // latest spectrogram from most recent record (stored in localStorage via audioDatabase)
  const spectrogramData: number[][] | null = null; // real data comes from FileAnalysis

  const loadData = useCallback(() => {
    const all = AudioDatabase.getAll();
    setRecords(all);
    setPoints(recordsToPoints(all));
  }, []);

  useEffect(() => { loadData(); const t = setInterval(loadData, 5000); return () => clearInterval(t); }, [loadData]);

  // Sweep
  useEffect(() => {
    const id = setInterval(() => {
      setScanAngle(prev => {
        const next = (prev + 1.2) % 360;
        scanRef.current = next;
        setPoints(pts => pts.map(p => {
          const diff = Math.abs(((p.angle - next + 540) % 360) - 180);
          const hit = diff < 9;
          if (hit && p.label !== "Real Voice") setLastHit(p);
          return { ...p, active: hit };
        }));
        return next;
      });
    }, 25);
    return () => clearInterval(id);
  }, []);

  const stats = {
    total:      records.length,
    deepfake:   records.filter(r => r.result.label === "Deepfake Detected").length,
    suspicious: records.filter(r => r.result.label === "Suspicious").length,
    safe:       records.filter(r => r.result.label === "Real Voice").length,
  };

  const recent = records.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold font-mono text-foreground leading-tight">Threat Radar</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Live map of all analysed audio — each dot represents a real detection
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-white/5 hover:border-primary/30 transition-all font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {records.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-20 text-center">
          <Radio className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-mono text-muted-foreground text-sm">No detections yet</p>
          <p className="font-mono text-muted-foreground/50 text-xs mt-1">
            Analyse an audio file — results will appear here automatically
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* ── LEFT: Radar + Spectrogram ── */}
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-xl p-6">
              {/* Radar */}
              <div className="relative w-full aspect-square max-w-[520px] mx-auto select-none">

                {/* Grid rings */}
                {[20, 40, 60, 80, 100].map(s => (
                  <div key={s} className="absolute inset-0 m-auto rounded-full border border-primary/12"
                    style={{ width: `${s}%`, height: `${s}%` }} />
                ))}

                {/* Ring labels */}
                {[{ s: 20, t: "LOW" }, { s: 40, t: "MED" }, { s: 60, t: "HIGH" }].map(({ s, t }) => (
                  <span key={s} className="absolute font-mono text-[11px] font-semibold text-primary/40 pointer-events-none"
                    style={{ top: `${50 - s / 2 - 1}%`, left: "52%", transform: "translateY(-50%)" }}>
                    {t}
                  </span>
                ))}

                {/* Axis lines */}
                {[0, 30, 60, 90, 120, 150].map(a => (
                  <div key={a} className="absolute top-1/2 left-1/2 w-1/2 h-px bg-primary/8 origin-left"
                    style={{ transform: `rotate(${a}deg)` }} />
                ))}
                {[0, 30, 60, 90, 120, 150].map(a => (
                  <div key={`r${a}`} className="absolute top-1/2 left-1/2 w-1/2 h-px bg-primary/8 origin-left"
                    style={{ transform: `rotate(${a + 180}deg)` }} />
                ))}

                {/* Sweep cone */}
                <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                  <div className="absolute inset-0" style={{
                    background: `conic-gradient(from ${scanAngle - 30}deg, transparent 0deg, rgba(99,102,241,0.18) 20deg, rgba(99,102,241,0.04) 30deg, transparent 30deg)`,
                  }} />
                </div>

                {/* Sweep line */}
                <div className="absolute top-1/2 left-1/2 w-1/2 origin-left pointer-events-none"
                  style={{
                    height: "2px",
                    background: "linear-gradient(to right, rgba(129,140,248,0.95), transparent)",
                    transform: `rotate(${scanAngle}deg)`,
                    filter: "drop-shadow(0 0 4px rgba(129,140,248,0.8))",
                  }} />

                {/* Detection points */}
                {points.map(p => {
                  const rad = (p.angle * Math.PI) / 180;
                  const r = p.distance / 2;
                  const x = Math.cos(rad) * r;
                  const y = Math.sin(rad) * r;
                  const c = DOT_COLOR[p.label];
                  const isHovered = hoveredId === p.id;
                  return (
                    <div key={p.id}
                      className="absolute top-1/2 left-1/2 cursor-pointer z-10"
                      style={{ transform: `translate(calc(-50% + ${x}%), calc(-50% + ${y}%))` }}
                      onMouseEnter={() => setHoveredId(p.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Ping ring when active */}
                      {p.active && (
                        <div className="absolute -inset-2 rounded-full animate-ping"
                          style={{ backgroundColor: c.ring }} />
                      )}
                      {/* Dot */}
                      <div className="w-3.5 h-3.5 rounded-full transition-all duration-150"
                        style={{
                          backgroundColor: c.dot,
                          boxShadow: p.active || isHovered ? `0 0 10px ${c.dot}, 0 0 20px ${c.ring}` : `0 0 4px ${c.ring}`,
                          transform: p.active ? "scale(1.5)" : "scale(1)",
                          opacity: p.active ? 1 : 0.7,
                        }} />
                      {/* Hover tooltip */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none"
                          >
                            <div className="bg-[#0d1117] border border-border rounded-lg px-3 py-2 text-[11px] font-mono whitespace-nowrap shadow-2xl min-w-[160px]">
                              <p className="text-foreground font-semibold truncate max-w-[160px]">{p.fileName}</p>
                              <p className="mt-0.5" style={{ color: c.dot }}>{p.label}</p>
                              <p className="text-muted-foreground">Risk: {p.riskScore.toFixed(0)}%</p>
                              <p className="text-muted-foreground/60">{timeAgo(p.timestamp)}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* Centre */}
                <div className="absolute top-1/2 left-1/2 w-3.5 h-3.5 -mt-[7px] -ml-[7px] rounded-full bg-primary z-20"
                  style={{ boxShadow: "0 0 12px rgba(129,140,248,0.8)" }} />
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-5 mt-5 pt-4 border-t border-border/50">
                {[
                  { color: "#ef4444", label: "Deepfake Detection" },
                  { color: "#f59e0b", label: "Suspicious Pattern" },
                  { color: "#22c55e", label: "Real Voice" },
                  { color: "#818cf8", label: "Distance = Risk %" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: l.color, boxShadow: `0 0 6px ${l.color}` }} />
                    <span className="font-mono text-[12px] text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Spectrogram */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[14px] font-mono font-semibold text-foreground">Frequency Spectrogram</p>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">Time × Frequency energy heatmap</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                  <span className="text-[10px]">Freq (Hz) ↑</span>
                </div>
              </div>
              <SpectrogramCanvas data={spectrogramData} />
            </div>
          </div>

          {/* ── RIGHT: Metrics + Alert + Feed ── */}
          <div className="flex flex-col gap-4">

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Scans",  value: stats.total,      color: "#818cf8", bg: "rgba(129,140,248,0.08)", icon: Activity,     desc: "last 24 hours" },
                { label: "Deepfakes",    value: stats.deepfake,   color: "#ef4444", bg: "rgba(239,68,68,0.08)",   icon: XCircle,      desc: "detected" },
                { label: "Suspicious",   value: stats.suspicious, color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  icon: AlertTriangle,desc: "flagged" },
                { label: "Safe",         value: stats.safe,       color: "#22c55e", bg: "rgba(34,197,94,0.08)",   icon: CheckCircle2, desc: "verified" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border p-4 transition-all hover:border-white/10"
                  style={{ background: s.bg }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <s.icon className="w-3.5 h-3.5 shrink-0" style={{ color: s.color }} />
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider truncate">{s.label}</span>
                  </div>
                  <div className="font-mono text-[28px] font-bold leading-none" style={{ color: s.color }}>{s.value}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">{s.desc}</div>
                </div>
              ))}
            </div>

            {/* Alert box */}
            <AnimatePresence mode="wait">
              {lastHit && (
                <motion.div
                  key={lastHit.id}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  className="rounded-xl border p-4"
                  style={{
                    background: lastHit.label === "Deepfake Detected" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                    borderColor: lastHit.label === "Deepfake Detected" ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.35)",
                    boxShadow: lastHit.label === "Deepfake Detected" ? "0 0 20px rgba(239,68,68,0.12)" : "0 0 20px rgba(245,158,11,0.12)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: lastHit.label === "Deepfake Detected" ? "#ef4444" : "#f59e0b" }} />
                    <span className="font-mono text-[13px] font-bold" style={{ color: lastHit.label === "Deepfake Detected" ? "#ef4444" : "#f59e0b" }}>
                      {lastHit.label}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground">File</span>
                      <span className="font-mono text-[11px] text-foreground truncate max-w-[140px]">{lastHit.fileName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground">Risk Score</span>
                      <span className="font-mono text-[13px] font-bold" style={{ color: lastHit.label === "Deepfake Detected" ? "#ef4444" : "#f59e0b" }}>
                        {lastHit.riskScore.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground">Detected</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{timeAgo(lastHit.timestamp)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recent detections */}
            <div className="bg-card border border-border rounded-xl p-4 flex-1">
              <p className="font-mono text-[12px] font-semibold text-foreground uppercase tracking-wider mb-3">Recent Detections</p>
              {recent.length === 0 ? (
                <p className="font-mono text-[11px] text-muted-foreground/50">No records yet.</p>
              ) : (
                <div className="space-y-0">
                  {recent.map((r, i) => {
                    const c = DOT_COLOR[r.result.label];
                    return (
                      <div key={r.id}>
                        <div className="flex items-start gap-3 py-3">
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                            style={{ backgroundColor: c.dot, boxShadow: `0 0 5px ${c.dot}` }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-[12px] text-foreground font-medium truncate">{r.fileName}</p>
                            <p className="font-mono text-[11px] mt-0.5" style={{ color: c.dot }}>{r.result.label}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                Risk: <span className="font-semibold text-foreground">{r.result.riskScore.toFixed(0)}%</span>
                              </span>
                              <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/60">
                                <Clock className="w-2.5 h-2.5" />{timeAgo(r.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {i < recent.length - 1 && <div className="h-px bg-border/40" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scan status */}
            <div className="rounded-xl border border-primary/25 bg-primary/8 p-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <motion.div className="w-2 h-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }} />
                <span className="font-mono text-[11px] text-primary font-semibold tracking-wider">
                  SCANNING · {stats.total} RECORDS MAPPED
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
