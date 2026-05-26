/**
 * /api/plan  (POST)
 *
 * Server-side route that calls Anthropic Claude to generate
 * a personalized 7-day meal plan. The ANTHROPIC_API_KEY
 * lives only in the server environment — never sent to the browser.
 */

import Anthropic from "@anthropic-ai/sdk";

// Food-condition evidence table (ADA / AHA / NCI guidelines)
const CONDITION_FOODS = {
  diabetes:       ["lentils","black beans","blueberries","spinach","quinoa","almonds","broccoli","sweet potato","steel-cut oats","walnuts"],
  hypertension:   ["bananas","leafy greens","beets","garlic","olive oil","pomegranate seeds","wild salmon","avocado","dark chocolate (70%+)","mixed berries"],
  obesity:        ["broccoli","cucumber","eggs","Greek yogurt","chia seeds","kale","cauliflower","apple","skinless chicken breast","lemon"],
  "heart disease":["wild salmon","extra virgin olive oil","walnuts","ground flaxseed","tomatoes","mixed berries","rolled oats","arugula","almonds","avocado"],
};

// USDA ERS average cost-per-serving (2023 data)
const FOOD_PRICES = {
  lentils:0.35,"black beans":0.40,blueberries:1.10,spinach:0.65,
  quinoa:0.85,almonds:0.90,broccoli:0.75,"sweet potato":0.60,
  "steel-cut oats":0.30,walnuts:1.00,bananas:0.20,"leafy greens":0.70,
  beets:0.55,garlic:0.10,"olive oil":0.40,"pomegranate seeds":1.20,
  "wild salmon":2.50,avocado:1.00,"dark chocolate (70%+)":0.70,"mixed berries":1.00,
  cucumber:0.45,eggs:0.25,"Greek yogurt":0.80,"chia seeds":0.50,kale:0.65,
  cauliflower:0.85,apple:0.50,"skinless chicken breast":1.80,lemon:0.30,
  "extra virgin olive oil":0.45,"ground flaxseed":0.35,tomatoes:0.75,
  "rolled oats":0.25,arugula:0.70,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { form, risk } = req.body;

  if (!form || !risk) {
    return res.status(400).json({ error: "Missing form or risk data" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const foods = [
    ...new Set(risk.elevated.flatMap(c => CONDITION_FOODS[c] || [])),
    ...(risk.elevated.length === 0 ? CONDITION_FOODS["heart disease"] : []),
  ].slice(0, 16);

  const priceContext = foods
    .map(f => `${f} (~$${FOOD_PRICES[f] || 0.60}/serving)`)
    .join(", ");

  const prompt = `You are a registered dietitian building a personalized 7-day meal plan.

REAL LOCAL HEALTH DATA (source: ${risk.dataSource || "CDC PLACES 2024"} for ZIP ${risk.zip}):
- Diabetes prevalence: ${risk.metrics.diabetes}% (national avg: ${risk.national.diabetes}%)
- Hypertension prevalence: ${risk.metrics.hypertension}% (national avg: ${risk.national.hypertension}%)
- Obesity prevalence: ${risk.metrics.obesity}% (national avg: ${risk.national.obesity}%)
- Coronary heart disease: ${risk.metrics.heartDisease}% (national avg: ${risk.national.heartDisease}%)
- Elevated risk flags: ${risk.elevated.length ? risk.elevated.join(", ") : "none above 15% threshold"}
- Location: ${risk.city}

USER PROFILE:
- Age range: ${form.age}
- Weekly grocery budget: $${form.budget}
- Diagnosed conditions: ${form.conditions?.length ? form.conditions.join(", ") : "none disclosed"}
- Dietary restrictions: ${form.restrictions?.length ? form.restrictions.join(", ") : "none"}

EVIDENCE-BASED PRIORITY INGREDIENTS (ADA/AHA/NCI guidelines) with USDA price estimates:
${priceContext}

Respond ONLY with valid JSON — no markdown, no backticks, no commentary before or after:
{
  "headline": "one sentence summarizing the plan's primary health focus",
  "keyInsight": "1-2 sentence insight quoting the actual local risk percentages and why this plan targets them",
  "days": [
    {
      "day": "Monday",
      "breakfast": { "name": "meal name", "why": "specific clinical evidence note" },
      "lunch":     { "name": "meal name", "why": "..." },
      "dinner":    { "name": "meal name", "why": "..." }
    }
  ],
  "groceryList": [
    { "item": "name", "qty": "e.g. 1 lb", "est_price": 2.50, "benefit": "one-line clinical benefit" }
  ],
  "weeklyTotal": 0.00
}
Generate all 7 days (Monday–Sunday) and 12–15 grocery items. Keep total ≤ $${form.budget}.${form.restrictions?.length ? ` Strictly respect: ${form.restrictions.join(", ")}.` : ""}`;

  try {
    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content.map(b => b.text || "").join("");

    // Strip any markdown fences Claude might add despite instructions
    const clean = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    // Extract JSON even if there's stray text before/after
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response:", raw);
      throw new Error("Claude returned an unexpected response format");
    }

    const plan = JSON.parse(jsonMatch[0]);

    // Validate the structure we need before sending to client
    if (!plan.days || !Array.isArray(plan.days) || plan.days.length === 0) {
      throw new Error("Meal plan missing days array");
    }
    if (!plan.groceryList || !Array.isArray(plan.groceryList)) {
      plan.groceryList = [];
    }

    return res.status(200).json(plan);

  } catch (err) {
    console.error("Plan generation error:", err);
    return res.status(500).json({ error: "Failed to generate meal plan", detail: err.message });
  }
}