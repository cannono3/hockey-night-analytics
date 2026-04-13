"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
}

const SUGGESTED = [
  "How are the Bruins performing this season?",
  "Who are the top point scorers in the NHL right now?",
  "Compare the Bruins to the rest of the Atlantic division",
  "Which Bruins players are having breakout seasons?",
  "What's Boston's home vs away record?",
];

const TOOL_LABELS: Record<string, string> = {
  get_standings: "Fetching standings...",
  get_team_stats: "Loading team stats...",
  get_team_schedule: "Pulling schedule data...",
  get_league_leaders: "Getting league leaders...",
  get_player_stats: "Looking up player...",
  search_player: "Searching players...",
};

export default function AnalystPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);
    setToolCalls([]);

    try {
      const apiMessages = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      const calls: string[] = [];

      if (!reader) throw new Error("No stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "tool_call") {
              calls.push(parsed.tool);
              setToolCalls([...calls]);
            } else if (parsed.type === "text") {
              assistantText = parsed.content;
            } else if (parsed.type === "error") {
              throw new Error(parsed.message);
            }
          } catch { /* skip parse errors */ }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantText, toolCalls: calls },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Unknown error"}` },
      ]);
    } finally {
      setLoading(false);
      setToolCalls([]);
    }
  }

  function renderMarkdown(text: string) {
    // Basic markdown rendering
    return text
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-[var(--accent)] mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-[var(--text)] mt-5 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-[var(--text)] mt-5 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--text)] font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li class="flex gap-2 mb-1"><span class="text-[var(--accent)] mt-1">•</span><span>$1</span></li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="flex gap-2 mb-1"><span class="text-[var(--accent)] font-mono text-xs mt-1">$1.</span><span>$2</span></li>')
      .replace(/`(.+?)`/g, '<code class="bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded text-xs font-mono text-[var(--accent)]">$1</code>')
      .replace(/\n\n/g, '<br/><br/>');
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--text)]">AI Analyst</h1>
        <p className="text-[var(--muted)] mt-1 text-sm">
          Ask anything about the NHL — the AI fetches live data before answering
        </p>
      </div>

      {/* Chat area */}
      <div className="stat-card mb-4 min-h-[400px] max-h-[600px] overflow-y-auto flex flex-col gap-4 p-5">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <Bot size={24} className="text-[var(--accent)]" />
            </div>
            <p className="text-[var(--text)] font-semibold">Your Hockey Analyst</p>
            <p className="text-[var(--muted)] text-sm max-w-sm">
              Ask me anything about the NHL. I&apos;ll pull live stats and give you real analysis.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-black" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-black font-medium rounded-tr-sm"
                  : "bg-[var(--bg-elevated)] text-[var(--text)] rounded-tl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {[...new Set(msg.toolCalls)].map((tc) => (
                        <span key={tc} className="text-xs bg-[var(--bg-card)] text-[var(--muted)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                          {tc.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    className="prose-sm"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                </>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={14} className="text-[var(--muted)]" />
              </div>
            )}
          </div>
        ))}

        {/* Loading state */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-black" />
            </div>
            <div className="bg-[var(--bg-elevated)] rounded-2xl rounded-tl-sm px-4 py-3">
              {toolCalls.length > 0 ? (
                <div className="space-y-1">
                  {[...new Set(toolCalls)].map((tc) => (
                    <div key={tc} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <Loader2 size={11} className="animate-spin text-[var(--accent)]" />
                      {TOOL_LABELS[tc] ?? tc}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Loader2 size={11} className="animate-spin text-[var(--accent)]" />
                  Thinking...
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about teams, players, stats, trends..."
          disabled={loading}
          className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-[var(--accent)] hover:bg-[var(--accent-dark)] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-4 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
