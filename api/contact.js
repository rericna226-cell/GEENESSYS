function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatField(value, fallback = "Not provided") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? escapeHtml(trimmed) : fallback;
}

function formatMessage(value) {
  if (typeof value !== "string") return "";
  return escapeHtml(value.trim()).replace(/\n/g, "<br>");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      name,
      company,
      email,
      phone,
      sector,
      interest,
      message,
    } = req.body || {};

    if (!name || !company || !email || !sector || !interest || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const safeName = formatField(name);
    const safeCompany = formatField(company);
    const safeEmail = formatField(email);
    const safePhone = formatField(phone);
    const safeSector = formatField(sector);
    const safeInterest = formatField(interest);
    const safeMessage = formatMessage(message);

    const leadHtml = `
      <h2>New GEENESSYS technical evaluation request</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Company / Institution:</strong> ${safeCompany}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Sector:</strong> ${safeSector}</p>
      <p><strong>Interest:</strong> ${safeInterest}</p>
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
    `;

    const autoReplyHtml = `
      <p>Thank you for contacting GEENESSYS.</p>
      <p>Your request for technical evaluation has been received successfully. Our team will review the information and respond within 24 to 48 business hours when a reply is required.</p>
      <p>Best regards,<br>GEENESSYS Team</p>
      <hr>
      <p>Gracias por contactar a GEENESSYS.</p>
      <p>Tu solicitud de evaluación técnica fue recibida correctamente. Nuestro equipo revisará la información y responderá dentro de 24 a 48 horas hábiles cuando sea necesario.</p>
      <p>Atentamente,<br>Equipo GEENESSYS</p>
    `;

    const notify = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GEENESSYS <info@geenessys.com>",
        to: ["info@geenessys.com", "rericna2.26@gmail.com"],
        reply_to: email,
        subject: `New technical evaluation request from ${name}`,
        html: leadHtml,
      }),
    });

    if (!notify.ok) {
      const error = await notify.text();
      return res.status(500).json({ error });
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GEENESSYS <info@geenessys.com>",
        to: [email],
        subject: "We received your message | Hemos recibido tu mensaje",
        html: autoReplyHtml,
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
