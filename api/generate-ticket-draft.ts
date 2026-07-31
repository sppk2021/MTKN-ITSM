import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, description, supportType, priority, requestUsername, requestDept } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in environment variables.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert IT Support Desk AI assistant for MTKN ITSM.
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
5. Do not include placeholder brackets, sign off simply as "MTKN IT Support Team".`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const draftText = response.text || "Thank you for submitting your ticket. Our IT team is reviewing your request.";
    return res.status(200).json({ draft: draftText });
  } catch (error: any) {
    console.error("Vercel API error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate draft response" });
  }
}
