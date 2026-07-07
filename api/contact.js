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

// #region debug-point A:report-debug
function reportDebug(hypothesisId, location, msg, data) {
  const payload = {
    sessionId: "geenessy-form-submit",
    runId: "pre-fix",
    hypothesisId,
    location,
    msg: `[DEBUG] ${msg}`,
    data,
    ts: Date.now(),
  };

  fetch("http://127.0.0.1:7777/event", {
    method: "POST",
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

export default async function handler(req, res) {
  if (req.method !== "POST") {
    // #region debug-point B:method-not-allowed
    reportDebug("A", "api/contact.js:37", "Rejected non-POST request", {
      method: req.method,
    });
    // #endregion
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // #region debug-point C:request-entry
    reportDebug("A", "api/contact.js:45", "API request received", {
      hasBody: Boolean(req.body),
      contentType: req.headers["content-type"] || "",
    });
    // #endregion
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
      // #region debug-point D:missing-fields
      reportDebug("B", "api/contact.js:61", "Missing required fields", {
        hasName: Boolean(name),
        hasCompany: Boolean(company),
        hasEmail: Boolean(email),
        hasSector: Boolean(sector),
        hasInterest: Boolean(interest),
        hasMessage: Boolean(message),
      });
      // #endregion
      return res.status(400).json({ error: "Missing required fields", step: "validation" });
    }

    if (!process.env.RESEND_API_KEY) {
      // #region debug-point E:missing-api-key
      reportDebug("C", "api/contact.js:74", "RESEND_API_KEY is missing", {});
      // #endregion
      return res.status(500).json({
        error: "RESEND_API_KEY is missing in the environment.",
        step: "resend-config",
      });
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
      // #region debug-point F:notify-failed
      reportDebug("D", "api/contact.js:118", "Primary Resend notification failed", {
        status: notify.status,
        error,
      });
      // #endregion
      return res.status(500).json({ error, step: "resend-notify" });
    }

    const autoReply = await fetch("https://api.resend.com/emails", {
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

    if (!autoReply.ok) {
      const error = await autoReply.text();
      // #region debug-point G:auto-reply-failed
      reportDebug("E", "api/contact.js:139", "Auto reply failed", {
        status: autoReply.status,
        error,
      });
      // #endregion
      return res.status(500).json({ error, step: "resend-autoreply" });
    }

    // #region debug-point H:request-success
    reportDebug("A", "api/contact.js:149", "API request completed successfully", {
      email,
      sector,
      interest,
    });
    // #endregion

    return res.status(200).json({ ok: true });
  } catch (error) {
    // #region debug-point I:unexpected-error
    reportDebug("E", "api/contact.js:157", "Unexpected handler error", {
      message: error instanceof Error ? error.message : String(error),
    });
    // #endregion
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      step: "unexpected",
    });
  }
}
