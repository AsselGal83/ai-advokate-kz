import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SYSTEM_PROMPT = `Ты — AI_Advocate_KZ, профессиональный правовой помощник адвоката Асель Галиевой (г. Петропавловск, СКО, Казахстан).

РОЛЬ И КОНТЕКСТ:
- Работаешь с адвокатом с 19-летним стажем государственной службы, бывшим старшим судебным исполнителем
- Специализация: исполнительное производство, гражданское право, административное право, взыскание задолженности, алименты, банкротство физических лиц, государственные закупки
- Слоган практики: «Закон · Защита · Результат»

ЯЗЫК: Отвечай только на русском языке.

ОБЯЗАТЕЛЬНАЯ СТРУКТУРА ОТВЕТА для правовых вопросов:
1. **Норма закона** — точные ссылки на статьи (ГК РК, ГПК РК, Закон об исполнительном производстве и статусе судебных исполнителей, НК РК и т.д.)
2. **Правовой анализ** — практический разбор с учётом законодательства РК
3. **Судебная практика** — если имеется (нормативные постановления Верховного суда, примеры)
4. **Вывод и практические действия** — конкретные шаги

РЕЖИМЫ РАБОТЫ:
- [ПРАВОВОЙ АНАЛИЗ] — анализ ситуации со ссылками на нормы
- [СОСТАВИТЬ ДОКУМЕНТ] — составление процессуальных документов готовых к подаче
- [РАССЧИТАТЬ СРОКИ] — расчёт процессуальных сроков
- [ОЦЕНКА РИСКОВ] — оценка правовых рисков позиции
- [РЕЖИМ СУДЬЯ] — анализ с позиции суда
- [РЕЖИМ ОППОНЕНТ] — анализ контраргументов противной стороны

При составлении документов используй профессиональные процессуальные формулировки. Документ должен быть готов к подаче.
Запрещено давать общие ответы без ссылок на нормы РК. Ты работаешь с профессиональным адвокатом.`;

const MODES = [
  { id: "auto", label: "Авто", icon: "⚡", prefix: "" },
  { id: "analysis", label: "Анализ", icon: "⚖️", prefix: "[ПРАВОВОЙ АНАЛИЗ] " },
  { id: "document", label: "Документ", icon: "📄", prefix: "[СОСТАВИТЬ ДОКУМЕНТ] " },
  { id: "deadlines", label: "Сроки", icon: "📅", prefix: "[РАССЧИТАТЬ СРОКИ] " },
  { id: "risks", label: "Риски", icon: "🔴", prefix: "[ОЦЕНКА РИСКОВ] " },
  { id: "judge", label: "Судья", icon: "🏛️", prefix: "[РЕЖИМ СУДЬЯ] " },
  { id: "opponent", label: "Оппонент", icon: "🎯", prefix: "[РЕЖИМ ОППОНЕНТ] " },
];

const STATUS_COLORS = { "активное": "#2a7a4a", "завершено": "#4a6a9a", "приостановлено": "#8a6a2a" };
const gold = "#c9a84c";
const darkBg = "#0a0e14";
const panelBg = "#0d1219";
const borderCol = "#1a2535";
const textMain = "#dde0e4";
const textMuted = "#4a6a8a";
const modeColor = (m) => ({ auto: "#3a6a9a", analysis: "#3a7a5a", document: "#6a5a9a", deadlines: "#8a6a2a", risks: "#9a3a3a", judge: "#3a5a9a", opponent: "#9a5a2a" }[m] || "#3a6a9a");

