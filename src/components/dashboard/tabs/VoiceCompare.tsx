import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Users, CheckCircle2, XCircle, AlertTriangle,
  HelpCircle, FileAudio, Loader2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { compareVoices, type VoiceCompareResult } from "@/lib/audioAnalysis";

/* ── types ── */
type MetricKey = keyof VoiceCompareResult["breakdown"];

/* ── metric config ── */
const METRICS: {
  key: MetricKey; label: string;
  fmt: (v: number) => string;
  tooltip: string;
}[] = [
  {
    key: "spectralCentroid",
    label: "Spectral Centroid",
    fmt: v => v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`,
    tooltip: "The center of mass of the frequency spectrum — higher values indicate brighter, more high-frequency sound.",
  },
  {
    key: "zeroCrossingRate",
    label: "Zero Crossing Rate",
    fmt: v => v.toFixed(4),
    tooltip: "How often the audio signal crosses zero amplitude — relates to noisiness and consonant sounds.",
  },
  {
    key: "pitchVariation",
    label: "Pitch Variation",
    fmt: v => `${Math.round(v)} Hz`,
    tooltip: "Standard deviation of the fundamental frequency — measures how much the speaker's pitch fluctuates.",
  },
  {
    key: "harmonicRatio",
    label: "Harmonic Ratio",
    fmt: v => v.toFixed(3),
    tooltip: "Ratio of harmonic energy to total energy — higher values indicate a cleaner, more tonal voice.",
  },
  {
    key: "energyProfile",
    label: "Energy Profile",
    fmt: v => v.toExponential(2),
    tooltip: "Average signal power per frame — reflects the overall loudness and recording level.",
  },
];

/* ── verdict config ── */
const VERDICT_CFG = {
  "Same Speaker":      { icon: CheckCircle2,  color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.3)",   glow: "0 0 32px rgba(34,197,94,0.18)",   label: "Same Speaker Detected",      confidence: "Very High" },
  "Likely Same":       { icon: CheckCircle2,  color: "#86efac", bg: "rgba(134,239,172,0.08)", border: "rgba(134,239,172,0.3)", glow: "0 0 32px rgba(134,239,172,0.15)", label: "Likely Same Speaker",        confidence: "High"      },
  "Uncertain":         { icon: HelpCircle,    color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.3)",  glow: "0 0 32px rgba(245,158,11,0.15)",  label: "Inconclusive Result",        confidence: "Medium"    },
  "Different Speaker": { icon: XCircle,       color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   glow: "0 0 32px rgba(239,68,68,0.18)",   label: "Different Speaker Detected", confidence: "Very High" },
} as const;

const INTERPRETATIONS: Record<VoiceCompareResult["verdict"], string> = {
  "Same Speaker":      "The acoustic patterns across all measured features are highly consistent between the two recordings. The spectral characteristics, pitch behaviour, and harmonic structure strongly indicate that both samples were produced by the same speaker. Minor variations are within the expected range for natural speech.",
  "Likely Same":       "The majority of acoustic features align closely between the two samples. The recordings are most likely from the same speaker, with small differences attributable to changes in recording environment, microphone, or the speaker's emotional state at the time of recording.",
  "Uncertain":         "The acoustic features show partial overlap but also notable differences. This may indicate the same speaker recorded under significantly different conditions, or two speakers with similar vocal characteristics. Additional samples would improve accuracy.",
  "Different Speaker": "Significant divergence was detected across multiple acoustic dimensions including spectral centroid, pitch variation, and harmonic structure. The evidence strongly suggests these recordings originate from two distinct speakers.",
};

/* ── mini waveform drawn on canvas ── */
function WaveformPreview({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ab = await file.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buf = await ctx.decodeAudioData(ab);
        await ctx.close();
        if (cancelled || !canvasRef.current) return;
        const data = buf.getChannelData(0);
        const canvas = canvasRef.current;
        const W = canvas.width; const H = canvas.height;
        const c = canvas.getContext("2d")!;
        c.clearRect(0, 0, W, H);
        const step = Math.floor(data.length / W);
        const grad = c.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, "#818cf8"); grad.addColorStop(1, "#a78bfa");
        c.strokeStyle = grad; c.lineWidth = 1.5;
        c.beginPath();
        for (let x = 0; x < W; x++) {
          const slice = data.slice(x * step, (x + 1) * step);
          const max = slice.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
          const y = (1 - max) * H / 2;
          x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
        // mirror
        c.beginPath();
        for (let x = 0; x < W; x++) {
          const slice = data.slice(x * step, (x + 1) * step);
          const max = slice.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
          const y = (1 + max) * H / 2;
          x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
      } catch { /* ignore decode errors */ }
    })();
    return () => { cancelled = true; };
  }, [file]);

  return <canvas ref={canvasRef} width={300} height={48} className="w-full h-12 rounded" />;
}

/* ── upload box ── */
function UploadBox({ slot, file, onFile }: { slot: "A" | "B"; file: File | null; onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  const id = `vc-slot-${slot}`;

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
        drag  ? "border-primary bg-primary/10 scale-[1.015]" :
        file  ? "border-primary/40 bg-primary/5" :
                "border-border hover:border-primary/35 hover:bg-white/[0.02]"
      }`}
    >
      <input type="file" accept="audio/*" id={id}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

      {file ? (
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <FileAudio className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-mono text-foreground font-semibold truncate">{file.name}</p>
              <p className="text-[11px] font-mono text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · {file.type || "audio"}
              </p>
            </div>
          </div>
          <WaveformPreview file={file} />
          <p className="text-[10px] font-mono text-primary/50 text-center uppercase tracking-wider">Click to replace</p>
        </div>
      ) : (
        <div className="p-8 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-mono text-muted-foreground">Drag & drop or click to upload</p>
            <p className="text-[11px] font-mono text-muted-foreground/50 mt-1">WAV · MP3 · OGG · M4A · Max 50 MB</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── score bar ── */
function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2.5 w-full">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
          initial={{ width: 0 }} animate={{ width: `${score}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }} />
      </div>
      <span className="text-[12px] font-mono font-bold w-9 text-right shrink-0" style={{ color }}>{score}%</span>
    </div>
  );
}

/* ── tooltip ── */
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info className="w-3 h-3 text-muted-foreground/40 hover:text-muted-foreground cursor-help" />
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg bg-[#1a1f2e] border border-border text-[11px] font-mono text-muted-foreground leading-relaxed z-50 pointer-events-none shadow-xl"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ── main component ── */
export function VoiceCompare() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [result, setResult] = useState<VoiceCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!file1 || !file2) return;
    setLoading(true); setResult(null); setError(null);
    try {
      setResult(await compareVoices(file1, file2));
    } catch (e: any) {
      setError(e?.message ?? "Failed to analyze audio. Ensure both files are valid audio.");
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? VERDICT_CFG[result.verdict] : null;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold font-mono text-foreground leading-tight">Voice Comparison</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Upload two audio samples — the AI extracts real acoustic features to determine speaker identity
        </p>
      </div>

      {/* Upload row */}
      <div className="grid grid-cols-2 gap-5">
        {(["A", "B"] as const).map(slot => (
          <div key={slot} className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center text-[11px] font-mono font-bold text-primary">{slot}</span>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Voice Sample {slot}</p>
            </div>
            <UploadBox slot={slot} file={slot === "A" ? file1 : file2} onFile={slot === "A" ? setFile1 : setFile2} />
          </div>
        ))}
      </div>

      {/* Compare button */}
      <Button
        onClick={handleCompare}
        disabled={!file1 || !file2 || loading}
        className="w-full h-12 font-mono text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 disabled:opacity-40 transition-all"
        size="lg"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing voices…</>
          : <><Users className="w-4 h-4 mr-2" />Compare Voices</>}
      </Button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm font-mono text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && cfg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* ── Verdict hero ── */}
            <motion.div
              className="rounded-xl border-2 p-6"
              style={{ background: cfg.bg, borderColor: cfg.border, boxShadow: cfg.glow }}
              initial={{ scale: 0.97 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
            >
              <div className="flex items-center gap-5 mb-5">
                <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${cfg.color}18`, border: `2px solid ${cfg.color}35` }}>
                  <cfg.icon className="w-8 h-8" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Verdict</p>
                  <h2 className="text-[22px] font-bold font-mono leading-tight" style={{ color: cfg.color }}>
                    ✔ {cfg.label}
                  </h2>
                  <p className="text-[12px] font-mono text-muted-foreground mt-0.5">
                    Confidence: <span className="font-semibold" style={{ color: cfg.color }}>{cfg.confidence}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Similarity Score</p>
                  <p className="text-[42px] font-bold font-mono leading-none" style={{ color: cfg.color }}>
                    {result.similarity}%
                  </p>
                </div>
              </div>

              <div className="h-2.5 bg-black/25 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})` }}
                  initial={{ width: 0 }} animate={{ width: `${result.similarity}%` }}
                  transition={{ duration: 1.3, ease: "easeOut", delay: 0.15 }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] font-mono text-muted-foreground/60">0% — No Match</span>
                <span className="text-[10px] font-mono text-muted-foreground/60">100% — Identical</span>
              </div>
            </motion.div>

            {/* ── Feature breakdown ── */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <p className="text-[13px] font-mono font-semibold text-foreground">Acoustic Feature Breakdown</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">Per-feature comparison between Sample A and Sample B</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-white/[0.015]">
                      {["Feature", "Sample A", "Sample B", "Difference", "Match Score"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-mono text-muted-foreground uppercase tracking-[0.1em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map(({ key, label, fmt, tooltip }, i) => {
                      const row = result.breakdown[key];
                      const diff = Math.abs(row.a - row.b);
                      const diffFmt = fmt(diff);
                      return (
                        <motion.tr key={key}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="border-b border-border/40 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-mono text-foreground font-medium">{label}</span>
                              <Tooltip text={tooltip} />
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[13px] font-mono text-foreground">{fmt(row.a)}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[13px] font-mono text-foreground">{fmt(row.b)}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[12px] font-mono ${row.score >= 75 ? "text-green-400" : row.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                              Δ {diffFmt}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 min-w-[160px]">
                            <ScoreBar score={row.score} />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Interpretation ── */}
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-[13px] font-mono font-semibold text-foreground mb-3">Analysis Interpretation</p>
              <p className="text-[14px] font-mono text-foreground/75 leading-[1.75]">
                {INTERPRETATIONS[result.verdict]}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
