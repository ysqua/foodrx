import Head from "next/head";
import { useState, useRef } from "react";

// ─── Design tokens ────────────────────────────────────────────
const C = {
  teal50:"#E1F5EE", teal100:"#C3ECD9", teal200:"#5DCAA5",
  teal400:"#1D9E75", teal600:"#0F6E56", teal800:"#085041",
  stone50:"#F7F6F2", stone100:"#EDECE6", stone200:"#D8D6CE",
  stone400:"#9E9C94", stone600:"#5E5C56", stone800:"#2A2926",
  red50:"#FDECEA", red600:"#c0392b",
};
const font  = "'DM Sans', sans-serif";
const serif = "'Fraunces', serif";

// ─── Style helpers ────────────────────────────────────────────
const btn = (variant = "primary", extra = {}) => ({
  padding:"13px 28px", borderRadius:10, cursor:"pointer",
  fontSize:15, fontWeight:600, fontFamily:font, transition:"all 0.15s",
  border: variant === "outline" ? `2px solid ${C.teal400}` : variant === "secondary" ? `1px solid ${C.stone200}` : "none",
  background: variant === "primary" ? C.teal400 : variant === "secondary" ? C.stone100 : "transparent",
  color: variant === "primary" ? "white" : variant === "outline" ? C.teal400 : C.stone800,
  ...extra,
});

const chip = (active) => ({
  padding:"8px 16px", borderRadius:999, cursor:"pointer",
  fontFamily:font, fontSize:13, fontWeight: active ? 600 : 400,
  transition:"all 0.12s",
  border:`1.5px solid ${active ? C.teal400 : C.stone200}`,
  background: active ? C.teal50 : "white",
  color: active ? C.teal600 : C.stone600,
});

const card = (extra = {}) => ({
  background:"white", borderRadius:14,
  border:`1px solid ${C.stone100}`, padding:"20px 24px", ...extra,
});

// ─── Components ───────────────────────────────────────────────
function RiskBar({ label, value, national }) {
  const maxVal = Math.max(value, national) * 1.65;
  const vPct   = Math.min(value    / maxVal * 100, 100);
  const nPct   = Math.min(national / maxVal * 100, 100);
  const elevated = value > national * 1.15;
  const pctDiff  = Math.round((value - national) / national * 100);

  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:13, fontWeight:500, color:C.stone800 }}>{label}</span>
        <span style={{ fontSize:13, color: elevated ? C.red600 : C.stone600 }}>
          {value?.toFixed(1)}%
          {elevated && (
            <span style={{ fontSize:11, marginLeft:6, background:C.red50, color:C.red600,
              padding:"2px 8px", borderRadius:999, fontWeight:600 }}>
              ↑ {pctDiff}% above avg
            </span>
          )}
        </span>
      </div>
      <div style={{ position:"relative", height:9, background:C.stone100, borderRadius:999 }}>
        <div style={{ position:"absolute", left:0, top:0, height:"100%",
          width:`${vPct}%`, borderRadius:999, transition:"width 1.2s ease",
          background: elevated ? "#e74c3c" : C.teal400 }} />
        <div style={{ position:"absolute", top:-4, width:2, height:17,
          background:C.stone400, left:`${nPct}%`, borderRadius:1 }}
          title={`National avg: ${national}%`} />
      </div>
      <div style={{ fontSize:11, color:C.stone400, marginTop:3 }}>
        ▎ national avg: {national}%
      </div>
    </div>
  );
}