export default function App() {
  const [view, setView] = useState("chat");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("auto");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cases, setCases] = useState([]);
  const [caseForm, setCaseForm] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { loadChats(); loadCases(); }, []);
  useEffect(() => { if (activeChatId) loadMessages(activeChatId); }, [activeChatId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const loadChats = async () => {
    const { data } = await supabase.from("chats").select("*").order("created_at", { ascending: false });
    setChats(data || []);
  };

  const loadMessages = async (chatId) => {
    const { data } = await supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at");
    setMessages(data || []);
  };

  const loadCases = async () => {
    const { data } = await supabase.from("cases").select("*").order("created_at", { ascending: false });
    setCases(data || []);
  };

  const newChat = async () => {
    const title = "Новый чат " + new Date().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const { data } = await supabase.from("chats").insert({ title }).select().single();
    if (!data) return;
    setChats(prev => [data, ...prev]);
    setActiveChatId(data.id);
    setMessages([]);
    setView("chat");
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    await supabase.from("chats").delete().eq("id", id);
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) { setActiveChatId(null); setMessages([]); }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    let chatId = activeChatId;
    if (!chatId) {
      const title = text.slice(0, 55) + (text.length > 55 ? "…" : "");
      const { data } = await supabase.from("chats").insert({ title }).select().single();
      if (!data) return;
      chatId = data.id;
      setActiveChatId(chatId);
      setChats(prev => [data, ...prev]);
    }

    const modeObj = MODES.find(m => m.id === mode);
    const fullText = modeObj.prefix + text;

    const { data: userMsg } = await supabase.from("messages").insert({ chat_id: chatId, role: "user", content: fullText }).select().single();
    const newMsgs = [...messages, { ...userMsg, display: text, mode }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = newMsgs.map(m => ({ role: m.role, content: m.content }));
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, system: SYSTEM_PROMPT, messages: apiMessages }),
      });
      const data = await response.json();
      const assistantText = data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "Ошибка ответа";
      const { data: aMsg } = await supabase.from("messages").insert({ chat_id: chatId, role: "assistant", content: assistantText }).select().single();
      setMessages(prev => [...prev, aMsg]);

      if (messages.length === 0) {
        const title = text.slice(0, 55) + (text.length > 55 ? "…" : "");
        await supabase.from("chats").update({ title }).eq("id", chatId);
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c));
      }
    } catch {
      setMessages(prev => [...prev, { id: "err", role: "error", content: "Ошибка соединения. Попробуйте ещё раз." }]);
    } finally {
      setLoading(false);
    }
  };

  const saveCase = async () => {
    if (!caseForm?.title) return;
    if (caseForm.id) {
      await supabase.from("cases").update(caseForm).eq("id", caseForm.id);
      setCases(prev => prev.map(c => c.id === caseForm.id ? caseForm : c));
    } else {
      const { data } = await supabase.from("cases").insert(caseForm).select().single();
      if (data) setCases(prev => [data, ...prev]);
    }
    setCaseForm(null);
  };

  const deleteCase = async (id) => {
    await supabase.from("cases").delete().eq("id", id);
    setCases(prev => prev.filter(c => c.id !== id));
    setCaseForm(null);
  };

  const formatText = (text) => text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={j} style={{ color: "#e0c87a" }}>{p.slice(2, -2)}</strong> : p
    );
    if (line.startsWith("# ")) return <div key={i} style={{ color: gold, fontWeight: 700, fontSize: "15px", margin: "10px 0 4px" }}>{line.slice(2)}</div>;
    if (line.startsWith("## ")) return <div key={i} style={{ color: "#b09040", fontWeight: 600, fontSize: "14px", margin: "8px 0 3px" }}>{line.slice(3)}</div>;
    if (line.match(/^\d+\.\s/)) return <div key={i} style={{ display: "flex", gap: "8px", margin: "3px 0" }}><span style={{ color: gold, minWidth: "18px", fontWeight: 700 }}>{line.match(/^\d+/)[0]}.</span><span>{parts.slice(1)}</span></div>;
    if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ display: "flex", gap: "8px", margin: "2px 0" }}><span style={{ color: gold }}>·</span><span>{parts.slice(1)}</span></div>;
    if (line === "") return <div key={i} style={{ height: "7px" }} />;
    return <div key={i} style={{ margin: "2px 0" }}>{parts}</div>;
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: darkBg, color: textMain, fontFamily: "'Georgia', serif", overflow: "hidden" }}>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{ width: "240px", flexShrink: 0, background: panelBg, borderRight: `1px solid ${borderCol}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 14px 12px", borderBottom: `1px solid ${borderCol}` }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: gold, letterSpacing: "0.5px" }}>AI_Advocate_KZ</div>
            <div style={{ fontSize: "10px", color: textMuted, fontStyle: "italic", marginTop: "2px" }}>Закон · Защита · Результат</div>
          </div>

          <div style={{ display: "flex", gap: "4px", padding: "10px 10px 6px" }}>
            {[["chat", "💬", "Чаты"], ["cases", "📁", "Дела"]].map(([v, icon, label]) => (
              <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "6px", borderRadius: "5px", border: "none", cursor: "pointer", fontSize: "11px", fontFamily: "sans-serif", background: view === v ? "#1a2a3a" : "transparent", color: view === v ? textMain : textMuted }}>{icon} {label}</button>
            ))}
          </div>

          {view === "chat" && <>
            <button onClick={newChat} style={{ margin: "0 10px 8px", padding: "7px", borderRadius: "6px", background: "#1a3a2a", border: "1px solid #2a5a3a", color: "#7acf8a", cursor: "pointer", fontSize: "12px", fontFamily: "sans-serif" }}>+ Новый чат</button>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 10px" }}>
              {chats.length === 0 && <div style={{ color: textMuted, fontSize: "11px", textAlign: "center", marginTop: "20px", fontFamily: "sans-serif" }}>Нет чатов</div>}
              {chats.map(chat => (
                <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setView("chat"); }}
                  style={{ padding: "7px 8px", borderRadius: "5px", cursor: "pointer", marginBottom: "2px", background: activeChatId === chat.id ? "#1a2535" : "transparent", border: `1px solid ${activeChatId === chat.id ? "#2a4a6a" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: activeChatId === chat.id ? textMain : textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "sans-serif" }}>{chat.title}</span>
                  <button onClick={(e) => deleteChat(chat.id, e)} style={{ background: "none", border: "none", color: "#3a5a7a", cursor: "pointer", fontSize: "14px", padding: "0 2px", flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          </>}

          {view === "cases" && <>
            <button onClick={() => setCaseForm({ title: "", debtor: "", amount: "", status: "активное", notes: "" })} style={{ margin: "0 10px 8px", padding: "7px", borderRadius: "6px", background: "#1a2a3a", border: "1px solid #2a4a6a", color: "#7aaacf", cursor: "pointer", fontSize: "12px", fontFamily: "sans-serif" }}>+ Новое дело</button>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 10px" }}>
              {cases.length === 0 && <div style={{ color: textMuted, fontSize: "11px", textAlign: "center", marginTop: "20px", fontFamily: "sans-serif" }}>Нет дел</div>}
              {cases.map(c => (
                <div key={c.id} onClick={() => setCaseForm(c)} style={{ padding: "8px", borderRadius: "5px", marginBottom: "4px", background: "#0f1820", border: `1px solid ${borderCol}`, cursor: "pointer" }}>
                  <div style={{ fontSize: "11px", color: textMain, fontFamily: "sans-serif", fontWeight: 600, marginBottom: "2px" }}>{c.title}</div>
                  {c.debtor && <div style={{ fontSize: "10px", color: textMuted, fontFamily: "sans-serif" }}>👤 {c.debtor}</div>}
                  {c.amount && <div style={{ fontSize: "10px", color: "#8a9a6a", fontFamily: "sans-serif" }}>💰 {c.amount}</div>}
                  <div style={{ display: "inline-block", marginTop: "4px", padding: "1px 6px", borderRadius: "3px", fontSize: "9px", fontFamily: "sans-serif", background: (STATUS_COLORS[c.status] || "#3a5a3a") + "22", color: STATUS_COLORS[c.status] || "#3a5a3a", border: `1px solid ${STATUS_COLORS[c.status] || "#3a5a3a"}44` }}>{c.status}</div>
                </div>
              ))}
            </div>
          </>}
        </div>
      )}

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${borderCol}`, background: panelBg, flexShrink: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ background: "none", border: "none", color: textMuted, cursor: "pointer", fontSize: "18px", padding: "0 4px" }}>☰</button>
          <div style={{ flex: 1, display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ padding: "3px 8px", borderRadius: "4px", border: `1px solid ${mode === m.id ? modeColor(m.id) : borderCol}`, background: mode === m.id ? modeColor(m.id) + "22" : "transparent", color: mode === m.id ? textMain : textMuted, cursor: "pointer", fontSize: "11px", fontFamily: "sans-serif" }}>{m.icon} {m.label}</button>
            ))}
          </div>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#3a8a5a", boxShadow: "0 0 5px #3a8a5a", flexShrink: 0 }} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {!activeChatId && messages.length === 0 && (
            <div style={{ margin: "auto", textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚖️</div>
              <div style={{ fontSize: "15px", color: "#3a5a7a", marginBottom: "6px" }}>Правовой помощник адвоката</div>
              <div style={{ fontSize: "12px", color: "#2a3a4a", fontFamily: "sans-serif", lineHeight: "1.7", marginBottom: "24px" }}>История чатов сохраняется · Картотека дел доступна слева</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxWidth: "460px", margin: "0 auto" }}>
                {["Составить исковое заявление о взыскании задолженности", "Какие меры принудительного исполнения применимы?", "Рассчитай срок для подачи апелляции", "Оцени риски оспаривания постановления СИ"].map((q, i) => (
                  <button key={i} onClick={() => setInput(q)} style={{ background: "#0f1820", border: `1px solid ${borderCol}`, borderRadius: "6px", padding: "10px 12px", color: "#4a7a9a", cursor: "pointer", fontSize: "12px", fontFamily: "sans-serif", textAlign: "left", lineHeight: "1.4" }}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={msg.id || i} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "10px", alignItems: "flex-start" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "6px", flexShrink: 0, background: msg.role === "user" ? "#0f1e2e" : "#0d1a0d", border: `1px solid ${msg.role === "user" ? "#2a4a6a" : "#2a5a2a"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                {msg.role === "user" ? "А" : "⚖"}
              </div>
              <div style={{ maxWidth: "78%" }}>
                {msg.role === "user" && msg.mode && msg.mode !== "auto" && (
                  <div style={{ textAlign: "right", marginBottom: "3px" }}>
                    <span style={{ fontSize: "9px", color: modeColor(msg.mode), background: modeColor(msg.mode) + "15", padding: "1px 6px", borderRadius: "3px", fontFamily: "monospace" }}>
                      {MODES.find(x => x.id === msg.mode)?.icon} {MODES.find(x => x.id === msg.mode)?.label}
                    </span>
                  </div>
                )}
                <div style={{ background: msg.role === "user" ? "#0f1e2e" : msg.role === "error" ? "#2a0d0d" : "#0c1a0c", border: `1px solid ${msg.role === "user" ? "#1e3a5a" : msg.role === "error" ? "#5a2a2a" : "#1a3a1a"}`, borderRadius: msg.role === "user" ? "12px 3px 12px 12px" : "3px 12px 12px 12px", padding: "11px 15px", fontSize: "14px", lineHeight: "1.65", color: msg.role === "error" ? "#cc6666" : textMain }}>
                  {msg.role === "user" ? (msg.display || msg.content) : formatText(msg.content)}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "#0d1a0d", border: "1px solid #2a5a2a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>⚖</div>
              <div style={{ background: "#0c1a0c", border: "1px solid #1a3a1a", borderRadius: "3px 12px 12px 12px", padding: "13px 16px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[0, 1, 2].map(d => <div key={d} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3a7a3a", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${d * 0.2}s` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${borderCol}`, background: panelBg, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", background: "#0f1820", border: "1px solid #1e3a5a", borderRadius: "8px", padding: "8px 12px" }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Задайте правовой вопрос..." rows={1}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: textMain, fontSize: "14px", fontFamily: "'Georgia', serif", resize: "none", lineHeight: "1.5", minHeight: "22px", maxHeight: "140px" }} />
            <button onClick={sendMessage} disabled={!input.trim() || loading} style={{ background: input.trim() && !loading ? "#2a5a3a" : "#1a2a1a", border: "none", borderRadius: "6px", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() && !loading ? "pointer" : "not-allowed", flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={input.trim() && !loading ? "#7ac47a" : "#3a5a3a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !loading ? "#7ac47a" : "#3a5a3a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: "10px", color: "#1a2a3a", marginTop: "5px", textAlign: "center", fontFamily: "sans-serif" }}>Enter — отправить · Shift+Enter — новая строка</div>
        </div>
      </div>

      {/* CASE MODAL */}
      {caseForm !== null && (
        <div style={{ position: "fixed", inset: 0, background: "#000b", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#0f1820", border: "1px solid #2a4a6a", borderRadius: "10px", padding: "20px", width: "360px", maxWidth: "92vw" }}>
            <div style={{ fontSize: "14px", color: gold, fontWeight: 700, marginBottom: "14px" }}>{caseForm.id ? "✏️ Редактировать дело" : "📁 Новое дело"}</div>
            {[["title", "Название дела *"], ["debtor", "Должник / контрагент"], ["amount", "Сумма / предмет"]].map(([field, label]) => (
              <div key={field} style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", color: textMuted, fontFamily: "sans-serif", marginBottom: "3px" }}>{label}</div>
                <input value={caseForm[field] || ""} onChange={e => setCaseForm(p => ({ ...p, [field]: e.target.value }))}
                  style={{ width: "100%", background: "#0a1018", border: `1px solid ${borderCol}`, borderRadius: "5px", padding: "6px 8px", color: textMain, fontSize: "13px", fontFamily: "sans-serif", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "10px", color: textMuted, fontFamily: "sans-serif", marginBottom: "3px" }}>Статус</div>
              <select value={caseForm.status || "активное"} onChange={e => setCaseForm(p => ({ ...p, status: e.target.value }))}
                style={{ width: "100%", background: "#0a1018", border: `1px solid ${borderCol}`, borderRadius: "5px", padding: "6px 8px", color: textMain, fontSize: "13px", fontFamily: "sans-serif" }}>
                {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", color: textMuted, fontFamily: "sans-serif", marginBottom: "3px" }}>Заметки</div>
              <textarea value={caseForm.notes || ""} onChange={e => setCaseForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                style={{ width: "100%", background: "#0a1018", border: `1px solid ${borderCol}`, borderRadius: "5px", padding: "6px 8px", color: textMain, fontSize: "13px", fontFamily: "sans-serif", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={saveCase} style={{ flex: 1, padding: "7px", background: "#1a4a2a", border: "1px solid #2a6a3a", borderRadius: "5px", color: "#7acf8a", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif" }}>Сохранить</button>
              {caseForm.id && <button onClick={() => deleteCase(caseForm.id)} style={{ padding: "7px 12px", background: "#3a0d0d", border: "1px solid #6a2a2a", borderRadius: "5px", color: "#cf7a7a", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif" }}>Удалить</button>}
              <button onClick={() => setCaseForm(null)} style={{ padding: "7px 12px", background: "none", border: `1px solid ${borderCol}`, borderRadius: "5px", color: textMuted, cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif" }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${darkBg}}::-webkit-scrollbar-thumb{background:#1e3a5a;border-radius:2px}
        *{box-sizing:border-box}body{margin:0}
      `}</style>
    </div>
  );
}
