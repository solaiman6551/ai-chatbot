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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullReply = '';

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt || 'You are a helpful assistant.',
    messages: conversations[sessionId],
  });

  stream.on('text', (text) => {
    fullReply += text;
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
    res.flush && res.flush();
  });

  stream.on('finalMessage', () => {
    conversations[sessionId].push({ role: 'assistant', content: fullReply });
    res.write(`data: [DONE]\n\n`);
    res.end();
  });

  stream.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));