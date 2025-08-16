// app/api/early-access/route.ts
import { NextRequest } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // simple email sanity check
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
    if (!ok) {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }

    const from = process.env.RESEND_FROM || "Early Access <onboarding@resend.dev>";
    const to = process.env.RESEND_TO || "you@yourdomain.com";

    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email, // lets you reply directly to the applicant
      subject: "New Early Access signup",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2 style="margin:0 0 8px">New Early Access signup</h2>
          <p style="margin:0 0 4px"><strong>Email:</strong> ${email}</p>
          <hr style="margin:12px 0;border:none;border-top:1px solid #eee" />
          <p style="color:#888;font-size:12px;margin:0">Sent via Caffriend</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Error:", error);
      return Response.json({ error: "Email failed to send" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("API Error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
