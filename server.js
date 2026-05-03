require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { runAgentWithTools } = require("./agents/toolLoop");
const { agents } = require("./agents/index");

const app = express();
app.use(cors());
app.use(express.json());

const INVOICES_DIR = path.join(__dirname, "invoices");
if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR);
app.use("/invoices", express.static(INVOICES_DIR));

app.get("/", (req, res) => {
  res.json({ status: "ok", agents: Object.keys(agents), phase: "3" });
});

app.post("/chat", async (req, res) => {
  const { agent, messages } = req.body;
  if (!agent || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing required fields: agent, messages" });
  }
  if (!agents[agent]) {
    return res.status(400).json({ error: `Unknown agent "${agent}". Valid: aria, rex, mila` });
  }
  try {
    const { reply, toolsUsed } = await runAgentWithTools(agent, messages);
    res.json({ reply, toolsUsed, agent });
  } catch (err) {
    console.error(`[${agent}] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🤖 AI Chatbot Backend running on port ${PORT}`);
  console.log(`   Aria: email tool ✅`);
  console.log(`   Rex:  web search ✅`);
  console.log(`   Mila: PDF invoice generator ✅\n`);
});