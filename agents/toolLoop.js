const Anthropic = require("@anthropic-ai/sdk");
const { agents } = require("./index");
const { executeEmailTool } = require("../tools/emailTool");
const { executeInvoiceTool } = require("../tools/invoiceTool");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function runAgentWithTools(agentKey, messages) {
  const agent = agents[agentKey];
  if (!agent) throw new Error(`Unknown agent: ${agentKey}`);

  const toolsParam = agent.tools.length > 0 ? agent.tools : undefined;
  let currentMessages = [...messages];
  let toolsUsed = [];

  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: agent.model,
      max_tokens: 4096,
      system: agent.system,
      tools: toolsParam,
      messages: currentMessages,
    });

    if (response.stop_reason === "end_turn") {
      const textContent = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { reply: textContent, toolsUsed };
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        let result;

        if (toolUse.name === "send_email") {
          result = await executeEmailTool(toolUse.input);
          toolsUsed.push({ tool: "send_email", input: toolUse.input, result });
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
        } else if (toolUse.name === "generate_invoice") {
          result = await executeInvoiceTool(toolUse.input);
          toolsUsed.push({ tool: "generate_invoice", input: toolUse.input, result });
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
        }
        // web_search handled by Anthropic internally
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        ...(toolResults.length > 0 ? [{ role: "user", content: toolResults }] : []),
      ];

      continue;
    }

    const textContent = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { reply: textContent || "I encountered an unexpected state.", toolsUsed };
  }

  return { reply: "I reached the maximum number of tool steps. Please try again.", toolsUsed };
}

module.exports = { runAgentWithTools };