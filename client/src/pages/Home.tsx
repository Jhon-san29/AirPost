import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, Copy, ImagePlus, Link2, Mail, Palette, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type FlowKind = "intro" | "tease" | "question" | "yes" | "memory" | "custom";
type FlowButtonAction = "next" | "go_to_step" | "open_envelope" | "open_postcard" | "run_away" | "stay";
type FlowButton = { id: string; label: string; action: FlowButtonAction; targetStepId?: string };
type FlowStep = { id: string; kind: FlowKind; label: string; eyebrow: string; title: string; body: string; emoji: string; buttons?: FlowButton[]; image?: string; gif?: string };
type CardData = { to: string; from: string; message: string; occasion: string; theme: string; envelopeButtonLabel?: string; photo?: string; flow: FlowStep[] };
type SavedPostcard = { id: string; key: string; name: string; to: string; occasion: string; theme: string; updatedAt: string };

const themes = [
  { id: "sky", name: "ကောင်းကင်ပြာ", color: "#1585b2", soft: "#dff7ff" },
  { id: "coral", name: "ပန်းရောင်နွေး", color: "#df725f", soft: "#fff1e8" },
  { id: "plum", name: "ညနေခင်းခရမ်း", color: "#7c3d62", soft: "#f5eaf2" },
  { id: "sage", name: "ပန်းဥယျာဉ်", color: "#78947b", soft: "#edf4ed" },
  { id: "rose", name: "နှင်းဆီ", color: "#d94f7a", soft: "#ffe7ef" },
  { id: "lavender", name: "လာဗင်ဒါ", color: "#8b6bc1", soft: "#f0e9ff" },
  { id: "mint", name: "မင့်စိမ်း", color: "#3f9b83", soft: "#e4f6ee" },
  { id: "amber", name: "ပယင်းဝါ", color: "#c47b1b", soft: "#fff2d8" },
  { id: "ocean", name: "ပင်လယ်ပြာ", color: "#246f91", soft: "#e3f4fa" },
  { id: "berry", name: "ဘယ်ရီ", color: "#a83b68", soft: "#fde9f1" },
  { id: "lemon", name: "သံပုရာဝါ", color: "#858326", soft: "#f7f7dc" },
  { id: "tangerine", name: "လိမ္မော်", color: "#d35f2b", soft: "#fff0e5" },
  { id: "periwinkle", name: "ခရမ်းပြာ", color: "#667cc5", soft: "#e9edff" },
  { id: "peach", name: "မက်မွန်", color: "#d98772", soft: "#fff0e7" },
];
const templates: Record<string, Partial<CardData>> = {
  anniversary: { occasion: "နှစ်ပတ်လည်နေ့", message: "မင်းနဲ့အတူ ဖြတ်သန်းလာတဲ့နေ့တိုင်းက ကိုယ့်အတွက် အမှတ်တရပါ။ ဒီနေ့လည်း ချစ်နေတုန်းပဲနော်။" },
  birthday: { occasion: "မွေးနေ့", message: "မွေးနေ့မင်္ဂလာပါ ချစ်ရသူရေ။ မင်းရဲ့နှစ်သစ်မှာ လိုချင်သမျှ အားလုံးပြည့်ပါစေ။" },
  love: { occasion: "ချစ်ခြင်းစာ", message: "စကားလုံးတွေနဲ့မလောက်အောင် ချစ်တယ်။ မင်းရှိနေပေးတာကိုပဲ ကျေးဇူးတင်နေတယ်။" },
};
const defaultFlow: FlowStep[] = [
  { id: "intro", kind: "intro", label: "အစစာမျက်နှာ", eyebrow: "A LITTLE QUESTION FOR YOU", title: "မင်းကို\nတစ်ခုမေးချင်တယ်", body: "စာလေးမဖွင့်ခင်\nအရင်ဆုံး ဒီမေးခွန်းလေးကို ဖြေပေးနော်", emoji: "💌 ✨ 🥺" },
  { id: "tease", kind: "tease", label: "ရင်ခုန်စရာ", eyebrow: "WAIT, THERE IS MORE", title: "မဖွင့်ခင်\nရင်ခုန်နေပြီလား?", body: "ဒီစာထဲမှာ မင်းအတွက်\nစကားလေးတွေ၊ အမှတ်တရလေးတွေ ရှိတယ်", emoji: "👀 💌 ✨" },
  { id: "question", kind: "question", label: "မေးခွန်း", eyebrow: "BE HONEST, OKAY?", title: "ငါ့ကို\nချစ်လား?", body: "မင်းရဲ့အဖြေကို\nရင်ခုန်ပြီး စောင့်နေတယ်...", emoji: "🥺 💗" },
  { id: "yes", kind: "yes", label: "အဖြေမှန်ပြီ", eyebrow: "I KNEW IT!", title: "သိပါတယ်...\nမင်းကချစ်တယ်", body: "အဖြေမှန်လို့ ဆုလေးရမယ်။\nဒါပေမယ့် နောက်တစ်ခုကြည့်ဦး", emoji: "🥰 💞 🌷" },
  { id: "memory", kind: "memory", label: "အမှတ်တရ", eyebrow: "ONE LITTLE MEMORY", title: "မင်းနဲ့ဆို\nနေ့တိုင်းက အမှတ်တရ", body: "အခုတော့ မင်းအတွက် ပြင်ထားတဲ့\npostcard လေးကို ဖွင့်ကြည့်လိုက်ပါ", emoji: "📸 🌷 💙 ✨" },
];
const initial: CardData = { to: "My Love", from: "မင်းရဲ့သူ", message: "မင်းနဲ့အတူ ဖြတ်သန်းလာတဲ့နေ့တိုင်းက ကိုယ့်အတွက် အမှတ်တရပါ။ ဒီနေ့လည်း ချစ်နေတုန်းပဲနော်။", occasion: "နှစ်ပတ်လည်နေ့", theme: "sky", envelopeButtonLabel: "စာလေးဖွင့်ကြည့်ပါ", flow: defaultFlow };
function newStorageId() { return crypto.randomUUID(); }
function defaultButtonsForStep(step: FlowStep): FlowButton[] {
  if (step.kind === "question") return [
    { id: `${step.id}-yes`, label: "ချစ်တယ်", action: "next" },
    { id: `${step.id}-no`, label: "မချစ်ဘူး", action: "run_away" },
  ];
  const label = step.kind === "memory" ? "စာအိတ်လေးဖွင့်မယ်" : step.kind === "yes" ? "ကြည့်မယ်" : "နောက်တစ်ဆင့်";
  return [{ id: `${step.id}-continue`, label, action: "next" }];
}
const buttonActions: { value: FlowButtonAction; label: string }[] = [
  { value: "next", label: "နောက်တစ်ဆင့်သို့သွားမယ်" },
  { value: "go_to_step", label: "ရွေးထားတဲ့ Flow card ကိုသွားမယ်" },
  { value: "open_envelope", label: "စာအိတ်ဖွင့်မယ်" },
  { value: "open_postcard", label: "Postcard ကိုတိုက်ရိုက်ဖွင့်မယ်" },
  { value: "run_away", label: "လှည့်ပြေးမယ်" },
  { value: "stay", label: "ဒီနေရာမှာပဲနေမယ်" },
];

