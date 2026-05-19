"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Play, X, Zap, AlertCircle } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { ReActBlock } from "@/components/ReActBlock";
import { OutputCard } from "@/components/OutputCard";
import { TypingIndicator } from "@/components/TypingIndicator";
import { AgentFlowCanvas } from "@/components/AgentFlowCanvas";
import { AgentEvent, Domain, Mode, OutputPayload, Scenario } from "@/lib/types";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TYPING_LABELS: Record<string, string> = {
  thought: "Agent reasoning...",
  action: "Calling tool...",
  observation: "Processing results...",
  synthesis: "Synthesising...",
  output: "Generating output...",
};

type StreamEvent = AgentEvent | { type: "done" };

export default function Home() {
  const [mode, setMode] = useState<Mode>("review_denial");
  const [domain, setDomain] = useState<Domain>("auto");
  const [docText, setDocText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const [output, setOutput] = useState<OutputPayload | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      streamRef.current?.scrollTo({
        top: streamRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  };

  const clearAll = useCallback(() => {
    setEvents([]);
    setOutput(null);
    setTypingLabel(null);
    setError(null);
    setDocText("");
    setSelectedFile(null);
    setActiveScenario(null);
  }, []);

  const downloadOutput = useCallback(() => {
    if (!output) return;
    const dataStr = JSON.stringify(output, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `authagent-output-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [output]);

  const handleScenario = useCallback((s: Scenario) => {
    setActiveScenario(s.key);
    setDocText(s.text);
    setMode(s.mode);
    setDomain(s.domain);
    setSelectedFile(null);
    setEvents([]);
    setOutput(null);
    setError(null);
  }, []);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setActiveScenario(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const runAgent = async () => {
    if (isRunning) return;
    if (!docText.trim() && !selectedFile) return;

    setIsRunning(true);
    setEvents([]);
    setOutput(null);
    setError(null);
    setTypingLabel(null);

    try {
      let response: Response;

      if (selectedFile) {
        const form = new FormData();
        form.append("file", selectedFile);
        form.append("user_context", docText);
        form.append("mode", mode);
        response = await fetch(`${API_URL}/run/file`, {
          method: "POST",
          body: form,
        });
      } else {
        response = await fetch(`${API_URL}/run/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_text: docText,
            user_context: "",
            mode,
          }),
        });
      }

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ detail: "Request failed" }));
        setError(err.detail || "Backend error — is the server running?");
        setIsRunning(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw) as StreamEvent;

            if (event.type === "done") {
              setTypingLabel(null);
              break;
            }

            if (event.type === "output") {
              setTypingLabel(null);
              try {
                // Parse the nested JSON payload
                const s = event.content.indexOf("{");
                const e = event.content.lastIndexOf("}") + 1;
                if (s >= 0) {
                  const payload = JSON.parse(
                    event.content.slice(s, e),
                  ) as OutputPayload;
                  setOutput(payload);
                }
              } catch {
                // Output parsing failed — still show the block
              }
              setEvents((prev) => [...prev, event]);
              scrollToBottom();
              continue;
            }

            // Show typing indicator for next block type
            setTypingLabel(TYPING_LABELS[event.type] || "Working...");
            await new Promise((r) => setTimeout(r, 200));
            setTypingLabel(null);

            setEvents((prev) => [...prev, event]);
            scrollToBottom();
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(
        `Connection failed: ${msg}. Make sure the backend is running on ${API_URL}`,
      );
    }

    setIsRunning(false);
    setTypingLabel(null);
  };

  const isEmpty = events.length === 0 && !output && !error;

  return (
    <div
      className="relative z-10 grid h-screen"
      style={{ gridTemplateColumns: "280px 1fr", gridTemplateRows: "60px 1fr" }}
    >
      {/* ── TOPBAR ───────────────────────────── */}
      <header className="col-span-2 bg-ink-2 border-b border-white/[0.06] flex items-center px-6 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet flex items-center justify-center text-white font-mono text-[13px] font-medium">
            A
          </div>
          <span className="font-serif text-[22px] text-snow tracking-tight">
            AuthAgent
          </span>
        </div>
        <span className="text-[10px] font-mono tracking-widest uppercase text-ghost border border-white/10 px-2 py-0.5 rounded">
          approval intelligence · v1.0
        </span>

        <div className="ml-auto flex items-center gap-3">
          {/* Backend URL indicator */}
          <div className="flex items-center gap-1.5 bg-ink-3 border border-white/10 rounded-lg px-3 py-1.5">
            <span className="text-[9px] font-mono text-ghost">API</span>
            <span className="text-[11px] font-mono text-fog">{API_URL}</span>
          </div>

          {/* Live status */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isRunning ? "bg-violet animate-pulse" : "bg-jade pulse-jade",
              )}
            />
            <span className={isRunning ? "text-violet-soft" : "text-jade"}>
              {isRunning ? "Running..." : "Ready"}
            </span>
          </div>
        </div>
      </header>

      {/* ── SIDEBAR ──────────────────────────── */}
      <Sidebar
        mode={mode}
        domain={domain}
        onModeChange={setMode}
        onDomainChange={setDomain}
        onScenario={handleScenario}
        activeScenario={activeScenario}
      />

      {/* ── MAIN ─────────────────────────────── */}
      <main className="flex flex-col bg-ink min-h-0 overflow-y-auto">
        {/* Hero */}
        <div className="px-8 pt-6 pb-5 border-b border-white/[0.06] bg-gradient-to-b from-ink-2 to-ink relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(124,111,212,0.08) 0%, transparent 70%)",
            }}
          />
          <div className="text-[10px] font-mono tracking-widest uppercase text-violet-soft mb-2">
            AI Agent Olympics — Milan AI Week 2026
          </div>
          <h1 className="font-serif text-[30px] font-light tracking-tight text-snow leading-[1.1] mb-2">
            The <em className="italic text-violet-soft">translation layer</em>
            <br />
            between you and every wall.
          </h1>
          <p className="text-[13px] text-fog max-w-lg leading-relaxed">
            Upload a denial letter or describe your request. Four specialist AI
            agents audit your evidence, identify every gap, and draft the
            document that gets you approved.
          </p>
        </div>

        {/* Input zone */}
        <div className="px-8 py-4 border-b border-white/[0.06] bg-ink-2">
          <div className="flex gap-3 items-end">
            {/* Text area */}
            <div className="flex-1">
              <div className="text-[9px] font-mono tracking-widest uppercase text-ghost mb-1.5">
                Document text — paste denial letter or describe your case
              </div>
              <textarea
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                placeholder="Paste a denial letter, or describe what you're requesting approval for and what documents you have..."
                className="w-full bg-ink-3 border border-white/10 rounded-lg px-4 py-3 text-[13px] text-snow leading-relaxed resize-none outline-none h-[88px] transition-colors placeholder:text-ghost placeholder:italic focus:border-violet"
              />
            </div>

            {/* File upload */}
            <div className="flex-shrink-0">
              <div className="text-[9px] font-mono tracking-widest uppercase text-ghost mb-1.5">
                Or upload file
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "border border-dashed rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-all min-w-[180px] h-[88px]",
                  isDragging || selectedFile
                    ? "border-jade bg-jade/5"
                    : "border-white/10 bg-ink-3 hover:border-white/20",
                )}
              >
                <Upload
                  size={18}
                  className={selectedFile ? "text-jade" : "text-ghost"}
                />
                <div>
                  <div
                    className={cn(
                      "text-[12px] font-medium",
                      selectedFile ? "text-jade" : "text-fog",
                    )}
                  >
                    {selectedFile
                      ? selectedFile.name.slice(0, 20) +
                        (selectedFile.name.length > 20 ? "…" : "")
                      : "Drop PDF / image"}
                  </div>
                  <div className="text-[10px] text-ghost mt-0.5">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(0)}KB`
                      : "Denial letters, scans"}
                  </div>
                </div>
                {selectedFile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="ml-auto text-ghost hover:text-fog"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={runAgent}
              disabled={isRunning || (!docText.trim() && !selectedFile)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-[13px] transition-all",
                "bg-violet text-white",
                isRunning || (!docText.trim() && !selectedFile)
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-violet/80 hover:shadow-[0_0_20px_rgba(124,111,212,0.3)] hover:-translate-y-px",
              )}
            >
              {isRunning ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play size={13} fill="currentColor" />
              )}
              {isRunning ? "Running agents..." : "Run agents"}
            </button>

            <button
              onClick={clearAll}
              className="px-4 py-2.5 rounded-lg border border-white/10 text-[13px] text-ghost hover:text-fog hover:border-white/20 transition-all"
            >
              Clear
            </button>

            <span className="ml-auto text-[10px] font-mono text-ghost">
              ReAct trace streams live · 4 specialist agents · Gemini-powered
            </span>
          </div>
        </div>

        {/* Live workspace */}
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5 px-6 py-5 auto-rows-max h-screen">
          <section className="flex h-full min-h-0 flex-col rounded-xl border border-white/[0.07] bg-ink-2 shadow-[0_18px_70px_rgba(0,0,0,0.22)] overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3 flex-shrink-0">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  isRunning
                    ? "bg-violet animate-pulse"
                    : output
                      ? "bg-jade"
                      : "bg-ghost",
                )}
              />
              <div>
                <div className="text-[13px] font-semibold text-snow">
                  Realtime ReAct Stream
                </div>
                <div className="text-[10px] font-mono text-ghost">
                  SSE data from FastAPI, rendered as each event arrives
                </div>
              </div>
              <div className="ml-auto text-[10px] font-mono text-fog">
                {events.length} events
              </div>
            </div>

            <div
              ref={streamRef}
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
            >
              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-crimson/5 border border-crimson/20 rounded-xl text-[13px] text-crimson">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium mb-0.5">Connection error</div>
                    <div className="text-[12px] opacity-80">{error}</div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {isEmpty && (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-ink-3 border border-white/[0.06] flex items-center justify-center">
                    <Zap size={28} className="text-ghost" />
                  </div>
                  <div>
                    <div className="font-serif text-[22px] font-light text-fog italic mb-2">
                      Waiting for your case
                    </div>
                    <div className="text-[13px] text-ghost max-w-xs leading-relaxed">
                      Load a scenario or paste your document. Four specialist
                      agents will reason through it step by step — every thought
                      visible.
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {[
                      "Healthcare PA",
                      "Visa Applications",
                      "SME Loans",
                      "Grants",
                      "Insurance Claims",
                    ].map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono px-2.5 py-1 rounded border border-white/[0.06] text-ghost"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Step progress */}
              {events.length > 0 && (
                <div className="flex rounded-lg overflow-hidden border border-white/[0.06] bg-ink-2 flex-shrink-0">
                  {[
                    "Vision OCR",
                    "CriteriaAgent",
                    "AuditAgent",
                    "DraftingAgent",
                    "Output",
                  ].map((step, i) => {
                    const done = output !== null ? true : events.length > i * 2;
                    const active =
                      !done &&
                      events.length > 0 &&
                      events.length <= (i + 1) * 2;
                    return (
                      <div
                        key={step}
                        className={cn(
                          "flex-1 py-2 text-center text-[9px] font-mono tracking-wider uppercase border-r border-white/[0.06] last:border-r-0 transition-all",
                          done
                            ? "text-jade bg-jade/5"
                            : active
                              ? "text-violet-soft bg-violet-dim"
                              : "text-ghost",
                        )}
                      >
                        {done ? "✓ " : ""}
                        {step}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ReAct blocks */}
              {events.map((ev, i) => {
                const eventKey = `${i}-${ev.type}-${ev.agent}-${ev.title.replace(/\s+/g, "_")}`;
                return (
                  ev.type !== "output" && (
                    <ReActBlock key={eventKey} event={ev} index={i} />
                  )
                );
              })}

              {/* Typing indicator */}
              {typingLabel && <TypingIndicator label={typingLabel} />}

              {/* Output card */}
              {output && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={downloadOutput}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-jade/10 border border-jade/30 text-[12px] text-jade hover:bg-jade/20 transition-all"
                    >
                      <Zap size={13} />
                      Download output
                    </button>
                  </div>
                  <OutputCard payload={output} onNewCase={clearAll} />
                </div>
              )}
            </div>
          </section>

          <AgentFlowCanvas
            events={events}
            isRunning={isRunning}
            output={output}
            className="h-full"
          />
        </div>
      </main>
    </div>
  );
}
