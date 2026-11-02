import { useState, useRef, useEffect } from "react";
import {
  Bot,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Send,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  FileSearch,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  AlertCircle
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import translations from "../data/translations";

const API_BASE = "http://127.0.0.1:5000";

// Simple markdown formatter tailored for Kavach security responses
function renderSecurityMarkdown(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let listItems = [];
  let isOrdered = false;

  const flushList = () => {
    if (listItems.length > 0) {
      if (isOrdered) {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-2 ml-5 list-decimal space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2 ml-5 list-disc space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        );
      }
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={index} className="mt-3 mb-1 text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          {trimmed.replace("### ", "")}
        </h3>
      );
    } else if (trimmed.startsWith("#### ")) {
      flushList();
      elements.push(
        <h4 key={index} className="mt-3 mb-1 text-sm font-semibold text-cyan-600 dark:text-cyan-400">
          {trimmed.replace("#### ", "")}
        </h4>
      );
    } else if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote key={index} className="my-2.5 rounded-xl border-l-4 border-cyan-500 bg-cyan-500/10 p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          {trimmed.replace("> ", "")}
        </blockquote>
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      // Ordered list
      if (!isOrdered && listItems.length > 0) flushList();
      isOrdered = true;
      listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      // Unordered list
      if (isOrdered && listItems.length > 0) flushList();
      isOrdered = false;
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
    } else if (trimmed === "---") {
      flushList();
      elements.push(<hr key={index} className="my-3 border-slate-200 dark:border-slate-800" />);
    } else if (trimmed.length > 0) {
      flushList();
      elements.push(
        <p key={index} className="my-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {trimmed}
        </p>
      );
    }
  });

  flushList();
  return elements;
}

