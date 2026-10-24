"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { OpenAI } from "openai";

/* ================================================================== */
/*  CONFIG: change names and text here                                 */
/* ================================================================== */
// Put your token in .env.local:  NEXT_PUBLIC_HF_TOKEN=hf_xxx   (then restart `npm run dev`)
// Anything prefixed NEXT_PUBLIC_ is visible to users in the browser.
// For production, call the model from an API route (app/api/chat/route.ts) instead.
const HF_TOKEN = "hf_sFQsPTnAjE9mHMvGjwoPxXRQoSmqSJS6FD";
const MODEL = "openai/gpt-oss-120b:fireworks-ai";

const BOT_NAME = "Onyx";
const VERSION = "Onyx 1.0";
const HEADING = "How can I help you today?";
const BLURB = "Ask a question, paste your notes, or pick a mode below. Folders keep your chats organised.";
const TEMPLATES: string[] = [
  "Explain this topic simply, then give me 3 practice questions: ",
  "Summarize the text below in 5 bullet points: ",
  "Turn these notes into a clear study plan for the week: ",
  "Rewrite this to sound clearer and more professional: ",
];
const MODES = ["All", "Text", "Image", "Video", "Music", "Analytics"];
const MODE_HINT: Record<string, string> = {
  Text: "Answer in well-structured written prose.",
  Image: "Help craft detailed image-generation prompts and visual ideas.",
  Video: "Help with video scripts, storyboards and shot ideas.",
  Music: "Help with music: lyrics ideas, chords, structure and composition.",
  Analytics: "Help analyse data: show clear steps and structured results.",
};
const LANGS = ["English", "Français", "العربية", "Español"];
const FOLDER_COLORS = ["#6fe36a", "#b79cf5", "#f5a35c", "#e8d36a", "#6cc8f5", "#f57ca6"];
const KEY_CHATS = "onyx_chats_v2";
const KEY_FOLDERS = "onyx_folders_v2";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */
type Role = "user" | "assistant";
type Msg = { role: Role; content: string };
type Chat = { id: string; title: string; sub: string; folderId: string | null; saved: boolean; messages: Msg[] };
type Folder = { id: string; name: string; color: string };

const DEFAULT_FOLDERS: Folder[] = [
  { id: "f1", name: "Work chats", color: FOLDER_COLORS[0] },
  { id: "f2", name: "Life chats", color: FOLDER_COLORS[1] },
  { id: "f3", name: "Projects chats", color: FOLDER_COLORS[2] },
  { id: "f4", name: "Clients chats", color: FOLDER_COLORS[3] },
];

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: HF_TOKEN || "missing",
      dangerouslyAllowBrowser: true,
    });
  }
  return _client;
}

function readStore<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch (e) {
    return fallback;
  }
}

