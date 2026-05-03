const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const emailTool = {
  name: "send_email",
  description: "Send an email to a recipient.",
  input_schema: {
    type: "object",
    properties: {
      to: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
    },
    required: ["to", "subject", "body"],
  },
};

async function executeEmailTool(input) {
  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || "onboarding@resend.dev",
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, message: `Email sent to ${input.to}`, id: result.data?.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { emailTool, executeEmailTool };