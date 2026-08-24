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

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const modelsToTry = ["gemini-2.5-flash", "gemini-flash", "gemini-1.5-flash", "gemini-3.5-flash", "gemini-3.6-flash"];
        for (const m of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: m,
              contents: prompt,
            });
            if (response && response.text) {
              return res.json({ draft: response.text });
            }
          } catch (e) {
            // try next
          }
        }
      } catch (err) {
        console.warn("Gemini API call failed, using fallback draft:", err);
      }
    }

    const fallbackDraft = `Hello ${requestUsername || "Valued Employee"},\n\nThank you for reaching out to MTKN IT Support. We have received your support request regarding "${title || supportType || "IT Issue"}".\n\nOur team has been notified and is reviewing the details. In the meantime, please try restarting your device or checking your network connection.\n\nBest regards,\nMTKN IT Support Team`;
    return res.json({ draft: fallbackDraft });
  } catch (error: any) {
    console.error("Error generating ticket draft:", error);
    return res.json({ 
      draft: "Hello,\n\nThank you for submitting your ticket. Our IT support team has received your request and is currently reviewing it.\n\nBest regards,\nMTKN IT Support Team" 
    });
  }
});

// API route for system user guide assistant bot
app.post("/api/system-assistant", async (req, res) => {
  try {
    const { messages } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const lastUserMessage = messages && messages.length > 0 ? messages[messages.length - 1].content.toLowerCase() : "";

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

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const formattedContents = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

        const modelsToTry = ["gemini-2.5-flash", "gemini-flash", "gemini-1.5-flash", "gemini-3.5-flash", "gemini-3.6-flash"];
        for (const m of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: m,
              contents: formattedContents,
              config: {
                systemInstruction,
              }
            });
            if (response && response.text) {
              return res.json({ reply: response.text });
            }
          } catch (e) {
            // try next
          }
        }
      } catch (err) {
        console.warn("Gemini API call failed for system assistant, using built-in guide fallback:", err);
      }
    }

    // Intelligent built-in guide fallback
    let fallbackReply = "I am here to help you navigate MTKN ITSM. How can I assist you with the system today?";

    if (lastUserMessage.includes("ticket") || lastUserMessage.includes("create")) {
      fallbackReply = "**How to create and manage support tickets in MTKN ITSM:**\n\n1. Navigate to the **Tickets** module from the left sidebar.\n2. Click the **+ New Ticket** button in the top right.\n3. Fill in the title, detailed description, select the **Support Category** (Hardware, Software, Network, Account, Other), and set the **Priority** (Low, Medium, High, Critical).\n4. You can also use the built-in AI Draft generator to instantly create professional responses for users!\n5. Click Save to log the ticket.";
    } else if (lastUserMessage.includes("repair") || lastUserMessage.includes("hardware") || lastUserMessage.includes("mechanic")) {
      fallbackReply = "**How to track hardware repairs and mechanics:**\n\n1. Go to the **Repairs** tab in the main navigation.\n2. Here you can view all active and completed equipment repairs, device tags, assigned mechanics, and repair cost estimates.\n3. Click **Add Repair** to log a new hardware issue, assign a technician, and track repair status through Pending, In Progress, and Completed workflows.";
    } else if (lastUserMessage.includes("role") || lastUserMessage.includes("permission") || lastUserMessage.includes("user")) {
      fallbackReply = "**How user roles and tab permissions work:**\n\n1. Go to the **Users** management module.\n2. MTKN ITSM supports role-based access control including **Admin**, **Manager**, **Technician**, and **Staff**.\n3. You can click on any user to edit their granular tab permissions (controlling access to Dashboard, Tickets, Repairs, ISP Status, Settings, etc.).";
    } else if (lastUserMessage.includes("isp") || lastUserMessage.includes("downtime") || lastUserMessage.includes("network")) {
      fallbackReply = "**How to monitor ISP status and downtime:**\n\n1. Click on **ISP Management** in the sidebar.\n2. View active connection statuses across all office branches, current bandwidth speeds, uptime percentages, and recent downtime logs.\n3. You can add new ISP links or report connectivity incidents directly from this screen.";
    } else if (lastUserMessage.includes("install") || lastUserMessage.includes("pwa") || lastUserMessage.includes("device")) {
      fallbackReply = "**How to install this app on your device (PWA):**\n\n1. MTKN ITSM supports Progressive Web App (PWA) installation.\n2. In your browser (Chrome/Edge/Safari), click the **Install** icon in the address bar or open your browser menu and select **'Install MTKN ITSM'** or **'Add to Home Screen'**.\n3. This allows you to run the app in a standalone window offline or online!";
    } else if (lastUserMessage.includes("report") || lastUserMessage.includes("metric") || lastUserMessage.includes("dashboard")) {
      fallbackReply = "**Understanding Dashboard Metrics & Reports:**\n\n- **Executive Overview**: Shows live KPI cards for Open Tickets, Active Repairs, Software Expirations, and ISP Health.\n- **Reports Tab**: Provides detailed visual charts (using Recharts) for ticket resolution times, category breakdowns, and monthly trends.";
    }

    return res.json({ reply: fallbackReply });
  } catch (error: any) {
    console.error("Error in system assistant endpoint:", error);
    return res.json({ 
      reply: "I am your MTKN ITSM Executive Assistant. You can ask me how to manage tickets, track hardware repairs, check user permissions, or monitor ISP network status!" 
    });
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
