import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Clock,
  Search, Filter, Download, Eye, RefreshCw, FileText,
} from "lucide-react";
import { AudioDatabase, type AudioRecord } from "@/lib/audioDatabase";
import { Button } from "@/components/ui/button";

/* ── helpers ── */
function fmtDate(ts: number) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const RESULT_CFG = {
  "Real Voice":        { icon: CheckCircle2, color: "#22c55e", bg: "bg-green-500/15",  border: "border-green-500/30",  text: "text-green-400"  },
  "Deepfake Detected": { icon: XCircle,      color: "#ef4444", bg: "bg-red-500/15",    border: "border-red-500/30",    text: "text-red-400"    },
  "Suspicious":        { icon: AlertTriangle,color: "#f59e0b", bg: "bg-yellow-500/15", border: "border-yellow-500/30", text: "text-yellow-400" },
} as const;

const THREAT_CFG = {
  LOW:    { bg: "bg-green-500/10",  border: "border-green-500/25",  text: "text-green-400"  },
  MEDIUM: { bg: "bg-yellow-500/10", border: "border-yellow-500/25", text: "text-yellow-400" },
  HIGH:   { bg: "bg-red-500/10",    border: "border-red-500/25",    text: "text-red-400"    },
} as const;

function getThreat(score: number): keyof typeof THREAT_CFG {
  if (score < 30) return "LOW";
  if (score < 60) return "MEDIUM";
  return "HIGH";
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "#22c55e" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-mono font-semibold w-12 text-right" style={{ color }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function exportCSV(records: AudioRecord[]) {
  const header = "Timestamp,File Name,Result,Threat Level,Confidence,Risk Score\n";
  const rows = records.map(r =>
    `"${fmtDate(r.timestamp)}","${r.fileName}","${r.result.label}","${getThreat(r.result.riskScore)}","${r.result.confidence.toFixed(1)}%","${r.result.riskScore.toFixed(1)}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "security_logs.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ── component ── */
export function SecurityLogs() {
  const [search, setSearch] = useState("");
  const [threatFilter, setThreatFilter] = useState<"ALL" | "LOW" | "MEDIUM" | "HIGH">("ALL");
  const allRecords = AudioDatabase.getAll();

  const records = useMemo(() => {
    return allRecords.filter(r => {
      const matchSearch =
        r.fileName.toLowerCase().includes(search.toLowerCase()) ||
        r.result.label.toLowerCase().includes(search.toLowerCase());
      const matchThreat = threatFilter === "ALL" || getThreat(r.result.riskScore) === threatFilter;
      return matchSearch && matchThreat;
    });
  }, [allRecords, search, threatFilter]);

  const stats = {
    total: allRecords.length,
    deepfakes: allRecords.filter(r => r.result.label === "Deepfake Detected").length,
    high: allRecords.filter(r => getThreat(r.result.riskScore) === "HIGH").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold font-mono text-foreground leading-tight">Security Logs</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Complete audit trail of all audio analyses and detections
          </p>
        </div>
        <Button
          onClick={() => exportCSV(records)}
          variant="outline"
          size="sm"
          className="font-mono text-xs gap-2 border-border hover:border-primary/40 hover:bg-primary/5"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: "Total Scans",      value: stats.total,     color: "text-primary"      },
          { label: "Deepfakes Found",  value: stats.deepfakes, color: "text-red-400"      },
          { label: "High Threat",      value: stats.high,      color: "text-orange-400"   },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-card border border-border">
            <span className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</span>
            <span className="text-xs font-mono text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search file name or result…"
            className="w-full pl-9 pr-4 py-2 text-sm font-mono bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1">
          {(["ALL", "LOW", "MEDIUM", "HIGH"] as const).map(t => (
            <button
              key={t}
              onClick={() => setThreatFilter(t)}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                threatFilter === t
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                {["Timestamp", "File Name", "Detection Result", "Threat Level", "Confidence", "Action"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-[11px] font-mono text-muted-foreground uppercase tracking-[0.12em] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-mono text-muted-foreground">
                          {search || threatFilter !== "ALL" ? "No logs match your filters" : "No security logs yet"}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground/50">
                          {search || threatFilter !== "ALL" ? "Try adjusting your search or filter" : "Upload or record audio to generate logs"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((record, i) => {
                    const res = RESULT_CFG[record.result.label];
                    const ResIcon = res.icon;
                    const threat = getThreat(record.result.riskScore);
                    const thr = THREAT_CFG[threat];
                    return (
                      <motion.tr
                        key={record.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="border-b border-border/50 hover:bg-white/[0.025] transition-colors group"
                      >
                        {/* Timestamp */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                            <span className="text-[13px] font-mono text-muted-foreground">{fmtDate(record.timestamp)}</span>
                          </div>
                        </td>

                        {/* File Name */}
                        <td className="px-5 py-3.5 max-w-[180px]">
                          <p className="text-[13px] font-mono text-foreground truncate">{record.fileName}</p>
                          <p className="text-[11px] font-mono text-muted-foreground/60">{fmtSize(record.fileSize)}</p>
                        </td>

                        {/* Detection Result badge */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] font-mono font-semibold ${res.bg} ${res.border} ${res.text}`}>
                            <ResIcon className="w-3 h-3" />
                            {record.result.label}
                          </span>
                        </td>

                        {/* Threat Level badge */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-mono font-bold tracking-wider ${thr.bg} ${thr.border} ${thr.text}`}>
                            {threat}
                          </span>
                        </td>

                        {/* Confidence bar */}
                        <td className="px-5 py-3.5">
                          <ConfidenceBar value={record.result.confidence} />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="View Analysis">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Download Report">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Recheck">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {records.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-white/[0.01] flex items-center justify-between">
            <p className="text-[11px] font-mono text-muted-foreground">
              Showing {records.length} of {allRecords.length} records
            </p>
            <p className="text-[11px] font-mono text-muted-foreground/50">
              Sorted by most recent
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
