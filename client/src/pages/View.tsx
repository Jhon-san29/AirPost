import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Heart, Share2 } from "lucide-react";

type FlowKind = "intro" | "tease" | "question" | "yes" | "memory" | "custom";
type FlowButtonAction = "next" | "go_to_step" | "open_envelope" | "open_postcard" | "run_away" | "stay";
type FlowButton = { id: string; label: string; action: FlowButtonAction; targetStepId?: string };
type FlowStep = { id: string; kind: FlowKind; label: string; eyebrow: string; title: string; body: string; emoji: string; buttons?: FlowButton[]; image?: string; gif?: string };
type CardData = { to: string; from: string; message: string; occasion: string; theme: string; envelopeButtonLabel?: string; photo?: string; flow?: FlowStep[] };
const fallbackFlow: FlowStep[] = [
  { id: "intro", kind: "intro", label: "အစစာမျက်နှာ", eyebrow: "A LITTLE QUESTION FOR YOU", title: "မင်းကို\nတစ်ခုမေးချင်တယ်", body: "စာလေးမဖွင့်ခင်\nအရင်ဆုံး ဒီမေးခွန်းလေးကို ဖြေပေးနော်", emoji: "💌 ✨ 🥺" },
  { id: "tease", kind: "tease", label: "ရင်ခုန်စရာ", eyebrow: "WAIT, THERE IS MORE", title: "မဖွင့်ခင်\nရင်ခုန်နေပြီလား?", body: "ဒီစာထဲမှာ မင်းအတွက်\nစကားလေးတွေ၊ အမှတ်တရလေးတွေ ရှိတယ်", emoji: "👀 💌 ✨" },
  { id: "question", kind: "question", label: "မေးခွန်း", eyebrow: "BE HONEST, OKAY?", title: "ငါ့ကို\nချစ်လား?", body: "မင်းရဲ့အဖြေကို\nရင်ခုန်ပြီး စောင့်နေတယ်...", emoji: "🥺 💗" },
  { id: "yes", kind: "yes", label: "အဖြေမှန်ပြီ", eyebrow: "I KNEW IT!", title: "သိပါတယ်...\nမင်းကချစ်တယ်", body: "အဖြေမှန်လို့ ဆုလေးရမယ်။\nဒါပေမယ့် နောက်တစ်ခုကြည့်ဦး", emoji: "🥰 💞 🌷" },
  { id: "memory", kind: "memory", label: "အမှတ်တရ", eyebrow: "ONE LITTLE MEMORY", title: "မင်းနဲ့ဆို\nနေ့တိုင်းက အမှတ်တရ", body: "အခုတော့ မင်းအတွက် ပြင်ထားတဲ့\npostcard လေးကို ဖွင့်ကြည့်လိုက်ပါ", emoji: "📸 🌷 💙 ✨" },
];
const fallback: CardData = { to: "My Love", from: "မင်းရဲ့သူ", message: "မင်းရှိနေပေးတာကိုပဲ ကျေးဇူးတင်နေတယ်။ ဒီနေ့လည်း ချစ်နေတုန်းပဲနော်။", occasion: "နှစ်ပတ်လည်နေ့", theme: "sky", flow: fallbackFlow };
const colors: Record<string, { color: string; soft: string }> = { sky: { color: "#1585b2", soft: "#dff7ff" }, coral: { color: "#df725f", soft: "#fff1e8" }, plum: { color: "#7c3d62", soft: "#f5eaf2" }, sage: { color: "#78947b", soft: "#edf4ed" }, rose: { color: "#d94f7a", soft: "#ffe7ef" }, lavender: { color: "#8b6bc1", soft: "#f0e9ff" }, mint: { color: "#3f9b83", soft: "#e4f6ee" }, amber: { color: "#c47b1b", soft: "#fff2d8" }, ocean: { color: "#246f91", soft: "#e3f4fa" }, berry: { color: "#a83b68", soft: "#fde9f1" }, lemon: { color: "#858326", soft: "#f7f7dc" }, tangerine: { color: "#d35f2b", soft: "#fff0e5" }, periwinkle: { color: "#667cc5", soft: "#e9edff" }, peach: { color: "#d98772", soft: "#fff0e7" } };
function decodeCard(raw: string | null): CardData { try { if (!raw) return fallback; const normalized = decodeURIComponent(raw).replace(/-/g, "+").replace(/_/g, "/"); const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "="); return JSON.parse(decodeURIComponent(escape(atob(padded)))); } catch { return fallback; } }
function splitTitle(title: string) { return title.split("\n").map((line, index) => <span key={`${line}-${index}`}>{line}{index < title.split("\n").length - 1 && <br />}</span>); }
function defaultButtonsForStep(step: FlowStep): FlowButton[] {
  if (step.kind === "question") return [{ id: `${step.id}-yes`, label: "ချစ်တယ်", action: "next" }, { id: `${step.id}-no`, label: "မချစ်ဘူး", action: "run_away" }];
  const label = step.kind === "memory" ? "စာအိတ်လေးဖွင့်မယ်" : step.kind === "yes" ? "ကြည့်မယ်" : "နောက်တစ်ဆင့်";
  return [{ id: `${step.id}-continue`, label, action: "next" }];
}

