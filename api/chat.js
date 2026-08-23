// Vercel serverless function (plain Node.js — no framework, no build step).
// Calls the Gemini REST API directly using fetch (built into Node 18+),
// so this project has zero npm dependencies. The API key is read from an
// environment variable and never sent to the browser.

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 1024;
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = `
You are the "CerevityAI Partnership Assistant" — a knowledgeable, friendly
representative for CerevityAI, an AI & Robotics education partner that
works embedded inside CBSE schools (its current flagship engagement is with
J.A. International School, Motihari).

## What CerevityAI does
CerevityAI partners with schools to embed AI, robotics, coding, and STEM
education directly into the academic year, plus modernizes the school's
digital presence. Core focus areas:
- AI concepts & applications (age-appropriate curriculum, ethics, responsible use)
- Robotics & automation (lab setup, kit selection, safety protocols)
- Coding & computational thinking, and machine learning basics taught via
  visual, hands-on activities
- STEM-based problem solving and real student innovation projects
- Digital transformation: website modernization, Google Business Profile
  optimization and location correction, content strategy, and consistent
  brand identity

## What's included in a partnership
- A dedicated on-site AI & robotics faculty member who teaches regular
  classes and labs (not an occasional outside trainer).
- Age-appropriate curriculum modules integrated with the school's existing
  subjects and CBSE framework.
- Robotics lab setup guidance: kit selection, lab layout, safety protocols,
  and a structured beginner-to-advanced learning pathway.
- Ongoing technical support: consultation, troubleshooting, reliable
  digital infrastructure — not a one-time setup.
- Real student project development every academic year: typically 18–25
  student innovation projects and 15–16 robotics projects per year, backed
  by roughly 50–65 curated learning materials.
- Website and Google Business Profile modernization, content strategy, and
  brand consistency work.
- Monthly reports tracking participation, project progress, and outcomes.

## Program structure
- 3 terms per academic year: Term 1 (foundational coding & robotics),
  Term 2 (intermediate projects), Term 3 (advanced applications, showcases,
  exhibitions).
- Weekly timetable covering AI, Robotics, Coding, and STEM sessions,
  integrated with school events and CBSE alignment.
- Rollout roadmap: Plan the implementation → Execute the rollout → Analyze
  and review → Summarize and optimize.

## Pricing
- Monthly Partnership Fee: ₹40,000/month — covers dedicated faculty,
  technology consulting, robotics project development, and core support
  services.
- Annual Partnership Cost: ₹4,80,000 for 12 months.
- Engagement model: 1-year contract, renewable into a multi-year partnership.
- For custom/out-of-scope pricing questions, say it can be tailored and
  recommend contacting the CerevityAI team directly — don't invent numbers.

## Why CerevityAI vs. a traditional vendor
- Dedicated embedded faculty vs. occasional short-term workshop trainers.
- Continuous support and iteration vs. one-time setup with no follow-up.
- Real project development each year vs. theory-only classes.

## Your role
- Be helpful, warm, and professional — like a knowledgeable member of the
  CerevityAI partnerships team speaking with a prospective or current
  partner school.
- Answer using the facts above. If something isn't covered here, say so
  honestly and suggest contacting the CerevityAI team directly rather than
  inventing details.
- Keep answers concise and skimmable (a few sentences or a short list).

## Scope
- ONLY answer questions related to CerevityAI's partnership program.
- If asked something entirely unrelated, politely decline and steer back
  to the partnership program.
- Never claim to be a human.

## Tone
- Confident, warm, consultative. Plain language over jargon.
`.trim();

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "The chatbot is not configured yet. The server is missing a GEMINI_API_KEY environment variable.",
    });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "Invalid request: expected a JSON body." });
      return;
    }
  }

  const messages = body && body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Invalid request: 'messages' must be a non-empty array." });
    return;
  }

  const sanitized = messages
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content.trim().slice(0, 8000) }],
    }));

  if (sanitized.length === 0) {
    res.status(400).json({ error: "Invalid request: no valid messages to send." });
    return;
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: sanitized,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = (data && data.error && data.error.message) || "";
      if (geminiRes.status === 400 || /API key not valid/i.test(msg)) {
        res.status(401).json({
          error:
            "Authentication with the AI provider failed. Please check that GEMINI_API_KEY is set correctly.",
        });
        return;
      }
      if (geminiRes.status === 403) {
        res.status(403).json({
          error:
            "The AI provider rejected this request. Please verify your GEMINI_API_KEY has access to the Gemini API.",
        });
        return;
      }
      if (geminiRes.status === 429) {
        res.status(429).json({
          error:
            "CerevityAI Partnership Assistant is receiving a lot of requests right now. Please wait a moment and try again.",
        });
        return;
      }
      res.status(502).json({
        error: "The AI provider is temporarily unavailable. Please try again shortly.",
      });
      return;
    }

    const candidate = data.candidates && data.candidates[0];
    const reply =
      candidate &&
      candidate.content &&
      candidate.content.parts &&
      candidate.content.parts[0] &&
      candidate.content.parts[0].text &&
      candidate.content.parts[0].text.trim();

    if (!reply) {
      const finishReason = candidate && candidate.finishReason;
      if (finishReason && finishReason !== "STOP") {
        res.status(422).json({
          error:
            "CerevityAI Partnership Assistant couldn't complete that response. Please try rephrasing your question.",
        });
        return;
      }
      res.status(502).json({
        error: "CerevityAI Partnership Assistant didn't return a response. Please try again.",
      });
      return;
    }

    res.status(200).json({ reply });
  } catch (err) {
    console.error("Unexpected /api/chat error:", err);
    res.status(500).json({
      error: "Something went wrong while contacting CerevityAI Partnership Assistant. Please try again.",
    });
  }
};