/* ================================================================== */
/*  Icons                                                              */
/* ================================================================== */
const P = {
  panel: ["M4 5h16v14H4z", "M10 5v14"],
  back: ["M15 5l-7 7 7 7"],
  bookmark: ["M7 4h10v16l-5-4-5 4z"],
  share: ["M12 15V4", "M8 8l4-4 4 4", "M5 13v6h14v-6"],
  folder: ["M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"],
  chat: ["M4 5h16v11H9l-5 4V5z"],
  dots: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  search: ["M11 4a7 7 0 100 14 7 7 0 000-14z", "M20 20l-4-4"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  chev: ["M6 9l6 6 6-6"],
  mic: ["M12 4a3 3 0 013 3v4a3 3 0 01-6 0V7a3 3 0 013-3z", "M6 11a6 6 0 0012 0", "M12 17v3"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  copy: ["M9 9h10v10H9z", "M5 15V5h10"],
  check: ["M5 12.5l4.5 4.5L19 7"],
  retry: ["M20 11a8 8 0 10-2.3 5.7", "M20 5v6h-6"],
  down: ["M12 5v14", "M5 12l7 7 7-7"],
  media: ["M4 5h16v11H4z", "M10 8.5l4 2-4 2z", "M9 20h6"],
  lang: ["M4 5h9", "M8.5 3v2", "M6 5c.5 3 3 6 6 7", "M12 5c-.5 3-3 6-7 8", "M13 20l4-9 4 9", "M14.5 17h5"],
} satisfies Record<string, string[]>;
type IconName = keyof typeof P;

function Icon({ name, size = 16, sw = 1.7 }: { name: IconName; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
.gx *{box-sizing:border-box;margin:0}
.gx{--g:#55e04f;--g2:#2fae2c;--bg:#000;--c1:#1a1a1a;--c2:#2a2a2a;--c3:#363636;--line:#262626;--text:#f3f3f3;--muted:#8d8d8d;
  position:fixed;inset:0;display:flex;gap:14px;padding:14px;background:#000;color:var(--text);font-family:'Inter',system-ui,sans-serif;font-size:14px;overflow:hidden;-webkit-font-smoothing:antialiased}
.gx button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;text-align:left}
.gx input,.gx textarea{font:inherit}
.gx button:focus-visible,.gx input:focus-visible,.gx textarea:focus-visible{outline:1.5px solid var(--g);outline-offset:2px}
.gx ::selection{background:var(--g);color:#000}

/* sidebar */
.gx-side{width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;min-height:0;transition:margin .28s cubic-bezier(.2,.7,.2,1);z-index:6}
.gx.collapsed .gx-side{margin-left:-314px}
.gx-head{height:62px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 14px 0 20px;border-radius:22px;background:var(--c1);border:1px solid var(--line);font-size:15px;font-weight:500}
.gx-ib{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--muted);flex-shrink:0}
.gx-ib:hover{background:var(--c2);color:#fff}
.gx-lc{flex:1;min-height:0;display:flex;flex-direction:column;border-radius:22px;background:var(--c1);border:1px solid var(--line);padding:14px}
.gx-search{display:flex;align-items:center;gap:8px;height:38px;border-radius:10px;background:var(--c2);padding:0 12px;color:var(--muted);flex-shrink:0}
.gx-search input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--text);font-size:13px}
.gx-search input::placeholder{color:var(--muted)}
.gx-scroll{flex:1;min-height:0;overflow-y:auto;margin:0 -6px;padding:0 6px}
.gx-scroll::-webkit-scrollbar{width:5px}.gx-scroll::-webkit-scrollbar-thumb{background:var(--c3);border-radius:9px}
.gx-sec{display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px;font-size:12.5px;color:#c9c9c9;font-weight:500}
.gx-sec:first-child{margin-top:16px}
.gx-sm{display:flex;gap:6px}
.gx-mini{width:18px;height:18px;border-radius:5px;background:var(--c3);color:#ddd;display:flex;align-items:center;justify-content:center}
.gx-mini:hover{background:#4a4a4a;color:#fff}
.gx-row{position:relative;margin-bottom:8px}
.gx-folder{width:100%;height:42px;display:flex;align-items:center;gap:10px;padding:0 38px 0 12px;border-radius:9px;background:var(--c2);border-left:3px solid var(--fc,#6fe36a);color:#e6e6e6;font-size:12.5px;transition:background .2s}
.gx-folder:hover{background:var(--c3)}
.gx-folder.on{background:var(--c3);box-shadow:inset 0 0 0 1px var(--fc)}
.gx-folder svg{color:#bbb;flex-shrink:0}
.gx-chat{width:100%;display:flex;align-items:flex-start;gap:10px;padding:11px 38px 11px 12px;border-radius:11px;background:var(--c2);transition:background .2s}
.gx-chat:hover{background:var(--c3)}
.gx-chat.on{background:var(--c3);box-shadow:inset 0 0 0 1px rgba(85,224,79,.55)}
.gx-chat svg{margin-top:2px;color:#bbb;flex-shrink:0}
.gx-chat b{display:block;font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gx-chat small{display:block;margin-top:3px;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gx-chat span{min-width:0}
.gx-dots{position:absolute;right:8px;top:9px;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#aaa}
.gx-folder+.gx-dots{top:8px}
.gx-dots:hover{background:#474747;color:#fff}
.gx-menu{position:absolute;right:6px;top:36px;z-index:20;min-width:170px;background:#222;border:1px solid #3a3a3a;border-radius:12px;padding:6px;box-shadow:0 18px 40px rgba(0,0,0,.7)}
.gx-menu button{width:100%;padding:8px 10px;border-radius:8px;font-size:12.5px;color:#ddd;display:flex;align-items:center;gap:8px}
.gx-menu button:hover{background:#333;color:#fff}
.gx-menu hr{border:0;border-top:1px solid #333;margin:5px 0}
.gx-menu em{display:block;padding:4px 10px;font-style:normal;font-size:11px;color:var(--muted)}
.gx-menu .sw{width:8px;height:8px;border-radius:50%}
.gx-menu .del{color:#ff7a7a}
.gx-none{padding:6px 2px;color:var(--muted);font-size:12px;line-height:1.5}
.gx-new{flex-shrink:0;margin-top:12px;height:54px;border-radius:15px;background:linear-gradient(180deg,#63e85c,#44d33f);color:#0b2a0a;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 18px;font-size:14px;font-weight:500;transition:filter .2s,transform .15s}
.gx-new:hover{filter:brightness(1.08)}
.gx-new:active{transform:scale(.99)}
.gx-new i{width:36px;height:36px;border-radius:9px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center}

/* main */
.gx-main{flex:1;min-width:0;position:relative;display:flex;flex-direction:column;border-radius:30px;border:1px solid #171717;overflow:hidden;
  background:radial-gradient(55% 60% at 88% 100%,rgba(48,210,60,.5),transparent 70%),radial-gradient(50% 50% at 8% 108%,rgba(30,150,45,.28),transparent 70%),radial-gradient(70% 40% at 50% 120%,rgba(40,180,55,.22),transparent 70%),#030503}
.gx-main:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 45%,#000,transparent 80%);mask-image:radial-gradient(ellipse 70% 60% at 50% 45%,#000,transparent 80%)}
.gx-top{position:relative;z-index:3;height:68px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 22px}
.gx-top-l{display:flex;align-items:center;gap:8px;min-width:0}
.gx-name{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40vw}
.gx-badge{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--g);background:rgba(85,224,79,.1);border:1px solid rgba(85,224,79,.35);padding:3px 8px;border-radius:5px;white-space:nowrap;margin-left:6px}
.gx-top-r{display:flex;gap:4px}
.gx-top-r .on{color:var(--g)}
.gx-body{position:relative;z-index:2;flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column}
.gx-body::-webkit-scrollbar{width:8px}.gx-body::-webkit-scrollbar-thumb{background:#2e2e2e;border-radius:9px}

/* hero card */
.gx-card{margin:auto;width:calc(100% - 40px);max-width:660px;padding:34px 18px 18px;border-radius:28px;background:rgba(34,34,34,.9);border:1px solid #333;backdrop-filter:blur(14px);box-shadow:0 30px 80px -20px rgba(0,0,0,.8)}
.gx-h{text-align:center;font-size:clamp(28px,4.4vw,40px);font-weight:500;letter-spacing:-.035em;line-height:1.1}
.gx-p{margin:14px auto 0;max-width:430px;text-align:center;font-size:12px;line-height:1.55;color:var(--muted)}
.gx-feats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:26px}
.gx-feat{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:16px 10px 14px;border-radius:13px;background:var(--c3);border:1px solid transparent;transition:border-color .2s,transform .2s,background .2s}
.gx-feat:hover{border-color:rgba(85,224,79,.55);transform:translateY(-2px);background:#3d3d3d}
.gx-feat svg{color:var(--g);margin-bottom:2px}
.gx-feat b{font-size:12.5px;font-weight:500;line-height:1.25}
.gx-feat small{font-size:10px;line-height:1.4;color:#9a9a9a}
.gx-tabs{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 18px;margin:20px 0 12px;font-size:12.5px}
.gx-tab{color:#cfcfcf;padding:4px 0;border-bottom:1px solid transparent}
.gx-tab:hover{color:#fff}
.gx-tab.on{color:var(--g);border-bottom-color:var(--g)}
.gx-lang{text-align:center;font-size:11.5px;color:var(--g);margin:-4px 0 10px}
.gx-lang button{color:#9a9a9a;margin-left:6px;display:inline}
.gx-lang button:hover{color:#fff}

/* input */
.gx-in{display:flex;align-items:flex-end;gap:8px;background:#fff;border-radius:14px;padding:7px 7px 7px 16px;transition:box-shadow .2s}
.gx-in:focus-within{box-shadow:0 0 0 4px rgba(85,224,79,.28)}
.gx-ta{flex:1;resize:none;background:none;border:0;outline:0!important;color:#111;font-size:14px;line-height:1.55;max-height:170px;min-height:26px;padding:9px 0}
.gx-ta::placeholder{color:#8a8a8a}
.gx-mic{width:34px;height:36px;display:flex;align-items:center;justify-content:center;color:#9a9a9a;border-radius:8px;flex-shrink:0}
.gx-mic:hover{color:#111}
.gx-mic.on{background:#111;color:var(--g)}
.gx-send{width:38px;height:38px;border-radius:10px;background:var(--g);color:#06220a;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:filter .2s,opacity .2s}
.gx-send:hover{filter:brightness(1.08)}
.gx-send:disabled{opacity:.35;cursor:not-allowed}
.gx-foot{position:relative;z-index:3;flex-shrink:0;text-align:center;font-size:11.5px;color:#8c8c8c;padding:12px 16px 16px}

/* chat */
.gx-msgs{width:100%;max-width:780px;margin:0 auto;padding:6px 24px 24px;display:flex;flex-direction:column;gap:22px}
.gx-user{align-self:flex-end;max-width:82%;padding:12px 17px;border-radius:18px 18px 4px 18px;background:linear-gradient(180deg,#63e85c,#44d33f);color:#06220a;font-weight:500;white-space:pre-wrap;word-break:break-word;line-height:1.55}
.gx-bot{padding:16px 20px;border-radius:18px 18px 18px 4px;background:rgba(34,34,34,.88);border:1px solid #303030;backdrop-filter:blur(8px)}
.gx-ans{line-height:1.75;word-break:break-word;color:#e8e8e8}
.gx-ans p{white-space:pre-wrap;margin-bottom:12px}.gx-ans p:last-child{margin-bottom:0}
.gx-ans strong{color:#fff;font-weight:600}
.gx-ans code.i{background:#111;border:1px solid #333;color:#9cf09a;padding:1px 6px;border-radius:6px;font-size:.88em;font-family:ui-monospace,Menlo,monospace}
.gx-code{border:1px solid #333;border-radius:12px;overflow:hidden;background:#0c0c0c;margin-bottom:12px}
.gx-code-h{display:flex;justify-content:space-between;align-items:center;padding:3px 6px 3px 14px;border-bottom:1px solid #262626;font-size:11.5px;color:var(--muted)}
.gx-code pre{padding:14px;overflow-x:auto;font-size:12.5px;line-height:1.65;color:#d6d6d6;font-family:ui-monospace,Menlo,monospace}
.gx-act{display:flex;gap:2px;margin:10px 0 -4px -8px}
.gx-act button,.gx-code-h button{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;font-size:12px;color:#8a8a8a}
.gx-act button:hover,.gx-code-h button:hover{background:#333;color:#fff}
.gx-dotsl{display:flex;gap:6px;height:26px;align-items:center}
.gx-dotsl i{width:6px;height:6px;border-radius:50%;background:var(--g);opacity:.3;animation:gx-b 1.2s infinite}
.gx-dotsl i:nth-child(2){animation-delay:.15s}.gx-dotsl i:nth-child(3){animation-delay:.3s}
@keyframes gx-b{0%,80%,100%{opacity:.25}40%{opacity:1}}
.gx-dock{position:relative;z-index:3;flex-shrink:0;padding:6px 24px 0;display:flex;flex-direction:column;align-items:center}
.gx-dock .gx-in{width:100%;max-width:780px}
.gx-dock .gx-tabs{margin:0 0 10px;font-size:12px}
.gx-jump{position:absolute;top:-44px;width:34px;height:34px;border-radius:50%;background:#222;border:1px solid #3a3a3a!important;display:flex;align-items:center;justify-content:center;color:#bbb}

@media (max-width:860px){
  .gx{padding:8px;gap:8px}
  .gx-side{position:absolute;left:8px;top:8px;bottom:8px;width:min(310px,88vw);box-shadow:30px 0 80px rgba(0,0,0,.9)}
  .gx.collapsed .gx-side{margin-left:calc(-1 * min(310px,88vw) - 30px)}
  .gx-main{border-radius:22px}
  .gx-feats{grid-template-columns:1fr}
  .gx-feat{flex-direction:row;text-align:left;gap:12px;padding:12px 14px}
  .gx-feat div{display:flex;flex-direction:column}
  .gx-top{padding:0 12px}
  .gx-dock{padding:6px 12px 0}
}
@media (prefers-reduced-motion:reduce){.gx-dotsl i{animation:none}.gx-side,.gx-feat{transition:none}}
`;

/* ================================================================== */
/*  Rich text                                                          */
/* ================================================================== */
function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const go = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      },
      () => {}
    );
  };
  return (
    <button onClick={go}>
      <Icon name={done ? "check" : "copy"} size={14} /> {done ? "Copied" : label || "Copy"}
    </button>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((p, i) => {
        if (p.length > 2 && p[0] === "`" && p[p.length - 1] === "`") return <code className="i" key={i}>{p.slice(1, -1)}</code>;
        if (p.length > 4 && p.slice(0, 2) === "**" && p.slice(-2) === "**") return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

function Rich({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  text.split("```").forEach((chunk, i) => {
    if (i % 2 === 1) {
      const nl = chunk.indexOf("\n");
      const lang = nl > -1 ? chunk.slice(0, nl).trim() : "";
      const code = (nl > -1 ? chunk.slice(nl + 1) : chunk).replace(/\n$/, "");
      out.push(
        <div className="gx-code" key={i}>
          <div className="gx-code-h"><span>{lang || "code"}</span><CopyBtn text={code} /></div>
          <pre><code>{code}</code></pre>
        </div>
      );
    } else {
      chunk.split(/\n{2,}/).forEach((para, j) => {
        if (para.trim()) out.push(<p key={i + "-" + j}><Inline text={para.trim()} /></p>);
      });
    }
  });
  return <div>{out}</div>;
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */
export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [folders, setFolders] = useState<Folder[]>(DEFAULT_FOLDERS);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("All");
  const [lang, setLang] = useState("English");
  const [tplIdx, setTplIdx] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [listening, setListening] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [shared, setShared] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const nearBottom = useRef(true);
  const recRef = useRef<any>(null);
  const folderRef = useRef<string | null>(null);
  folderRef.current = activeFolder;

  /* load saved data on the client only (avoids hydration mismatch) */
  useEffect(() => {
    setChats(readStore<Chat>(KEY_CHATS, []));
    setFolders(readStore<Folder>(KEY_FOLDERS, DEFAULT_FOLDERS));
    if (window.innerWidth < 860) setCollapsed(true);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (nearBottom.current && endRef.current) endRef.current.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 170) + "px";
  }, [input, messages.length]);

  /* save finished conversations */
  useEffect(() => {
    if (loading || messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const firstBot = messages.find((m) => m.role === "assistant" && m.content);
    const title = firstUser ? firstUser.content.slice(0, 40) : "Conversation";
    const sub = (firstBot ? firstBot.content : firstUser ? firstUser.content : "").replace(/\s+/g, " ").slice(0, 70);
    let id = activeId;
    if (!id) {
      id = "c" + Date.now();
      setActiveId(id);
    }
    const chatId = id;
    setChats((prev) => {
      const old = prev.find((c) => c.id === chatId);
      const entry: Chat = {
        id: chatId,
        title: old ? old.title : title,
        sub: sub,
        folderId: old ? old.folderId : folderRef.current,
        saved: old ? !!old.saved : false,
        messages: messages,
      };
      return [entry].concat(prev.filter((c) => c.id !== chatId)).slice(0, 60);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading]);

  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(KEY_CHATS, JSON.stringify(chats)); } catch (e) {}
  }, [chats, loaded]);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(KEY_FOLDERS, JSON.stringify(folders)); } catch (e) {}
  }, [folders, loaded]);

  /* close popup menu on outside click */
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottom.current = near;
    setShowJump(!near);
  };

  const run = useCallback(async (history: Msg[], modeNow: string, langNow: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setMessages(history.concat([{ role: "assistant", content: "" }]));
    nearBottom.current = true;

    if (!HF_TOKEN) {
      setMessages((m) => {
        
        const c = m.slice();
        c[c.length - 1] = { role: "assistant", content: "Missing API token. Add NEXT_PUBLIC_HF_TOKEN=hf_xxx to .env.local, then restart the dev server." };
        return c;
      });
      setLoading(false);
      abortRef.current = null;
      return;
    }

    const sys: string[] = [];
    if (modeNow !== "All" && MODE_HINT[modeNow]) sys.push(MODE_HINT[modeNow]);
    if (langNow !== "English") sys.push("Reply in " + langNow + ".");
    const payload: { role: "system" | "user" | "assistant"; content: string }[] = [];
    if (sys.length) payload.push({ role: "system", content: sys.join(" ") });
    history.forEach((m) => payload.push({ role: m.role, content: m.content }));

    try {
      const stream = await getClient().chat.completions.create(
        { model: MODEL, messages: payload, stream: true },
        { signal: controller.signal }
      );
      let full = "";
      for await (const chunk of stream) {
        const delta = (chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || "";
        if (!delta) continue;
        full += delta;
        const snap = full;
        setMessages((m) => {
          const c = m.slice();
          c[c.length - 1] = { role: "assistant", content: snap };
          return c;
        });
      }
    } catch (_err) {
      if (controller.signal.aborted) {
        setMessages((m) => (m.length && m[m.length - 1].content === "" ? m.slice(0, -1) : m));
      } else {
        setMessages((m) => {
          const c = m.slice();
          c[c.length - 1] = { role: "assistant", content: "I couldn't get a response. Check your connection and API token, then try again." };
          return c;
        });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, []);

  const send = (text?: string) => {
    const v = (typeof text === "string" ? text : input).trim();
    if (!v || loading) return;
    setInput("");
    run(messages.concat([{ role: "user", content: v }]), mode, lang);
  };

  const retry = () => {
    if (loading) return;
    let idx = -1;
    messages.forEach((m, i) => { if (m.role === "user") idx = i; });
    if (idx >= 0) run(messages.slice(0, idx + 1), mode, lang);
  };

  const newChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]); setInput(""); setLoading(false); setActiveId(null);
    if (taRef.current) taRef.current.focus();
  };

  const openChat = (c: Chat) => {
    if (abortRef.current) abortRef.current.abort();
    setLoading(false); setActiveId(c.id); setMessages(c.messages); setInput("");
    nearBottom.current = true;
    if (window.innerWidth < 860) setCollapsed(true);
  };

  const delChat = (id: string) => {
    setChats((p) => p.filter((c) => c.id !== id));
    if (id === activeId) newChat();
  };
  const moveChat = (id: string, folderId: string | null) =>
    setChats((p) => p.map((c) => (c.id === id ? { ...c, folderId: folderId } : c)));

  const addFolder = () => {
    const name = window.prompt("Folder name");
    if (!name || !name.trim()) return;
    setFolders((p) => p.concat([{ id: "f" + Date.now(), name: name.trim().slice(0, 24), color: FOLDER_COLORS[p.length % FOLDER_COLORS.length] }]));
    setFoldersOpen(true);
  };
  const renameFolder = (f: Folder) => {
    const name = window.prompt("Rename folder", f.name);
    if (!name || !name.trim()) return;
    setFolders((p) => p.map((x) => (x.id === f.id ? { ...x, name: name.trim().slice(0, 24) } : x)));
  };
  const delFolder = (id: string) => {
    setFolders((p) => p.filter((f) => f.id !== id));
    setChats((p) => p.map((c) => (c.folderId === id ? { ...c, folderId: null } : c)));
    if (activeFolder === id) setActiveFolder(null);
  };

  const toggleSaved = () => {
    if (!activeId) return;
    setChats((p) => p.map((c) => (c.id === activeId ? { ...c, saved: !c.saved } : c)));
  };
  const shareChat = () => {
    if (!messages.length || !navigator.clipboard) return;
    const text = messages.map((m) => (m.role === "user" ? "You: " : BOT_NAME + ": ") + m.content).join("\n\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setShared(true);
        setTimeout(() => setShared(false), 1500);
      },
      () => {}
    );
  };

  const toggleMic = () => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert("Voice input isn't supported in this browser."); return; }
    if (listening && recRef.current) { recRef.current.stop(); return; }
    const r = new SR();
    r.interimResults = false;
    r.onresult = (e: any) => {
      const t: string = e.results[0][0].transcript;
      setInput((cur) => (cur ? cur + " " : "") + t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    setListening(true);
    r.start();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const insertTemplate = () => {
    setInput(TEMPLATES[tplIdx % TEMPLATES.length]);
    setTplIdx(tplIdx + 1);
    if (taRef.current) taRef.current.focus();
  };
  const nextMode = () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
  const nextLang = () => setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]);

  const empty = messages.length === 0;
  const current = chats.find((c) => c.id === activeId);
  const q = query.trim().toLowerCase();
  const shown = chats.filter((c) => {
    if (activeFolder && c.folderId !== activeFolder) return false;
    if (q && (c.title + " " + c.sub).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });

  const tabs = (
    <div className="gx-tabs" role="tablist" aria-label="Mode">
      {MODES.map((m) => (
        <button key={m} role="tab" aria-selected={mode === m} className={"gx-tab" + (mode === m ? " on" : "")} onClick={() => setMode(m)}>{m}</button>
      ))}
    </div>
  );
  const langNote = lang !== "English" ? (
    <div className="gx-lang">Replying in {lang}<button onClick={() => setLang("English")} aria-label="Reset language">reset</button></div>
  ) : null;
  const inputBar = (
    <div className="gx-in">
      <textarea
        ref={taRef}
        className="gx-ta"
        rows={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type your prompt here..."
        aria-label="Message"
        autoFocus
      />
      <button className={"gx-mic" + (listening ? " on" : "")} onClick={toggleMic} aria-label="Voice input"><Icon name="mic" size={17} /></button>
      {loading ? (
        <button className="gx-send" onClick={() => abortRef.current && abortRef.current.abort()} aria-label="Stop generating">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="2" width="16" height="16" rx="2" /></svg>
        </button>
      ) : (
        <button className="gx-send" onClick={() => send()} disabled={!input.trim()} aria-label="Send message"><Icon name="arrow" size={18} sw={2.2} /></button>
      )}
    </div>
  );

  const menuBox = (kind: string, id: string, children: React.ReactNode) =>
    menu === kind + id ? (
      <div className="gx-menu" onClick={(e) => e.stopPropagation()}>{children}</div>
    ) : null;

  return (
    <div className={"gx" + (collapsed ? " collapsed" : "")}>
      <style>{CSS}</style>

      {/* ---------------- Sidebar ---------------- */}
      <aside className="gx-side">
        <div className="gx-head">
          <span>My Chats</span>
          <button className="gx-ib" onClick={() => setCollapsed(true)} aria-label="Close sidebar"><Icon name="panel" /></button>
        </div>

        <div className="gx-lc">
          <label className="gx-search">
            <Icon name="search" size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search chats" />
          </label>

          <div className="gx-scroll">
            <div className="gx-sec">
              <span>Folders</span>
              <span className="gx-sm">
                <button className="gx-mini" onClick={addFolder} aria-label="Add folder"><Icon name="plus" size={12} sw={2.2} /></button>
                <button className="gx-mini" onClick={() => setFoldersOpen(!foldersOpen)} aria-label="Toggle folders"><Icon name={foldersOpen ? "minus" : "plus"} size={12} sw={2.2} /></button>
              </span>
            </div>
            {foldersOpen && folders.map((f) => (
              <div className="gx-row" key={f.id}>
                <button
                  className={"gx-folder" + (activeFolder === f.id ? " on" : "")}
                  style={{ "--fc": f.color } as React.CSSProperties}
                  onClick={() => setActiveFolder(activeFolder === f.id ? null : f.id)}
                >
                  <Icon name="folder" size={15} /> {f.name}
                </button>
                <button className="gx-dots" aria-label="Folder options" onClick={(e) => { e.stopPropagation(); setMenu(menu === "f" + f.id ? null : "f" + f.id); }}><Icon name="dots" size={16} sw={2.6} /></button>
                {menuBox("f", f.id, (
                  <>
                    <button onClick={() => { setMenu(null); renameFolder(f); }}>Rename</button>
                    <hr />
                    <button className="del" onClick={() => { setMenu(null); delFolder(f.id); }}>Delete folder</button>
                  </>
                ))}
              </div>
            ))}
            {foldersOpen && folders.length === 0 && <div className="gx-none">No folders yet. Press + to add one.</div>}

            <div className="gx-sec">
              <span>Chats{activeFolder ? " in folder" : ""}</span>
              <button className="gx-mini" onClick={() => setChatsOpen(!chatsOpen)} aria-label="Toggle chats"><Icon name="chev" size={12} sw={2.2} /></button>
            </div>
            {chatsOpen && shown.map((c) => (
              <div className="gx-row" key={c.id}>
                <button className={"gx-chat" + (c.id === activeId ? " on" : "")} onClick={() => openChat(c)}>
                  <Icon name="chat" size={15} />
                  <span><b>{c.title}</b><small>{c.sub}</small></span>
                </button>
                <button className="gx-dots" aria-label="Chat options" onClick={(e) => { e.stopPropagation(); setMenu(menu === "c" + c.id ? null : "c" + c.id); }}><Icon name="dots" size={16} sw={2.6} /></button>
                {menuBox("c", c.id, (
                  <>
                    <em>Move to folder</em>
                    {folders.map((f) => (
                      <button key={f.id} onClick={() => { setMenu(null); moveChat(c.id, f.id); }}>
                        <i className="sw" style={{ background: f.color }} />{f.name}{c.folderId === f.id ? "  ✓" : ""}
                      </button>
                    ))}
                    <button onClick={() => { setMenu(null); moveChat(c.id, null); }}>No folder</button>
                    <hr />
                    <button className="del" onClick={() => { setMenu(null); delChat(c.id); }}>Delete chat</button>
                  </>
                ))}
              </div>
            ))}
            {chatsOpen && shown.length === 0 && (
              <div className="gx-none">{q || activeFolder ? "No chats match." : "Your conversations will show up here."}</div>
            )}
          </div>

          <button className="gx-new" onClick={newChat}>
            <span>New chat</span>
            <i><Icon name="plus" size={18} sw={2.2} /></i>
          </button>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className="gx-main">
        <div className="gx-top">
          <div className="gx-top-l">
            {collapsed && <button className="gx-ib" onClick={() => setCollapsed(false)} aria-label="Open sidebar"><Icon name="panel" /></button>}
            <button className="gx-ib" onClick={newChat} aria-label="Back to start"><Icon name="back" size={18} /></button>
            <span className="gx-name">{current ? current.title : "New chat"}</span>
            <span className="gx-badge">{VERSION}</span>
          </div>
          <div className="gx-top-r">
            <button className={"gx-ib" + (current && current.saved ? " on" : "")} onClick={toggleSaved} aria-label="Bookmark chat" disabled={!activeId}><Icon name="bookmark" /></button>
            <button className={"gx-ib" + (shared ? " on" : "")} onClick={shareChat} aria-label="Copy conversation"><Icon name={shared ? "check" : "share"} /></button>
          </div>
        </div>

        <div className="gx-body" ref={bodyRef} onScroll={onScroll}>
          {empty ? (
            <div className="gx-card">
              <h1 className="gx-h">{HEADING}</h1>
              <p className="gx-p">{BLURB}</p>

              <div className="gx-feats">
                <button className="gx-feat" onClick={insertTemplate}>
                  <Icon name="bookmark" size={20} />
                  <div><b>Saved Prompt Templates</b><small>Tap to drop a ready-made prompt into the box.</small></div>
                </button>
                <button className="gx-feat" onClick={nextMode}>
                  <Icon name="media" size={20} />
                  <div><b>Media Type Selection</b><small>Tap to switch mode. Now: {mode}.</small></div>
                </button>
                <button className="gx-feat" onClick={nextLang}>
                  <Icon name="lang" size={20} />
                  <div><b>Multilingual Support</b><small>Tap to change reply language. Now: {lang}.</small></div>
                </button>
              </div>

              {tabs}
              {langNote}
              {inputBar}
            </div>
          ) : (
            <div className="gx-msgs">
              {messages.map((m, i) => {
                const last = i === messages.length - 1;
                if (m.role === "user") return <div className="gx-user" key={i}>{m.content}</div>;
                return (
                  <div className="gx-bot" key={i}>
                    <div className="gx-ans">
                      {m.content ? <Rich text={m.content} /> : <div className="gx-dotsl" role="status" aria-label="Thinking"><i /><i /><i /></div>}
                    </div>
                    {m.content && !(loading && last) && (
                      <div className="gx-act">
                        <CopyBtn text={m.content} />
                        {last && <button onClick={retry}><Icon name="retry" size={14} /> Try again</button>}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {!empty && (
          <div className="gx-dock">
            {showJump && (
              <button className="gx-jump" aria-label="Scroll to latest" onClick={() => endRef.current && endRef.current.scrollIntoView({ behavior: "smooth", block: "end" })}><Icon name="down" /></button>
            )}
            {tabs}
            {langNote}
            {inputBar}
          </div>
        )}

        <div className="gx-foot">{BOT_NAME} can make mistakes. Consider checking important information.</div>
      </main>
    </div>
  );
}