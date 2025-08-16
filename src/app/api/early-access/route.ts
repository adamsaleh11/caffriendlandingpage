// src/app/api/early-access/route.ts
import { NextRequest } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Force Node runtime so Resend works reliably
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return Response.json({ error: "Missing email" }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: "Caffriend Early Access <onboarding@resend.dev>", // ✅ hard-coded sender
      to: "shilpatel821@gmail.com",                           // ✅ hard-coded recipient
      subject: "New Early Access Signup",
      text: `New signup: ${email}`,                           // ✅ plain text (no @react-email/render needed)
    });

    if (error) {
      console.error("Resend Error:", error);
      return Response.json({ error: "Email failed to send" }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("API Error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
