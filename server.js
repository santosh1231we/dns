const http = require("http");
const dnsPacket = require("dns-packet");
const dns = require("dns");

// ───────────────────────────────────────────
// ✏️  EDIT YOUR MESSAGE HERE
const YOUR_MESSAGE = "🚫 This site has been blocked by your DNS server.";
// ───────────────────────────────────────────

const PORT = process.env.PORT || 8080;
let MY_IP_BYTES = [127, 0, 0, 1];

// Resolve our own Railway IP at startup
async function resolveOwnIp() {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (!domain) return;
  return new Promise((resolve) => {
    dns.lookup(domain, (err, address) => {
      if (!err && address) {
        MY_IP_BYTES = address.split(".").map(Number);
        console.log(`📡 Own IP: ${address}`);
      }
      resolve();
    });
  });
}

function handleDnsWireFormat(queryBuf) {
  try {
    const decoded = dnsPacket.decode(queryBuf);
    const question = decoded.questions && decoded.questions[0];
    const answers = [];

    if (question) {
      if (question.type === "A") {
        // Point all A record lookups to ourselves
        answers.push({
          type: "A",
          name: question.name,
          ttl: 30,
          data: MY_IP_BYTES.join(".")
        });
      } else if (question.type === "AAAA") {
        // Return NOERROR with no answer for IPv6 — forces browser to use IPv4
        // (don't add any answer, just return empty)
      } else if (question.type === "HTTPS" || question.type === "65") {
        // Returning no HTTPS record disables ECH/HTTPS upgrade in Chrome
        // This is key — it stops Chrome from auto-upgrading to HTTPS
      }
    }

    return dnsPacket.encode({
      type: "response",
      id: decoded.id,
      flags: dnsPacket.AUTHORITATIVE_ANSWER | dnsPacket.RECURSION_DESIRED,
      questions: decoded.questions,
      answers: answers
    });
  } catch (e) {
    console.error("DNS packet error:", e);
    return queryBuf;
  }
}

const RAILWAY_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || "localhost"}`;

// The message page — also has a meta redirect fallback
const MESSAGE_PAGE = (host) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blocked</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 3rem 2.5rem;
      max-width: 480px;
      width: 90%;
      text-align: center;
      border: 1px solid #e5e5e5;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    .message { font-size: 1.25rem; font-weight: 500; color: #111; line-height: 1.6; }
    .sub { margin-top: 1rem; font-size: 0.85rem; color: #999; }
    .domain { margin-top: 0.5rem; font-size: 0.8rem; color: #bbb; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🚫</div>
    <p class="message">${YOUR_MESSAGE}</p>
    <p class="sub">Redirected by your custom DNS server</p>
    ${host ? `<p class="domain">${host}</p>` : ""}
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const host = req.headers.host || "";
  const urlObj = new URL(req.url, `http://${host || "localhost"}`);

  // ── DoH endpoint ─────────────────────────────────────────
  if (urlObj.pathname === "/dns-query") {
    const sendResponse = (dnsResp) => {
      res.writeHead(200, {
        "Content-Type": "application/dns-message",
        "Content-Length": dnsResp.length,
        "Cache-Control": "no-cache"
      });
      res.end(dnsResp);
    };

    if (req.method === "GET") {
      const dnsParam = urlObj.searchParams.get("dns");
      if (!dnsParam) { res.writeHead(400); res.end("Missing dns param"); return; }
      sendResponse(handleDnsWireFormat(Buffer.from(dnsParam, "base64url")));
      return;
    }

    if (req.method === "POST") {
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => sendResponse(handleDnsWireFormat(Buffer.concat(chunks))));
      return;
    }

    res.writeHead(405); res.end();
    return;
  }

  // ── All other HTTP requests → show message page ───────────
  // When a browser hits an HTTP (not HTTPS) site, we show our message.
  // For HTTPS sites, the SSL handshake fails before we can respond —
  // that's a browser security wall we can't bypass without a cert.
  // 
  // WORKAROUND: We redirect HTTP requests to our Railway HTTPS page.
  // For HTTPS, users see a browser SSL error (unavoidable without a cert).
  // The cleanest UX is to tell users to use http:// URLs for testing,
  // or use a browser extension like "HTTPS Everywhere off" for local testing.

  const isRailwayHost = host.includes("railway.app");

  if (isRailwayHost) {
    // Direct hit to our Railway URL — show the message page
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(MESSAGE_PAGE(""));
    return;
  }

  // For intercepted domains (e.g. google.com hitting our IP over HTTP port 80)
  // Redirect them to our Railway message page
  res.writeHead(302, { "Location": RAILWAY_URL });
  res.end();
});

resolveOwnIp().then(() => {
  server.listen(PORT, () => {
    console.log(`✅ DoH Server running on port ${PORT}`);
    console.log(`📡 Pointing DNS to: ${MY_IP_BYTES.join(".")}`);
    console.log(`🔗 DoH URL: ${RAILWAY_URL}/dns-query`);
  });
});