type Screen = number | "envelope" | "open";
export default function View() {
  const params = useMemo(() => { const search = new URLSearchParams(window.location.search); if (search.get("storage") || search.get("card")) return search; const hash = window.location.hash.replace(/^#\??/, ""); return new URLSearchParams(hash); }, []);
  const storageKey = params.get("storage");
  const storedPostcard = trpc.postcards.load.useQuery({ key: storageKey ?? "" }, { enabled: Boolean(storageKey), retry: false });
  const [card, setCard] = useState<CardData>(() => decodeCard(params.get("card")));
  useEffect(() => { if (storedPostcard.data?.card) setCard(storedPostcard.data.card as CardData); }, [storedPostcard.data]);
  const flow = card.flow?.length ? card.flow : fallbackFlow;
  const [screen, setScreen] = useState<Screen>(() => {
    if (params.get("open") === "1") return "open";
    const requested = params.get("stage");
    if (requested === "envelope") return "envelope";
    const index = flow.findIndex((step) => step.kind === requested || step.id === requested);
    return index >= 0 ? index : 0;
  });
  const [noTry, setNoTry] = useState(0);
  const tone = colors[card.theme] ?? colors.sky;
  const current = typeof screen === "number" ? flow[screen] : undefined;
  const next = () => { if (typeof screen !== "number") return; setScreen(screen + 1 < flow.length ? screen + 1 : "envelope"); };
  const currentButtons = current ? (current.buttons?.length ? current.buttons : defaultButtonsForStep(current)) : [];
  const handleFlowButton = (button: FlowButton) => {
    if (button.action === "next") { next(); return; }
    if (button.action === "go_to_step") { const target = flow.findIndex((step) => step.id === button.targetStepId); if (target >= 0) setScreen(target); else next(); return; }
    if (button.action === "open_envelope") { setScreen("envelope"); return; }
    if (button.action === "open_postcard") { setScreen("open"); return; }
    if (button.action === "run_away") setNoTry((value) => value + 1);
  };
  const share = async () => { if (navigator.share) await navigator.share({ title: "EPOSTCARD", text: `မင်းအတွက် ${card.occasion} စာလေး`, url: window.location.href }); else await navigator.clipboard?.writeText(window.location.href); };
  const noPositions = [{ x: 74, y: 0 }, { x: -72, y: 50 }, { x: 65, y: 86 }, { x: -35, y: -64 }, { x: 88, y: -48 }];
  const noPosition = noPositions[noTry % noPositions.length];
  const isQuestion = current?.kind === "question";
  const cardClass = `story-card ${current?.kind === "yes" ? "yes-card" : ""} ${current?.kind === "memory" ? "memory-card" : ""} ${current?.kind === "tease" ? "tease-card" : ""}`;
  return <main className="view-shell" style={{ "--theme": tone.color, "--soft": tone.soft } as React.CSSProperties}>
    <header className="view-header view-header-centered"><span className="view-spacer" /><a className="brand" href="/view"><span className="brand-seal">♥</span>EPOSTCARD</a><button className="icon-button" onClick={share} aria-label="share"><Share2 size={17} /></button></header>
    {storedPostcard.isLoading && <p className="view-footer">Postcard ကိုဖွင့်နေပါတယ်…</p>}
    {storedPostcard.error && <p className="view-footer">ဒီ postcard ကို storage မှဖွင့်မရပါ။ Link ကိုပြန်စစ်ပါ။</p>}
    {typeof screen === "number" ? <section className={`love-stage stage-${current?.kind ?? "custom"}`}>
      <div className="story-sparkles" aria-hidden="true"><span>✦</span><span>♡</span><span>✧</span><span>♥</span><span>·</span></div>
      <div className={cardClass}>
        <div className="emoji-orbit" aria-hidden="true"><span>{current?.emoji}</span><span>✨</span><span>💙</span><span>🌷</span></div>
        {current?.gif ? <img className="flow-hero-gif" src={current.gif} alt={`${current.label} animated`} /> : current?.image ? <img className="flow-hero-image" src={current.image} alt={current.label} /> : <div className={`story-icon ${current?.kind === "question" ? "question-emoji" : ""}`}>{current?.emoji}</div>}
        <h1>{splitTitle(current?.title ?? "")}</h1><p className="story-copy">{splitTitle(current?.body ?? "")}</p>
        <div className={`flow-button-list ${isQuestion ? "answer-buttons" : ""}`}>{currentButtons.map((button, buttonIndex) => <button key={button.id} className={button.action === "run_away" ? "no-button" : isQuestion && buttonIndex === 0 ? "yes-button" : "story-primary"} style={button.action === "run_away" ? { transform: `translate(${noPosition.x}px, ${noPosition.y}px)` } : undefined} onClick={() => handleFlowButton(button)} onMouseEnter={button.action === "run_away" ? () => setNoTry((value) => value + 1) : undefined}>{button.label.trim() || "ဆက်သွားရန်"} <span>{button.action === "run_away" ? "🥲" : isQuestion && buttonIndex === 0 ? "💗" : "→"}</span></button>)}</div>
        {isQuestion && currentButtons.some((button) => button.action === "run_away") && <p className="runaway-hint">မချစ်ဘူးကို နှိပ်ကြည့်လေ... 😏</p>}
        <div className="story-dots">{flow.map((step, index) => <i className={index === screen ? "active" : ""} key={step.id} />)}<i className={screen === flow.length ? "active" : ""} /></div>
      </div>
    </section> : <section className={`reveal-stage ${screen === "open" ? "is-open" : ""}`}>
      {screen === "envelope" ? <button className="envelope-button" onClick={() => setScreen("open")}><div className="envelope"><div className="envelope-flap" /><div className="envelope-letter"><Heart size={30} fill="currentColor" /></div><div className="envelope-front" /></div><span>{card.envelopeButtonLabel?.trim() || "စာလေးဖွင့်ကြည့်ပါ"}</span><small>tap to open</small></button> : <article className="revealed-card" style={{ background: tone.soft }}><div className="revealed-top"><span>{card.occasion}</span><span className="heart-mark">♥</span></div><div className="revealed-scene">{card.photo ? <img className="revealed-photo" src={card.photo} alt="memory" /> : <div className="revealed-photo-placeholder">♡<small>our memory</small></div>}<div className="revealed-bouquet" aria-hidden="true"><i>✿</i><i>✿</i><i>✿</i><i>✿</i><b>✦</b></div></div><p className="revealed-to">To, <strong>{card.to}</strong></p><p className="revealed-message">{card.message}</p><p className="revealed-from">အချစ်များစွာဖြင့်<br /><strong>{card.from}</strong></p><div className="revealed-envelope" style={{ borderColor: tone.color }}><span>♥</span></div><div className="revealed-qr">{Array.from({ length: 36 }).map((_, index) => <i key={index} />)}</div><div className="revealed-stamp" style={{ background: tone.color }}>♥</div></article>}
    </section>}
    <div className="view-footer">ဒီစာလေးက မင်းအတွက်ပဲ <Heart size={15} fill="currentColor" /></div>
  </main>;
}