const Chatbot = () => {
  const { language } = useLanguage();
  const isHindi = language === "hi";
  const t = translations[language]?.chatbot || {
    badge: "AI SECURITY ASSISTANT",
    title: "Kavach AI Security Assistant",
    subtitle: "Ask cybersecurity questions, analyze suspicious emails, or practice threat scenarios powered by our 1M-parameter local neural engine.",
    chatTab: "AI Security Chat",
    analyzerTab: "Phishing Inspector",
    newChat: "New Chat",
    onlineBadge: "1.34M PARAMS • OFFLINE AI",
    engineActive: "Local Neural Engine Online",
    engineOffline: "Local Engine Offline (Run 'py app.py')",
    inputPlaceholder: "Ask any cybersecurity question, or paste an email snippet...",
    inspectorPlaceholder: "Paste suspicious email body, headers, or SMS text here to inspect for threat indicators...",
    analyzeBtn: "Analyze Threat",
    riskScore: "Risk Assessment Score",
    detectedRedFlags: "Detected Red Flags & Threat Indicators",
    verdict: "Verdict & Security Advice",
    noFlags: "No obvious phishing red flags detected.",
    copy: "Copy",
    copied: "Copied!",
    tryQuiz: "Practice Cyber Quiz",
    quickPrompts: [
      { label: "Spot Phishing Email", text: "How do I recognize a phishing email and what are the major red flags?" },
      { label: "Clicked Suspicious Link!", text: "I clicked a suspicious link and typed my password what do I do?" },
      { label: "UPI PIN Safety Rules", text: "What are the rules regarding UPI PIN and receiving money?" },
      { label: "Start Cyber Quiz", text: "quiz" }
    ]
  };

  const [activeTab, setActiveTab] = useState("chat"); // 'chat' or 'analyzer'
  const [serverOnline, setServerOnline] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);

  // Chat State
  const initialGreeting = isHindi
    ? "नमस्ते! मैं आपका कवच 1M-पैरामीटर AI सुरक्षा सहायक हूँ। फ़िशिंग, OTP, UPI स्कैम, पासवर्ड सुरक्षा या आपातकालीन साइबर घटना के बारे में कुछ भी पूछें।"
    : "Hello! I am your Kavach 1M-Parameter AI Security Assistant. Ask me about phishing emails, UPI fraud, OTP scams, password safety, or incident response.";

  const [messages, setMessages] = useState([
    {
      id: "init",
      sender: "bot",
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  // Analyzer State
  const [analyzerText, setAnalyzerText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzerReport, setAnalyzerReport] = useState(null);

  // Check backend server status
  const checkStatus = async () => {
    setCheckingServer(true);
    try {
      const res = await fetch(`${API_BASE}/api/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    } finally {
      setCheckingServer(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, loading, activeTab]);

  const handleSend = async (messageText = null) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!messageText) setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          language: language,
          session_id: "kavach_web_user"
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: data.response,
            isQuiz: data.response.includes("Reply with") && data.response.includes("Scenario"),
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
        setServerOnline(true);
      } else {
        throw new Error(data.error || "Failed response");
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          isError: true,
          text: isHindi
            ? "⚠️ स्थानीय AI सर्वर से संपर्क नहीं हो सका। कृपया सुनिश्चित करें कि CyberBot बैकएंड (`py app.py`) पोर्ट 5000 पर चल रहा है।"
            : "⚠️ Unable to connect to the local AI engine. Please ensure the CyberBot backend (`py app.py`) is running on port 5000.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetChat = () => {
    setMessages([
      {
        id: "reset",
        sender: "bot",
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  // Run Phishing Inspection
  const handleInspect = async () => {
    if (!analyzerText.trim() || analyzing) return;
    setAnalyzing(true);
    setAnalyzerReport(null);

    try {
      const res = await fetch(`${API_BASE}/api/analyze/phishing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: analyzerText })
      });
      const data = await res.json();
      if (data.success) {
        setAnalyzerReport(data.report);
        setServerOnline(true);
      }
    } catch {
      setServerOnline(false);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-73px)] overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-white">
      {/* Background Glows Matching Kavach Design System */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-1/4 top-1/3 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex h-[calc(100vh-73px)] max-w-6xl flex-col p-4 sm:p-6">
        {/* HEADER / CONTROL BAR */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-500 dark:text-cyan-400">
              <Bot size={26} strokeWidth={1.7} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-black sm:text-lg">
                  Kav<span className="text-cyan-500">aCh</span>{" "}
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    AI Assistant
                  </span>
                </h1>
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-500 dark:text-cyan-400">
                  {t.onlineBadge}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span
                  className={`h-2 w-2 rounded-full ${
                    serverOnline ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-amber-500 animate-pulse"
                  }`}
                />
                <span>{serverOnline ? t.engineActive : t.engineOffline}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* TAB SELECTORS */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "chat"
                    ? "bg-white text-cyan-600 shadow-sm dark:bg-slate-800 dark:text-cyan-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <MessageSquare size={14} />
                <span>{t.chatTab}</span>
              </button>

              <button
                onClick={() => setActiveTab("analyzer")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "analyzer"
                    ? "bg-white text-cyan-600 shadow-sm dark:bg-slate-800 dark:text-cyan-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <FileSearch size={14} />
                <span>{t.analyzerTab}</span>
              </button>
            </div>

            {activeTab === "chat" && (
              <button
                onClick={resetChat}
                title={t.newChat}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-400"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">{t.newChat}</span>
              </button>
            )}
          </div>
        </div>

        {/* OFFLINE HELPER BANNER */}
        {!serverOnline && !checkingServer && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-amber-500" />
              <span>
                {isHindi
                  ? "स्थानीय AI इंजन डिस्कनेक्ट है। CyberBot-main फोल्डर में जाकर 'py app.py' चलाएं।"
                  : "Local AI engine is disconnected. Please run 'py app.py' in your CyberBot-main terminal to activate local inference."}
              </span>
            </div>
            <button
              onClick={checkStatus}
              className="ml-3 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-500/30 dark:text-amber-200"
            >
              {isHindi ? "पुनः प्रयास करें" : "Retry"}
            </button>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODE 1: INTERACTIVE CONVERSATIONAL AI CHAT */}
        {/* ==================================================== */}
        {activeTab === "chat" && (
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
            {/* MESSAGES AREA */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.sender === "bot" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-500 dark:text-cyan-400">
                      <Bot size={17} />
                    </div>
                  )}

                  <div
                    className={`group relative max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      m.sender === "user"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-none"
                        : m.isError
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 rounded-bl-none"
                        : "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/90 rounded-bl-none"
                    }`}
                  >
                    {m.sender === "bot" ? (
                      renderSecurityMarkdown(m.text)
                    ) : (
                      <div className="whitespace-pre-wrap">{m.text}</div>
                    )}

                    {/* Interactive Quiz Response Buttons */}
                    {m.isQuiz && (
                      <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                        {["A", "B", "C", "D"].map((letter) => (
                          <button
                            key={letter}
                            onClick={() => handleSend(letter)}
                            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-600 transition hover:bg-cyan-500 hover:text-white dark:text-cyan-400 dark:hover:bg-cyan-500 dark:hover:text-white"
                          >
                            Option {letter}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Footer Info & Copy */}
                    <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-400">
                      <span>{m.timestamp}</span>
                      {m.sender === "bot" && (
                        <button
                          onClick={() => handleCopy(m.id, m.text)}
                          className="opacity-0 transition group-hover:opacity-100 hover:text-cyan-500 flex items-center gap-1"
                          title={t.copy}
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check size={11} className="text-emerald-500" />
                              <span className="text-emerald-500">{t.copied}</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>{t.copy}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-3 py-2 text-xs text-slate-400">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 animate-pulse">
                    <Sparkles size={16} />
                  </div>
                  <span className="animate-pulse">
                    {isHindi
                      ? "कवच न्यूरल मॉडल (1.34M Params) विश्लेषण कर रहा है..."
                      : "Kavach 1M-Parameter Neural Engine evaluating query..."}
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* QUICK SUGGESTION CHIPS */}
            <div className="border-t border-slate-200/70 bg-white/40 px-4 py-2.5 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
                  {isHindi ? "सुझाव:" : "Suggested:"}
                </span>
                {t.quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(qp.text)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-2xs transition hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-400"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* INPUT BAR */}
            <div className="p-3 sm:p-4 bg-white/70 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.inputPlaceholder}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-cyan-400 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:focus:border-cyan-400 shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-white shadow-md shadow-cyan-500/20 transition hover:opacity-90 disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODE 2: DEDICATED PHISHING & SCAM INSPECTOR */}
        {/* ==================================================== */}
        {activeTab === "analyzer" && (
          <div className="flex flex-1 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white/70 p-4 sm:p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileSearch className="text-cyan-500" size={22} />
                <span>{t.analyzerTab}</span>
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {isHindi
                  ? "किसी भी ईमेल का विषय, बॉडी या एसएमएस टेक्स्ट यहाँ पेस्ट करें। AI खतरे के संकेतों (तात्कालिकता, जाली डोमेन, संदिग्ध लिंक) का विश्लेषण करेगा।"
                  : "Paste any suspicious email header, message body, or SMS snippet below. The local neural engine inspects for urgency tactics, domain lookalikes, and credential harvesting lures."}
              </p>
            </div>

            {/* INPUT TEXTAREA */}
            <div className="space-y-3">
              <textarea
                rows={5}
                value={analyzerText}
                onChange={(e) => setAnalyzerText(e.target.value)}
                placeholder={t.inspectorPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed focus:border-cyan-400 focus:outline-none dark:border-slate-800 dark:bg-slate-950 shadow-2xs"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAnalyzerText(
                        "From: billing@paypa1-security.xyz\nSubject: URGENT: Your account has been suspended within 24 hours!\nPlease download identity-verification.zip and verify credentials immediately."
                      )
                    }
                    className="text-xs text-cyan-600 hover:underline dark:text-cyan-400"
                  >
                    {isHindi ? "नमूना फ़िशिंग ईमेल लोड करें" : "Load sample phishing message"}
                  </button>
                </div>

                <button
                  onClick={handleInspect}
                  disabled={analyzing || !analyzerText.trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  <span>{analyzing ? (isHindi ? "विश्लेषण जारी..." : "Analyzing...") : t.analyzeBtn}</span>
                </button>
              </div>
            </div>

            {/* RESULTS REPORT */}
            {analyzerReport && (
              <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                {/* Score Gauge */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800/80">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {t.riskScore}
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        {analyzerReport.score}/100
                      </span>
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase ${
                          analyzerReport.score >= 70
                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                            : analyzerReport.score >= 40
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        }`}
                      >
                        {analyzerReport.risk_level}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400">Flags Triggered</span>
                    <p className="text-lg font-bold">{analyzerReport.flag_count}</p>
                  </div>
                </div>

                {/* Detected Red Flags */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                    {t.detectedRedFlags}
                  </h4>
                  {analyzerReport.red_flags.length > 0 ? (
                    <ul className="space-y-2">
                      {analyzerReport.red_flags.map((flag, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300"
                        >
                          <AlertTriangle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <span>{t.noFlags}</span>
                    </div>
                  )}
                </div>

                {/* Security Advice & Verdict */}
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs sm:text-sm">
                  <h5 className="font-bold text-cyan-600 dark:text-cyan-400 mb-1">
                    {t.verdict}
                  </h5>
                  <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                    {analyzerReport.verdict}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Chatbot;
