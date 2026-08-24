import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// API route for generating preliminary ticket draft response using Gemini API
app.post("/api/generate-ticket-draft", async (req, res) => {
  try {
    const { title, description, supportType, priority, requestUsername, requestDept } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in environment variables.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `You are an expert IT Support Desk AI assistant for MTKN IT Management.
Generate a professional, helpful, empathetic preliminary response draft to acknowledge a newly submitted IT support ticket and provide initial diagnostic/troubleshooting steps for support staff to review and send to the user.

Ticket Information:
- Title/Issue: ${title || "N/A"}
- Description: ${description || "N/A"}
- Support Category: ${supportType || "General"}
- Priority: ${priority || "Normal"}
- User: ${requestUsername || "Valued Employee"}
- Department: ${requestDept || "General"}

Instructions:
1. Address the user politely.
2. Acknowledge receipt of the ticket and state that IT support has been notified.
3. Provide 2-3 relevant, practical initial self-service or troubleshooting recommendations based on the issue description.
4. Keep the draft concise, well-structured, clear, and professional (under 180 words).
5. Do not include placeholder brackets like [Your Name], sign off simply as "MTKN IT Support Team".`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const draftText = response.text || "Thank you for submitting your ticket. Our IT team is reviewing your request.";

    return res.json({ draft: draftText });
  } catch (error: any) {
    console.error("Error generating ticket draft with Gemini:", error);
    return res.status(500).json({ error: error.message || "Failed to generate draft response" });
  }
});

// API route for system user guide assistant bot using gemini-3.5-flash
app.post("/api/system-assistant", async (req, res) => {
  try {
    const { messages } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in environment variables.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `You are MTKN ITSM System Assistant & User Guide Bot, an expert AI companion dedicated to helping users navigate, understand, and utilize the MTKN IT Service Management (ITSM) platform.

Platform Modules & Features:
1. Dashboard: Real-time IT infrastructure overview, metric cards (Open Tickets, Active Repairs, Software Expirations, ISP Status), and analytical charts.
2. Users: User directory, role-based access control (Admin, Manager, Technician, Staff), and granular tab permissions.
3. Reports: Comprehensive analytics, exportable logs, and visualization charts for ticket trends and resolution times.
4. Calendar: Maintenance schedule, support events, and calendar filtering by status/type.
5. Repairs: Hardware repair tracking with device names, repair codes, mechanic assignment, and status workflows (pending, ongoing, completed).
6. Tickets: IT support ticket creation & management, priority levels (Low, Medium, High, Critical), support categories (Hardware, Software, Network, Account, Other), and AI draft response generator.
7. Software Licenses: License tracking for domains, servers, Microsoft licenses, and expiration alerts.
8. ISP Management: ISP connection monitoring across branch offices, speeds, and downtime records.
9. Settings & Customization: App logo upload, PWA installation instructions, and dark/light mode toggle.

Instructions for you:
- Answer questions clearly, accurately, and politely regarding how to use any feature or module in MTKN ITSM.
- Guide users step-by-step on where to click, how to create items, how permissions work, and how to resolve common tasks.
- Keep responses helpful, well-formatted (using bullet points or bold text where appropriate), and concise.`;

    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction,
      }
    });

    const reply = response.text || "I am here to help you navigate MTKN ITSM. How can I assist you with the system today?";

    return res.json({ reply });
  } catch (error: any) {
    console.error("Error with system assistant AI:", error);
    return res.status(500).json({ error: error.message || "Failed to process assistant request" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
