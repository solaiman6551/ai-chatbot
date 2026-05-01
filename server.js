require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic();
const resend = new Resend(process.env.RESEND_API_KEY);
const conversations = {};

// Email tool definition
const tools = [
  {
    name: 'send_email',
    description: 'Send a support confirmation email to the customer. Use this when the customer provides their email address and has a support issue.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Customer email address'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content'
        }
      },
      required: ['to', 'subject', 'body']
    }
  }
];

// Execute the tool
async function executeTool(name, input) {
  if (name === 'send_email') {
    const { data, error } = await resend.emails.send({
      from: 'NexaSupport <onboarding@resend.dev>',
      to: input.to,
      subject: input.subject,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6c8cff">NexaSupport</h2>
        <p>${input.body.replace(/\n/g, '<br/>')}</p>
        <hr/>
        <p style="color:#6b7280;font-size:12px">NexaSupport Customer Service</p>
      </div>`
    });

    if (error) return `Failed to send email: ${error.message}`;
    return `Email successfully sent to ${input.to}`;
  }
}

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

  try {
    // Agent loop
    while (true) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt || 'You are a helpful assistant.',
        tools: tools,
        messages: conversations[sessionId],
      });

      // If Claude wants to use a tool
      if (response.stop_reason === 'tool_use') {
        const toolUse = response.content.find(b => b.type === 'tool_use');

        // Tell frontend agent is acting
        res.write(`data: ${JSON.stringify({ text: `\n⚡ Using tool: ${toolUse.name}...\n` })}\n\n`);

        // Execute the tool
        const toolResult = await executeTool(toolUse.name, toolUse.input);

        // Add to conversation
        conversations[sessionId].push({ role: 'assistant', content: response.content });
        conversations[sessionId].push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: toolResult
          }]
        });

        // Continue the loop — Claude will now respond with final answer
        continue;
      }

      // Claude is done — stream the final text response
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock) {
        fullReply = textBlock.text;
        // Stream word by word for effect
        const words = fullReply.split(' ');
        for (const word of words) {
          res.write(`data: ${JSON.stringify({ text: word + ' ' })}\n\n`);
          await new Promise(r => setTimeout(r, 20));
        }
      }

      conversations[sessionId].push({ role: 'assistant', content: fullReply });
      break;
    }

  } catch (err) {
    res.write(`data: ${JSON.stringify({ text: 'Something went wrong.' })}\n\n`);
  }

  res.write(`data: [DONE]\n\n`);
  res.end();
});

app.listen(3000, () => console.log('Server running on port 3000'));