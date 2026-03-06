import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { JSONFilePreset } from "lowdb/node";
import crypto from "crypto";
import dot from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure route-level constants read server/.env regardless of process cwd.
dot.config({ path: path.resolve(__dirname, "../.env") });

const db = await JSONFilePreset("db.json", { conversations: {} });
const DAY_MS = 24 * 60 * 60 * 1000;
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash";
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.0-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
const PROVIDER_ORDER = (process.env.AI_PROVIDER_ORDER || "gemini,groq,openrouter")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

function sanitizeForTI(input, maxLen = 250) {
  const safe = (input || "")
    .replace(/[\\{}]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (!safe) {
    return "NO RESPONSE";
  }
  return safe.slice(0, maxLen);
}

function mapAiError(err) {
  const status = err?.status || err?.cause?.status;
  const body = String(err?.message || "");

  if (status === 429 || /quota exceeded|rate limit|too many requests/i.test(body)) {
    return "API QUOTA EXCEEDED. CHECK BILLING OR WAIT 1 MIN.";
  }
  if (status === 401 || status === 403) {
    return "INVALID API KEY OR PERMISSIONS.";
  }
  if (status === 404) {
    return "MODEL NOT AVAILABLE FOR THIS API KEY.";
  }
  return "AI REQUEST FAILED. CHECK SERVER LOGS.";
}

function buildPrompt(question, isMath, history = []) {
  const systemPrompt = isMath
    ? "You are a precise math solver for a TI-84 calculator. Compute the exact answer. Use uppercase plain text only. Never use LaTeX, backslashes, or curly braces. Keep under 250 characters."
    : "You answer for a TI-84 calculator. Keep response under 100 characters, uppercase plain text only. Never use LaTeX, backslashes, or curly braces.";

  const trimmedHistory = history.slice(-10);
  const transcript = trimmedHistory
    .map((m) => `${m.role.toUpperCase()}: ${String(m.content || "")}`)
    .join("\n");

  return `${systemPrompt}\n\n${transcript ? `CONTEXT:\n${transcript}\n\n` : ""}USER: ${question}\nASSISTANT:`;
}

async function generateText(prompt, modelName = TEXT_MODEL) {
  // Try providers in order so a quota failure on one service can fail over.
  const failures = [];

  for (const provider of PROVIDER_ORDER) {
    try {
      if (provider === "gemini") {
        return await generateTextWithGemini(prompt, modelName);
      }
      if (provider === "groq") {
        return await generateTextWithGroq(prompt);
      }
      if (provider === "openrouter") {
        return await generateTextWithOpenRouter(prompt);
      }
    } catch (err) {
      failures.push(`${provider}: ${String(err?.message || err)}`);
      console.error(`[AI FAILOVER] ${provider} failed`, err);
    }
  }

  throw new Error(failures.join(" | ") || "No AI provider configured");
}

async function generateTextWithGemini(prompt, modelName = TEXT_MODEL) {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is missing");
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text() || "";
}

function readOpenAICompatibleText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        return entry?.text || "";
      })
      .join(" ");
  }
  return "";
}

async function generateTextWithGroq(prompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GROQ ${response.status}: ${body}`);
  }

  const payload = await response.json();
  return readOpenAICompatibleText(payload);
}

async function generateTextWithOpenRouter(prompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://github.com",
      "X-Title": "TI84-ESP32-GEMINI",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OPENROUTER ${response.status}: ${body}`);
  }

  const payload = await response.json();
  return readOpenAICompatibleText(payload);
}

async function solveFromImage(question, imageBytes, mimeType = "image/jpeg") {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is missing");
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: VISION_MODEL });

  const result = await model.generateContent([
    {
      text:
        `${question} Answer only with the final result, under 100 chars. ` +
        "If multiple choice, return letter + answer. Use uppercase plain text.",
    },
    {
      inlineData: {
        mimeType,
        data: Buffer.from(imageBytes).toString("base64"),
      },
    },
  ]);

  return result.response.text() || "";
}

export async function chatgpt() {
  const routes = express.Router();

  routes.get("/ask", async (req, res) => {
    const question = req.query.question ?? "";
    if (Array.isArray(question)) {
      res.sendStatus(400);
      return;
    }

    const hasSid = "sid" in req.query;

    try {
      // Stateless mode (derivative, translate, etc.)
      if (!hasSid) {
        const isMath = "math" in req.query;
        const maxLen = isMath ? 250 : 100;
        const prompt = buildPrompt(question, isMath);
        const answer = await generateText(prompt);
        res.send(sanitizeForTI(answer, maxLen));
        return;
      }

      // Chat mode with session
      await db.read();

      // Cleanup old conversations
      const now = Date.now();
      for (const [id, conv] of Object.entries(db.data.conversations)) {
        if (now - conv.created > DAY_MS) delete db.data.conversations[id];
      }

      let sessionId = req.query.sid;
      let history = [];

      if (sessionId && db.data.conversations[sessionId]) {
        history = db.data.conversations[sessionId].messages;
      } else {
        sessionId = crypto.randomBytes(4).toString("hex");
        db.data.conversations[sessionId] = { created: now, messages: [] };
      }

      const prompt = buildPrompt(question, false, history);
      const answer = sanitizeForTI(await generateText(prompt), 100);

      db.data.conversations[sessionId].messages.push(
        { role: "user", content: question },
        { role: "assistant", content: answer }
      );
      await db.write();

      res.send(`${sessionId}|${answer}`);
    } catch (e) {
      console.error(e);
      res.send(sanitizeForTI(mapAiError(e), 100));
    }
  });

  routes.get("/history", async (req, res) => {
    const sid = req.query.sid ?? "";
    const page = parseInt(req.query.p ?? "0");

    if (!sid) {
      res.status(400).send("NO SESSION");
      return;
    }

    await db.read();
    const conv = db.data.conversations[sid];
    if (!conv) {
      res.send("0/0|NO HISTORY");
      return;
    }

    const totalPairs = Math.floor(conv.messages.length / 2);
    if (page < 0 || page >= totalPairs) {
      res.send(`${page}/${totalPairs}|NO MORE`);
      return;
    }

    const q = conv.messages[page * 2].content.substring(0, 80);
    const a = conv.messages[page * 2 + 1].content.substring(0, 150);
    res.send(`${page}/${totalPairs}|Q:${q} A:${a}`);
  });

  // solve a math equation from an image.
  routes.post("/solve", async (req, res) => {
    try {
      const contentType = req.headers["content-type"] || "image/jpeg";
      console.log("content-type:", contentType);

      if (contentType !== "image/jpg" && contentType !== "image/jpeg") {
        res.status(400);
        res.send(`bad content-type: ${contentType}`);
        return;
      }

      if (!req.body || !req.body.length) {
        res.status(400).send("EMPTY IMAGE");
        return;
      }

      const question_number = req.query.n;

      const question = question_number
        ? `What is the answer to question ${question_number}?`
        : "What is the answer to this question?";

      console.log("prompt:", question);

      const answer = await solveFromImage(question, req.body, contentType);
      res.send(sanitizeForTI(answer, 100));
    } catch (e) {
      console.error(e);
      res.send(sanitizeForTI(mapAiError(e), 100));
    }
  });

  return routes;
}