export default function Home() {
  const utils = trpc.useUtils();
  const savedPostcardsQuery = trpc.postcards.list.useQuery();
  const saveToStorage = trpc.postcards.save.useMutation();
  const removeFromStorage = trpc.postcards.remove.useMutation({ onSuccess: () => { void utils.postcards.list.invalidate(); } });
  const [card, setCard] = useState<CardData>(initial);
  const [storageId, setStorageId] = useState<string>(newStorageId);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const savedCards: SavedPostcard[] = savedPostcardsQuery.data?.postcards ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const activeTheme = themes.find((item) => item.id === card.theme) ?? themes[0];
  const update = (key: keyof CardData, value: string) => { setShareUrl(""); setCard((current) => ({ ...current, [key]: value })); };
  const applyTemplate = (key: string) => { setShareUrl(""); setCard((current) => ({ ...current, ...templates[key] })); };
  const updateFlow = (index: number, key: keyof FlowStep, value: string) => { setShareUrl(""); setCard((current) => ({ ...current, flow: current.flow.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) })); };
  const updateFlowButton = (index: number, buttonIndex: number, key: keyof FlowButton, value: string) => { setShareUrl(""); setCard((current) => ({ ...current, flow: current.flow.map((step, stepIndex) => { if (stepIndex !== index) return step; const buttons = [...(step.buttons?.length ? step.buttons : defaultButtonsForStep(step))]; const button = { ...buttons[buttonIndex], [key]: value } as FlowButton; if (key === "action" && value === "go_to_step" && !button.targetStepId) button.targetStepId = step.id; buttons[buttonIndex] = button; return { ...step, buttons }; }) })); };
  const addFlowButton = (index: number) => { setShareUrl(""); setCard((current) => ({ ...current, flow: current.flow.map((step, stepIndex) => { if (stepIndex !== index) return step; const buttons = step.buttons?.length ? step.buttons : defaultButtonsForStep(step); if (buttons.length >= 8) return step; return { ...step, buttons: [...buttons, { id: `${step.id}-button-${crypto.randomUUID()}`, label: "နှိပ်ပါ", action: "next" }] }; }) })); };
  const removeFlowButton = (index: number, buttonIndex: number) => { setShareUrl(""); setCard((current) => ({ ...current, flow: current.flow.map((step, stepIndex) => { if (stepIndex !== index) return step; const buttons = step.buttons?.length ? step.buttons : defaultButtonsForStep(step); return buttons.length <= 1 ? step : { ...step, buttons: buttons.filter((_, itemIndex) => itemIndex !== buttonIndex) }; }) })); };
  const moveFlow = (index: number, direction: -1 | 1) => { setShareUrl(""); setCard((current) => { const next = [...current.flow]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, flow: next }; }); };
  const removeFlow = (index: number) => { setShareUrl(""); setCard((current) => { const removedId = current.flow[index]?.id; const flow = current.flow.filter((_, stepIndex) => stepIndex !== index); if (!removedId || flow.length === 0) return current; const fallbackTargetId = flow[Math.min(index, flow.length - 1)].id; return { ...current, flow: flow.map((step) => step.buttons ? { ...step, buttons: step.buttons.map((button) => button.action === "go_to_step" && button.targetStepId === removedId ? { ...button, targetStepId: fallbackTargetId } : button) } : step) }; }); };
  const addFlow = () => { setShareUrl(""); setCard((current) => ({ ...current, flow: [...current.flow, { id: `custom-${Date.now()}`, kind: "custom", label: "အသစ်ထည့်ထားသောစာမျက်နှာ", eyebrow: "A LITTLE NOTE", title: "မင်းအတွက်\nစာလေးတစ်စောင်", body: "ဒီနေရာမှာ ကိုယ်ပြောချင်တဲ့\nစာသားလေးရေးပါ", emoji: "💌 ✨" }] })); };
  const updateFlowImage = (index: number, file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => updateFlow(index, "image", String(reader.result)); reader.readAsDataURL(file); };
  const updateFlowGif = (index: number, file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => updateFlow(index, "gif", String(reader.result)); reader.readAsDataURL(file); };
  const publishCard = async () => {
    const name = saveName.trim() || `${card.to || "မင်းအတွက်"} · ${card.occasion}`;
    const result = await saveToStorage.mutateAsync({ postcardId: storageId, name, card });
    const savedCard = result.card as CardData;
    const url = `${window.location.origin}/view#storage=${encodeURIComponent(result.key)}`;
    setCard(savedCard);
    setActiveId(result.item.id);
    setSaveName(result.item.name);
    setShareUrl(url);
    await utils.postcards.list.invalidate();
    return { card: savedCard, url };
  };
  const savePostcard = async () => {
    try {
      await publishCard();
      toast.success("Postcard နဲ့ media တွေကို cloud storage ထဲသိမ်းပြီးပါပြီ");
    } catch (error) {
      console.error("[Postcards] Save failed:", error);
      toast.error("သိမ်းလို့မရပါ။ Cloud storage configuration ကိုစစ်ပါ။");
    }
  };
  const loadPostcard = async (item: SavedPostcard) => {
    try {
      const result = await utils.postcards.load.fetch({ key: item.key });
      setCard(result.card as CardData);
      setStorageId(item.id);
      setShareUrl("");
      setActiveId(item.id);
      setSaveName(item.name);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[Postcards] Cloud load failed:", error);
      toast.error("Cloud storage မှ postcard ကိုဖွင့်မရပါ။");
    }
  };
  const deletePostcard = async (id: string) => {
    try {
      await removeFromStorage.mutateAsync({ id });
      if (activeId === id) { setActiveId(null); setSaveName(""); setStorageId(newStorageId()); setShareUrl(""); setCard(initial); }
      toast.success("Cloud postcard စာရင်းမှ ဖယ်ရှားပြီးပါပြီ");
    } catch (error) {
      console.error("[Postcards] Cloud remove failed:", error);
      toast.error("Cloud postcard စာရင်းမှ ဖယ်ရှားမရပါ။");
    }
  };
  const newPostcard = () => { setCard(initial); setStorageId(newStorageId()); setShareUrl(""); setActiveId(null); setSaveName(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const copyText = async (text: string) => { try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } const helper = document.createElement("textarea"); helper.value = text; helper.setAttribute("readonly", ""); helper.style.position = "fixed"; helper.style.left = "-9999px"; helper.style.opacity = "0"; document.body.appendChild(helper); helper.focus(); helper.select(); helper.setSelectionRange(0, helper.value.length); const copiedWithFallback = document.execCommand("copy"); helper.remove(); return copiedWithFallback; } catch { return false; } };
  const copyLink = async () => {
    try {
      const { url } = await publishCard();
      const copiedSuccessfully = await copyText(url);
      if (copiedSuccessfully) { setCopied(true); toast.success("Cloud postcard link ကို copy လုပ်ပြီးပါပြီ"); window.setTimeout(() => setCopied(false), 1800); }
      else { toast.error("Copy မရပါ။ အောက်က link ကို ဖိထားပြီး copy လုပ်ပါ။"); }
    } catch (error) {
      console.error("[Postcards] Share-link creation failed:", error);
      toast.error("Share link မထုတ်နိုင်ပါ။ Cloud storage configuration ကိုစစ်ပါ။");
    }
  };
  const nativeShare = async () => {
    try {
      const { url } = await publishCard();
      if (navigator.share) { await navigator.share({ title: "EPOSTCARD", text: `မင်းအတွက် ${card.occasion} စာလေး`, url }); return; }
      const copiedSuccessfully = await copyText(url);
      if (copiedSuccessfully) toast.success("Cloud postcard link ကို copy လုပ်ပြီးပါပြီ");
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      console.error("[Postcards] Share failed:", error);
      toast.error("Share link မထုတ်နိုင်ပါ။ Cloud storage configuration ကိုစစ်ပါ။");
    }
  };
  const openShareView = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try { const { url } = await publishCard(); window.location.assign(url); }
    catch (error) { console.error("[Postcards] Preview link creation failed:", error); toast.error("Postcard link မဖွင့်နိုင်ပါ။ Cloud storage configuration ကိုစစ်ပါ။"); }
  };

  return <main className="editor-shell" style={{ "--theme": activeTheme.color, "--soft": activeTheme.soft } as React.CSSProperties}>
    <header className="topbar"><a className="brand" href="/edit"><span className="brand-seal">♥</span><span>EPOSTCARD</span></a><div className="topbar-note"><Sparkles size={14} /> မင်းအတွက် စာတစ်စောင်</div><a className="open-link" href="/view" onClick={openShareView}><Mail size={15} /> ကိုယ်ပြင်ထားတာကြည့်ရန်</a></header>
    <section className="editor-grid">
      <div className="controls-panel">
        <div className="eyebrow">CREATE A LITTLE KEEPSAKE</div><h1>မင်းရဲ့စာလေးကို<br /><em>လှလှလေးပို့မယ်။</em></h1><p className="intro">အောက်က flow card တစ်ခုချင်းစီကို စိတ်ကြိုက်ပြင်ပြီး ကိုယ့်ရဲ့ love story လေးကို တည်ဆောက်လိုက်ပါ။</p>
        <div className="manager-bar"><div><span className="share-label">POSTCARD MANAGER</span><strong>{activeId ? "ပြင်နေသော postcard" : "Postcard အသစ်"}</strong></div><button className="new-postcard-button" onClick={newPostcard}><Plus size={15} /> အသစ်လုပ်မယ်</button></div>{savedPostcardsQuery.error && <p className="manager-storage-error">Cloud postcard စာရင်းကိုဖွင့်မရပါ။ Storage configuration ကိုစစ်ပါ။</p>}
        <div className="save-row"><input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Postcard အမည် — ဥပမာ My Love" /><button className="save-button" onClick={savePostcard} disabled={saveToStorage.isPending}><Save size={15} /> {saveToStorage.isPending ? "သိမ်းနေသည်…" : "Save"}</button></div>
        {savedCards.length > 0 && <div className="saved-list"><div className="saved-list-title">သိမ်းထားတဲ့ postcard များ <span>{savedCards.length}</span></div>{savedCards.map((saved) => <div className={`saved-item ${saved.id === activeId ? "active" : ""}`} key={saved.id}><button className="saved-item-main" onClick={() => loadPostcard(saved)}><span className="saved-swatch" style={{ background: themes.find((theme) => theme.id === saved.theme)?.color }} /><span><strong>{saved.name}</strong><small>{saved.to} · {saved.occasion}</small></span></button><button className="saved-delete" onClick={() => deletePostcard(saved.id)} aria-label="delete saved postcard"><X size={14} /></button></div>)}</div>}
        <div className="section-label"><span>01</span> စာအချက်အလက်</div><div className="field-row"><label>လက်ခံမည့်သူ<input value={card.to} onChange={(e) => update("to", e.target.value)} placeholder="ဥပမာ - မေမေ" /></label><label>ပေးပို့သူ<input value={card.from} onChange={(e) => update("from", e.target.value)} placeholder="ဥပမာ - ကိုကို" /></label></div>
        <label>အခါသမယ<select value={card.occasion} onChange={(e) => update("occasion", e.target.value)}><option>နှစ်ပတ်လည်နေ့</option><option>မွေးနေ့</option><option>ချစ်ခြင်းစာ</option></select></label><label>Postcard အချစ်စာ<textarea value={card.message} onChange={(e) => update("message", e.target.value)} maxLength={220} rows={4} placeholder="မင်းပြောချင်တဲ့စကားလေး..." /><small>{card.message.length}/220</small></label><label>စာအိတ်ဖွင့်ခလုတ်စာသား<input value={card.envelopeButtonLabel ?? "စာလေးဖွင့်ကြည့်ပါ"} onChange={(e) => update("envelopeButtonLabel", e.target.value)} maxLength={100} /></label>
        <div className="section-label"><span>02</span> အသင့်သုံးစာပုံစံ</div><div className="template-row">{Object.entries({ anniversary: "Anniversary", birthday: "Birthday", love: "Just because" }).map(([key, name]) => <button key={key} className="template-chip" onClick={() => applyTemplate(key)}>{name}</button>)}</div>
        <div className="section-label"><span>03</span> အရောင်နဲ့ဓာတ်ပုံ</div><div className="theme-row"><Palette size={17} /> {themes.map((theme) => <button aria-label={theme.name} key={theme.id} className={`theme-dot ${card.theme === theme.id ? "selected" : ""}`} style={{ background: theme.color }} onClick={() => update("theme", theme.id)} />)}</div><label className="photo-upload"><ImagePlus size={18} /><span>{card.photo ? "ဓာတ်ပုံပြောင်းရန်" : "Postcard ဓာတ်ပုံထည့်ရန်"}<small>PNG / JPG · optional</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => update("photo", String(reader.result)); reader.readAsDataURL(file); }} /></label>
        <div className="section-label flow-heading"><span>04</span> Flow ထဲကစာနဲ့ပုံပြင်မယ် <small>{card.flow.length} cards</small></div>
        <div className="flow-editor">{card.flow.map((step, index) => <article className="flow-edit-card" key={step.id}><div className="flow-edit-head"><span className="flow-index">{String(index + 1).padStart(2, "0")}</span><input className="flow-label-input" value={step.label} onChange={(e) => updateFlow(index, "label", e.target.value)} /><div className="flow-order"><button disabled={index === 0} onClick={() => moveFlow(index, -1)} aria-label="move up"><ChevronUp size={14} /></button><button disabled={index === card.flow.length - 1} onClick={() => moveFlow(index, 1)} aria-label="move down"><ChevronDown size={14} /></button><button className="flow-delete" disabled={card.flow.length <= 1} onClick={() => removeFlow(index)} aria-label="delete"><Trash2 size={14} /></button></div></div><div className="flow-mini-grid"><label>Emoji<input value={step.emoji} onChange={(e) => updateFlow(index, "emoji", e.target.value)} /></label></div><div className="flow-button-editor"><div className="flow-button-heading"><strong>ခလုတ်များ · {(step.buttons?.length ?? defaultButtonsForStep(step).length)}/8</strong><span>အနည်းဆုံး ၁ ခု၊ အများဆုံး ၈ ခု</span></div>{(step.buttons?.length ? step.buttons : defaultButtonsForStep(step)).map((button, buttonIndex) => <div className="flow-button-card" key={button.id}><div className="flow-button-title"><strong>ခလုတ် {buttonIndex + 1}</strong><button type="button" className="remove-flow-button" onClick={() => removeFlowButton(index, buttonIndex)} disabled={(step.buttons?.length ?? defaultButtonsForStep(step).length) <= 1}>ဖယ်ရန်</button></div><label>ခလုတ်စာသား<input value={button.label} maxLength={100} onChange={(e) => updateFlowButton(index, buttonIndex, "label", e.target.value)} /></label><label>ခလုတ်လုပ်ဆောင်ချက်<select value={button.action} onChange={(e) => updateFlowButton(index, buttonIndex, "action", e.target.value as FlowButtonAction)}>{buttonActions.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}</select></label>{button.action === "go_to_step" && <label>သွားမည့် Flow card<select value={button.targetStepId ?? step.id} onChange={(e) => updateFlowButton(index, buttonIndex, "targetStepId", e.target.value)}>{card.flow.map((target) => <option key={target.id} value={target.id}>{target.label || target.title.replace(/\n/g, " ")}</option>)}</select></label>}</div>)}<button type="button" className="add-flow-button add-flow-button-small" onClick={() => addFlowButton(index)} disabled={(step.buttons?.length ?? defaultButtonsForStep(step).length) >= 8}><Plus size={14} /> ခလုတ်ထပ်ထည့်</button></div><label>စာခေါင်းစဉ်<textarea className="flow-title-input" value={step.title} onChange={(e) => updateFlow(index, "title", e.target.value)} rows={2} /></label><label>အောက်ကစာ<textarea value={step.body} onChange={(e) => updateFlow(index, "body", e.target.value)} rows={2} /></label><div className="flow-media-row"><label className="flow-image-upload"><ImagePlus size={15} /><span>{step.image ? "ပုံပြောင်းရန်" : "ဒီ flow card ထဲ ပုံထည့်ရန်"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => updateFlowImage(index, e.target.files?.[0])} /></label><label className="flow-image-upload gif-upload"><span>{step.gif ? "GIF ပြောင်းရန်" : "GIF ထည့်ရန်"}</span><input type="file" accept="image/gif,.gif" onChange={(e) => updateFlowGif(index, e.target.files?.[0])} /></label></div><label className="gif-url-field">GIF URL (optional)<input value={step.gif?.startsWith("data:") ? "" : (step.gif ?? "")} onChange={(e) => updateFlow(index, "gif", e.target.value)} placeholder="https://.../love.gif" /></label>{step.image && <img className="flow-thumb" src={step.image} alt="flow preview" />}{step.gif && <img className="flow-gif-thumb" src={step.gif} alt="animated gif preview" />}</article>)}</div>
        <button className="add-flow-button" onClick={addFlow}><Plus size={16} /> Flow card အသစ်ထည့်မယ်</button>
      </div>
      <div className="preview-panel"><div className="preview-caption"><span>LIVE PREVIEW</span><span className="live-dot">● live</span></div><div className="postcard-wrap"><div className="petal petal-a">✦</div><div className="petal petal-b">✿</div><article className="postcard" style={{ background: activeTheme.soft }}><div className="card-topline"><span>EPOSTCARD</span><span>{card.occasion}</span></div><div className="card-flower">✿</div><div className="card-scene">{card.photo ? <img className="card-photo" src={card.photo} alt="uploaded memory" /> : <div className="card-photo-placeholder"><span>♡</span><small>your memory</small></div>}<div className="bouquet" aria-hidden="true"><i>✿</i><i>✿</i><i>✿</i><i>✿</i><b>✦</b><em>⌁</em></div></div><div className="card-copy"><p className="card-to">To, <strong>{card.to || "ချစ်ရသူ"}</strong></p><p className="card-message">{card.message || "မင်းအတွက် စာလေးတစ်စောင်..."}</p><p className="card-from">အချစ်များစွာဖြင့်<br /><strong>{card.from || "မင်းရဲ့သူ"}</strong></p></div><div className="card-envelope" style={{ borderColor: activeTheme.color }}><span>♥</span></div><div className="card-qr" aria-label="share QR code">{Array.from({ length: 36 }).map((_, index) => <i key={index} />)}</div><div className="card-stamp" style={{ background: activeTheme.color }}>♥</div><div className="card-footer">made with a little love · 2026</div></article></div><div className="share-box"><div><span className="share-label">READY TO SEND?</span><strong>ပြင်ထားတဲ့ flow အားလုံးနဲ့ ပို့လိုက်ပါ</strong></div><div className="share-actions"><button className="secondary-button" onClick={copyLink} disabled={saveToStorage.isPending}><Copy size={16} /> {copied ? "Copied" : "Link copy"}</button><button className="primary-button" onClick={nativeShare} disabled={saveToStorage.isPending}><Link2 size={16} /> Share</button></div><div className="share-link-field"><input readOnly value={shareUrl} placeholder="Share / Copy နှိပ်ပြီး link ထုတ်ပါ" aria-label="share URL" onFocus={(event) => event.currentTarget.select()} /><button onClick={copyLink} disabled={saveToStorage.isPending}>{copied ? "Copied" : "Copy"}</button></div></div></div>
    </section><footer className="footer-note">made for the people we love <span>♥</span></footer>
  </main>;
}