function Spinner({ msg, sub }) {
  return (
    <div style={{ minHeight:"100vh", background:C.stone50,
      display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:20 }}>
      <div style={{ width:52, height:52, borderRadius:"50%",
        border:`3px solid ${C.teal100}`, borderTopColor:C.teal400,
        animation:"spin 0.85s linear infinite" }} />
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:serif, fontSize:20, color:C.stone800, marginBottom:6 }}>{msg}</div>
        {sub && <div style={{ fontSize:13, color:C.stone400 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────
export default function FoodRx() {
  const [step,      setStep]      = useState("landing");
  const [oStep,     setOStep]     = useState(0);
  const [form,      setForm]      = useState({ zip:"", age:"", conditions:[], budget:100, restrictions:[] });
  const [risk,      setRisk]      = useState(null);
  const [plan,      setPlan]      = useState(null);
  const [error,     setError]     = useState("");
  const [activeDay, setActiveDay] = useState(0);
  const [activeTab, setActiveTab] = useState("meals");
  const zipRef = useRef();

  const AGES        = ["18–29","30–39","40–49","50–59","60–69","70+"];
  const CONDITIONS  = ["Type 2 diabetes","Hypertension","Pre-diabetes","Heart disease","High cholesterol","None"];
  const RESTRICTIONS= ["Vegetarian","Vegan","Gluten-free","Dairy-free","Nut-free","Halal","Kosher"];

  const toggle = (arr, val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  // ── Onboarding submit ───────────────────────────────────────
  async function handleNext() {
    setError("");
    if (oStep === 0 && !/^\d{5}$/.test(form.zip)) { setError("Enter a valid 5-digit ZIP code"); return; }
    if (oStep === 1 && !form.age)                  { setError("Please select your age range");   return; }
    if (oStep < 4) { setOStep(o => o + 1); return; }

    setStep("loadRisk");
    try {
      const res  = await fetch(`/api/risk?zip=${form.zip}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load risk data");
      setRisk(data);
      setStep("risk");
    } catch (e) {
      setError(e.message || "Couldn't load health data. Please try again.");
      setStep("onboard");
    }
  }

  // ── Generate plan ───────────────────────────────────────────
  async function handleGetPlan() {
    setStep("loadPlan");
    try {
      const res  = await fetch("/api/plan", {
        method:  "POST",
        headers: { "Content-Type":"application/json" },
        body:    JSON.stringify({ form, risk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");
      setPlan(data);
      setActiveDay(0);
      setActiveTab("meals");
      setStep("plan");
    } catch (e) {
      setError(e.message || "Couldn't generate plan. Please try again.");
      setStep("risk");
    }
  }

  function restart() {
    setStep("landing"); setRisk(null); setPlan(null);
    setForm({ zip:"", age:"", conditions:[], budget:100, restrictions:[] });
    setOStep(0); setError("");
  }

  // ════════════════════════════════════════════════════════════
  // LANDING PAGE
  // ════════════════════════════════════════════════════════════
  if (step === "landing") return (
    <>
      <Head><title>FoodRx — Eat for your ZIP code</title></Head>
      <div style={{ minHeight:"100vh", background:C.stone50 }}>

        {/* NAV */}
        <nav style={{ padding:"16px 32px", display:"flex", justifyContent:"space-between",
          alignItems:"center", background:"white", borderBottom:`1px solid ${C.stone100}`,
          position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:C.teal400,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🥦</div>
            <span style={{ fontSize:17, fontWeight:700, color:C.stone800, fontFamily:serif }}>FoodRx</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:12, color:C.stone400, display:"none" }}>Powered by CDC PLACES + USDA</span>
            <button style={btn("primary", { padding:"9px 20px", fontSize:13 })}
              onClick={() => setStep("onboard")}>
              Free risk report →
            </button>
          </div>
        </nav>

        {/* HERO */}
        <div style={{ maxWidth:720, margin:"0 auto", padding:"80px 24px 50px", textAlign:"center" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.teal50,
            color:C.teal600, fontSize:12, fontWeight:600, letterSpacing:"0.08em",
            textTransform:"uppercase", padding:"6px 16px", borderRadius:999, marginBottom:28,
            border:`1px solid ${C.teal100}` }}>
            🔬 Powered by real CDC + USDA open data
          </div>
          <h1 style={{ fontFamily:serif, fontSize:"clamp(36px, 6vw, 58px)", fontWeight:700,
            lineHeight:1.08, color:C.stone800, marginBottom:22 }}>
            Eat for your ZIP code.<br />
            <em style={{ color:C.teal400 }}>Not someone else&apos;s.</em>
          </h1>
          <p style={{ fontSize:"clamp(15px, 2vw, 18px)", color:C.stone600, lineHeight:1.7,
            maxWidth:560, margin:"0 auto 44px" }}>
            A 42-year-old in Memphis faces different disease risks than a 42-year-old in Boulder.
            FoodRx builds your grocery plan around real CDC chronic disease data for{" "}
            <em>your exact community</em>.
          </p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", alignItems:"center" }}>
            <button style={btn("primary", { fontSize:16, padding:"16px 40px" })}
              onClick={() => setStep("onboard")}>
              Get my free risk report →
            </button>
            <span style={{ fontSize:13, color:C.stone400 }}>⏱ Under 3 min · No account needed</span>
          </div>
        </div>

        {/* DATA SOURCES BANNER */}
        <div style={{ background:C.teal800, padding:"28px 32px", marginBottom:60 }}>
          <div style={{ maxWidth:760, margin:"0 auto",
            display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:28 }}>
            {[
              { val:"CDC PLACES 2024", label:"Disease prevalence source" },
              { val:"ZCTA Level",      label:"Your exact ZIP code area" },
              { val:"40 measures",     label:"Health indicators tracked" },
              { val:"USDA ERS",        label:"Grocery price data" },
            ].map(s => (
              <div key={s.label} style={{ color:"white", textAlign:"center" }}>
                <div style={{ fontFamily:serif, fontSize:19, fontWeight:700 }}>{s.val}</div>
                <div style={{ fontSize:12, opacity:0.55, marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{ maxWidth:640, margin:"0 auto", padding:"0 24px 80px" }}>
          <h2 style={{ fontFamily:serif, fontSize:30, fontWeight:700, color:C.stone800,
            textAlign:"center", marginBottom:36 }}>How it works</h2>
          {[
            { n:"01", t:"Enter your ZIP code",
              b:"We query the CDC PLACES API for real BRFSS-based model estimates for your exact ZIP Code Tabulation Area." },
            { n:"02", t:"Answer 4 quick questions",
              b:"Age range, weekly grocery budget, existing conditions, and dietary restrictions. About 60 seconds." },
            { n:"03", t:"See your local risk profile",
              b:"A side-by-side comparison of your community's diabetes, hypertension, obesity, and heart disease rates vs the national average." },
            { n:"04", t:"Get your AI-powered grocery plan",
              b:"Claude generates a personalized 7-day meal plan and grocery list following ADA/AHA guidelines, priced with USDA data." },
          ].map((s, i) => (
            <div key={i} style={{ display:"flex", gap:20, padding:"22px 0",
              borderBottom: i < 3 ? `1px solid ${C.stone100}` : "none" }}>
              <div style={{ fontFamily:serif, fontSize:36, fontWeight:700,
                color:C.teal200, minWidth:54, lineHeight:1 }}>{s.n}</div>
              <div>
                <div style={{ fontSize:15, fontWeight:600, color:C.stone800, marginBottom:5 }}>{s.t}</div>
                <div style={{ fontSize:13, color:C.stone500, lineHeight:1.65 }}>{s.b}</div>
              </div>
            </div>
          ))}
          <div style={{ textAlign:"center", marginTop:44 }}>
            <button style={btn("primary", { fontSize:15, padding:"14px 36px" })}
              onClick={() => setStep("onboard")}>
              Start for free →
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // ════════════════════════════════════════════════════════════
  // ONBOARDING
  // ════════════════════════════════════════════════════════════
  if (step === "onboard") {
    const questions = [
      {
        q:"What's your ZIP code?",
        hint:"We'll query the CDC PLACES API to pull real chronic disease data for your ZIP Code Tabulation Area.",
        content:(
          <input type="text" maxLength={5} placeholder="e.g. 33101" value={form.zip} autoFocus
            ref={zipRef}
            onChange={e => setForm(f => ({ ...f, zip:e.target.value.replace(/\D/g,"") }))}
            onKeyDown={e => e.key === "Enter" && handleNext()}
            style={{ width:"100%", padding:"16px 20px", borderRadius:12,
              border:`2px solid ${form.zip.length===5 ? C.teal400 : C.stone200}`,
              fontSize:22, fontFamily:font, outline:"none",
              letterSpacing:"0.12em", color:C.stone800, background:"white" }} />
        ),
      },
      {
        q:"What's your age range?",
        hint:"Risk weighting changes significantly by decade.",
        content:(
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {AGES.map(a => (
              <button key={a} style={chip(form.age===a)}
                onClick={() => setForm(f => ({ ...f, age:a }))}>{a}</button>
            ))}
          </div>
        ),
      },
      {
        q:"Any diagnosed conditions?",
        hint:"Unlocks condition-specific food rules from ADA, AHA, and NCI guidelines.",
        content:(
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {CONDITIONS.map(c => (
              <button key={c} style={chip(form.conditions.includes(c))} onClick={() => {
                if (c==="None") setForm(f => ({ ...f, conditions:f.conditions.includes("None")?[]:["None"] }));
                else setForm(f => ({ ...f, conditions:toggle(f.conditions.filter(x=>x!=="None"),c) }));
              }}>{c}</button>
            ))}
          </div>
        ),
      },
      {
        q:"Weekly grocery budget?",
        hint:"We filter USDA ERS price data to keep your plan affordable.",
        content:(
          <div>
            <div style={{ textAlign:"center", marginBottom:14 }}>
              <span style={{ fontFamily:serif, fontSize:40, fontWeight:700, color:C.teal400 }}>
                ${form.budget}
              </span>
              <span style={{ fontSize:16, color:C.stone400 }}> / week</span>
            </div>
            <input type="range" min={30} max={300} step={5} value={form.budget}
              onChange={e => setForm(f => ({ ...f, budget:parseInt(e.target.value) }))}
              style={{ width:"100%" }} />
            <div style={{ display:"flex", justifyContent:"space-between",
              fontSize:12, color:C.stone400, marginTop:6 }}>
              <span>$30 / week</span><span>$300 / week</span>
            </div>
          </div>
        ),
      },
      {
        q:"Any dietary restrictions?",
        hint:"Optional — incompatible foods are removed from your plan.",
        content:(
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {RESTRICTIONS.map(r => (
              <button key={r} style={chip(form.restrictions.includes(r))}
                onClick={() => setForm(f => ({ ...f, restrictions:toggle(f.restrictions,r) }))}>{r}</button>
            ))}
            <button style={chip(form.restrictions.length===0)}
              onClick={() => setForm(f => ({ ...f, restrictions:[] }))}>None</button>
          </div>
        ),
      },
    ];

    const q        = questions[oStep];
    const progress = (oStep / questions.length) * 100;

    return (
      <>
        <Head><title>FoodRx — Your Risk Report</title></Head>
        <div style={{ minHeight:"100vh", background:C.stone50, display:"flex", flexDirection:"column" }}>
          {/* progress */}
          <div style={{ height:4, background:C.stone100 }}>
            <div style={{ height:"100%", background:C.teal400,
              width:`${progress}%`, transition:"width 0.4s ease" }} />
          </div>

          <div style={{ maxWidth:520, margin:"0 auto", padding:"60px 24px", flex:1 }}>
            <div style={{ fontSize:11, fontWeight:600, color:C.stone400,
              letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:28 }}>
              Question {oStep + 1} of {questions.length}
            </div>
            <h2 style={{ fontFamily:serif, fontSize:30, fontWeight:700,
              color:C.stone800, marginBottom:8, lineHeight:1.2 }}>{q.q}</h2>
            <p style={{ fontSize:13, color:C.stone500, marginBottom:32, lineHeight:1.65 }}>{q.hint}</p>

            {q.content}

            {error && <div style={{ marginTop:14, color:C.red600, fontSize:13 }}>{error}</div>}

            <div style={{ display:"flex", gap:10, marginTop:36 }}>
              {oStep > 0 && (
                <button style={btn("secondary")}
                  onClick={() => { setOStep(o => o-1); setError(""); }}>← Back</button>
              )}
              <button style={btn("primary", { flex:1 })} onClick={handleNext}>
                {oStep === questions.length - 1 ? "See my risk profile →" : "Continue →"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════
  // LOADING SCREENS
  // ════════════════════════════════════════════════════════════
  if (step === "loadRisk") return (
    <>
      <Head><title>FoodRx — Loading…</title></Head>
      <Spinner msg="Looking up your community health data…"
        sub="Querying CDC PLACES API + Census Geocoder" />
    </>
  );

  if (step === "loadPlan") return (
    <>
      <Head><title>FoodRx — Building your plan…</title></Head>
      <Spinner msg="Building your personalized meal plan…"
        sub="Claude is analyzing your local risk data" />
    </>
  );

  // ════════════════════════════════════════════════════════════
  // RISK PROFILE PAGE
  // ════════════════════════════════════════════════════════════
  if (step === "risk" && risk) {
    const top    = risk.elevated[0];
    const topVal = top === "diabetes" ? risk.metrics.diabetes
      : top === "hypertension" ? risk.metrics.hypertension
      : top === "obesity"      ? risk.metrics.obesity
      : top === "heart disease"? risk.metrics.heartDisease : null;
    const topNat = top === "diabetes" ? risk.national.diabetes
      : top === "hypertension" ? risk.national.hypertension
      : top === "obesity"      ? risk.national.obesity
      : top === "heart disease"? risk.national.heartDisease : null;
    const pctAbove = topVal && topNat ? Math.round((topVal - topNat) / topNat * 100) : 0;

    const COND_FOODS = {
      diabetes:["lentils","black beans","blueberries","spinach","quinoa","almonds","broccoli","sweet potato","steel-cut oats","walnuts"],
      hypertension:["bananas","leafy greens","beets","garlic","olive oil","pomegranate seeds","wild salmon","avocado","dark chocolate (70%+)","mixed berries"],
      obesity:["broccoli","cucumber","eggs","Greek yogurt","chia seeds","kale","cauliflower","apple","skinless chicken breast","lemon"],
      "heart disease":["wild salmon","extra virgin olive oil","walnuts","ground flaxseed","tomatoes","mixed berries","rolled oats","arugula","almonds","avocado"],
    };
    const priorityFoods = [...new Set(risk.elevated.flatMap(c => COND_FOODS[c] || []))].slice(0, 10);

    return (
      <>
        <Head><title>FoodRx — {risk.city} Risk Report</title></Head>
        <div style={{ minHeight:"100vh", background:C.stone50 }}>
          <div style={{ maxWidth:640, margin:"0 auto", padding:"40px 24px" }}>

            {/* header */}
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.teal400,
                letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
                Your local health risk report
              </div>
              <h1 style={{ fontFamily:serif, fontSize:30, fontWeight:700,
                color:C.stone800, lineHeight:1.2, marginBottom:4 }}>{risk.city}</h1>
              <div style={{ fontSize:13, color:C.stone400, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span>ZIP {risk.zip} · {risk.dataSource}</span>
                {risk.hasRealData
                  ? <span style={{ color:C.teal400, fontWeight:600 }}>✓ Live CDC data</span>
                  : <span style={{ color:"#e67e22", fontWeight:600 }}>⚠ Using national estimates</span>}
              </div>
            </div>

            {/* impact card */}
            {top && (
              <div style={{ background:C.teal800, borderRadius:16, padding:"26px 28px",
                color:"white", position:"relative", overflow:"hidden", marginBottom:20 }}>
                <div style={{ position:"absolute", right:-20, top:-20, width:140, height:140,
                  borderRadius:"50%", background:"rgba(255,255,255,0.05)" }} />
                <div style={{ fontSize:11, fontWeight:600, opacity:0.5,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>
                  Key finding for {risk.city}
                </div>
                <div style={{ fontFamily:serif, fontSize:24, fontWeight:700,
                  lineHeight:1.3, marginBottom:8 }}>
                  {top.charAt(0).toUpperCase() + top.slice(1)} risk is{" "}
                  <span style={{ color:"#7DEDD0" }}>{pctAbove}% above</span> the national average.
                </div>
                <div style={{ fontSize:13, opacity:0.7 }}>
                  Your meal plan targets this directly using ADA & AHA dietary guidelines.
                </div>
              </div>
            )}

            {/* risk bars */}
            <div style={card({ marginBottom:20 })}>
              <div style={{ fontSize:11, fontWeight:600, color:C.stone400,
                textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:16 }}>
                Disease prevalence — your ZIP vs national average
              </div>
              <RiskBar label="Diabetes"               value={risk.metrics.diabetes}     national={risk.national.diabetes} />
              <RiskBar label="High blood pressure"    value={risk.metrics.hypertension} national={risk.national.hypertension} />
              <RiskBar label="Obesity"                value={risk.metrics.obesity}      national={risk.national.obesity} />
              <RiskBar label="Coronary heart disease" value={risk.metrics.heartDisease} national={risk.national.heartDisease} />
            </div>

            {/* elevated callout */}
            {risk.elevated.length > 0 && (
              <div style={card({ background:C.teal50, border:`1px solid ${C.teal100}`, marginBottom:20 })}>
                <div style={{ fontSize:13, fontWeight:600, color:C.teal600, marginBottom:8 }}>
                  Your plan will focus on reducing these elevated risks:
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                  {risk.elevated.map(c => (
                    <span key={c} style={{ background:C.teal400, color:"white",
                      fontSize:12, fontWeight:600, padding:"4px 12px", borderRadius:999 }}>
                      {c}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize:13, color:C.teal800, lineHeight:1.6, margin:0 }}>
                  Foods are selected from ADA (diabetes), AHA (heart & hypertension), and NCI guidelines.
                </p>
              </div>
            )}

            {/* priority foods preview */}
            {priorityFoods.length > 0 && (
              <div style={card({ marginBottom:28 })}>
                <div style={{ fontSize:11, fontWeight:600, color:C.stone400,
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>
                  Foods your plan will emphasize
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {priorityFoods.map(f => (
                    <span key={f} style={{ background:C.stone100, color:C.stone700, fontSize:12,
                      padding:"5px 12px", borderRadius:999, border:`1px solid ${C.stone200}` }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {error && <div style={{ color:C.red600, fontSize:13, marginBottom:12 }}>{error}</div>}

            <button style={btn("primary", { width:"100%", fontSize:16, padding:"16px" })}
              onClick={handleGetPlan}>
              Generate my 7-day meal plan with Claude →
            </button>
            <div style={{ textAlign:"center", marginTop:10, fontSize:12, color:C.stone400 }}>
              Powered by Claude (Anthropic) · Real CDC + USDA data
            </div>
            <div style={{ textAlign:"center", marginTop:16 }}>
              <button onClick={restart} style={{ background:"none", border:"none",
                cursor:"pointer", fontSize:13, color:C.stone400, fontFamily:font }}>
                ← Try a different ZIP code
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════
  // MEAL PLAN PAGE
  // ════════════════════════════════════════════════════════════
  if (step === "plan" && plan) {
    const days    = plan.days    || [];
    const grocery = plan.groceryList || [];
    const total   = grocery.reduce((s, g) => s + (g.est_price || 0), 0);

    return (
      <>
        <Head><title>FoodRx — Your 7-Day Plan</title></Head>
        <div style={{ minHeight:"100vh", background:C.stone50 }}>

          {/* sticky header */}
          <div style={{ position:"sticky", top:0, zIndex:10, background:"white",
            borderBottom:`1px solid ${C.stone100}`, padding:"14px 24px",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontFamily:serif, fontSize:16, fontWeight:700, color:C.stone800 }}>
                🥦 FoodRx — Your Plan
              </div>
              <div style={{ fontSize:12, color:C.stone400 }}>
                {risk?.city} · ${form.budget}/week · CDC PLACES data
              </div>
            </div>
            <button style={btn("secondary", { padding:"8px 14px", fontSize:12 })}
              onClick={() => setStep("risk")}>← Risk profile</button>
          </div>

          <div style={{ maxWidth:660, margin:"0 auto", padding:"28px 24px" }}>

            {/* headline */}
            <div style={card({ background:C.teal800, border:"none", marginBottom:16 })}>
              <div style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.5)",
                textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6 }}>
                Your plan focus
              </div>
              <div style={{ fontFamily:serif, fontSize:19, fontWeight:700,
                color:"white", lineHeight:1.4 }}>
                {plan.headline}
              </div>
            </div>

            {/* key insight */}
            {plan.keyInsight && (
              <div style={card({ background:C.teal50, border:`1px solid ${C.teal100}`, marginBottom:24 })}>
                <span style={{ fontSize:17, marginRight:8 }}>💡</span>
                <span style={{ fontSize:14, color:C.teal800, lineHeight:1.6 }}>{plan.keyInsight}</span>
              </div>
            )}

            {/* tabs */}
            <div style={{ display:"flex", border:`1px solid ${C.stone200}`,
              borderRadius:10, overflow:"hidden", marginBottom:24 }}>
              {["meals","grocery"].map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  style={{ flex:1, padding:"12px", border:"none", cursor:"pointer",
                    fontFamily:font, fontSize:14, fontWeight:600, transition:"all 0.15s",
                    background: activeTab===t ? C.teal400 : "white",
                    color:      activeTab===t ? "white"   : C.stone600 }}>
                  {t === "meals" ? "🗓 7-Day Meals" : "🛒 Grocery List"}
                </button>
              ))}
            </div>

            {/* MEALS TAB */}
            {activeTab === "meals" && (
              <div className="fade-in">
                <div style={{ display:"flex", gap:6, marginBottom:20, overflowX:"auto", paddingBottom:4 }}>
                  {days.map((d, i) => (
                    <button key={i} onClick={() => setActiveDay(i)}
                      style={{ padding:"7px 14px", borderRadius:999, cursor:"pointer",
                        fontFamily:font, fontSize:12, fontWeight:600, whiteSpace:"nowrap",
                        transition:"all 0.12s",
                        border:`1.5px solid ${activeDay===i ? C.teal400 : C.stone200}`,
                        background: activeDay===i ? C.teal50 : "white",
                        color: activeDay===i ? C.teal600 : C.stone500 }}>
                      {(d.day || `Day ${i+1}`).slice(0,3)}
                    </button>
                  ))}
                </div>

                {days[activeDay] && (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {[
                      { emoji:"🌅", label:"Breakfast", data:days[activeDay].breakfast },
                      { emoji:"☀️",  label:"Lunch",     data:days[activeDay].lunch },
                      { emoji:"🌙", label:"Dinner",    data:days[activeDay].dinner },
                    ].map(({ emoji, label, data }) => data && (
                      <div key={label} style={card()}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                          <span style={{ fontSize:18 }}>{emoji}</span>
                          <span style={{ fontSize:11, fontWeight:600,
                            textTransform:"uppercase", letterSpacing:"0.07em", color:C.stone400 }}>
                            {label}
                          </span>
                        </div>
                        <div style={{ fontFamily:serif, fontSize:17, fontWeight:600,
                          color:C.stone800, marginBottom:6 }}>{data.name}</div>
                        {data.why && (
                          <div style={{ fontSize:12, color:C.teal600, background:C.teal50,
                            padding:"5px 10px", borderRadius:6, display:"inline-block" }}>
                            📊 {data.why}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* GROCERY TAB */}
            {activeTab === "grocery" && (
              <div className="fade-in">
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontSize:13, color:C.stone600 }}>{grocery.length} items</div>
                  <div>
                    <span style={{ fontFamily:serif, fontSize:24, fontWeight:700, color:C.teal400 }}>
                      ~${total.toFixed(2)}
                    </span>
                    <span style={{ fontSize:13, color:C.stone400 }}> estimated</span>
                  </div>
                </div>

                <div style={card({ padding:0, overflow:"hidden", marginBottom:20 })}>
                  {grocery.map((g, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12,
                      padding:"14px 20px",
                      borderBottom: i < grocery.length-1 ? `1px solid ${C.stone100}` : "none" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:500, color:C.stone800 }}>{g.item}</div>
                        <div style={{ fontSize:12, color:C.stone400 }}>{g.qty}</div>
                        {g.benefit && (
                          <div style={{ fontSize:11, color:C.teal600, marginTop:3 }}>✓ {g.benefit}</div>
                        )}
                      </div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.stone700,
                        minWidth:48, textAlign:"right" }}>
                        ${(g.est_price || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize:11, color:C.stone400, textAlign:"center", marginBottom:20 }}>
                  Prices based on USDA ERS average cost-per-serving data
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.stone600,
                    textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>
                    Order your groceries
                  </div>
                  <a href="https://www.instacart.com" target="_blank" rel="noopener noreferrer"
                    style={{ ...btn("primary", { textAlign:"center", textDecoration:"none",
                      display:"block", fontSize:15 }) }}>
                    🛒 Order on Instacart →
                  </a>
                  <a href="https://www.kroger.com" target="_blank" rel="noopener noreferrer"
                    style={{ ...btn("secondary", { textAlign:"center", textDecoration:"none",
                      display:"block", fontSize:14 }) }}>
                    Order on Kroger →
                  </a>
                </div>
              </div>
            )}

            {/* attribution */}
            <div style={{ marginTop:36, padding:"16px 20px", background:C.stone100,
              borderRadius:10, fontSize:12, color:C.stone500, lineHeight:1.7 }}>
              <strong style={{ color:C.stone700 }}>Data sources: </strong>
              Disease prevalence from <strong>CDC PLACES 2024</strong> (BRFSS model estimates,
              ZCTA level). County data via <strong>US Census Geocoder</strong>.
              Grocery prices from <strong>USDA ERS</strong>.
              Dietary recommendations follow <strong>ADA, AHA, NCI</strong> evidence guidelines.
              Meal plan generated by <strong>Claude (Anthropic)</strong>.
            </div>

            <div style={{ textAlign:"center", marginTop:24 }}>
              <button onClick={restart} style={{ background:"none", border:"none",
                cursor:"pointer", fontSize:13, color:C.stone400, fontFamily:font }}>
                Start over with a different ZIP →
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}
