require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic();

const conversations = {};

app.post('/chat', async (req, res) => {
  const { message, systemPrompt, sessionId } = req.body;

  if (!conversations[sessionId]) {
    conversations[sessionId] = [];
  }

  conversations[sessionId].push({ role: 'user', content: message });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt || 'You are a helpful assistant.',
    messages: conversations[sessionId],
  });

  const reply = response.content[0].text;
  conversations[sessionId].push({ role: 'assistant', content: reply });

  res.json({ reply });
});

app.listen(3000, () => console.log('Server running on port 3000'));