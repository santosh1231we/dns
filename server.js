const http = require("http");
const fs = require("fs");
const path = require("path");

// ───────────────────────────────────────────
// ✏️  EDIT YOUR MESSAGE HERE
const YOUR_MESSAGE = "🚫 This site has been blocked by your DNS server.";
// ───────────────────────────────────────────

const PORT = process.env.PORT || 3000;

// Minimal DNS response that points to 0.0.0.0 (blocks the request)
function buildDnsResponse(query) {
  try {
    // Parse the DNS question from the DoH request body
    // Return a valid DNS response with NXDOMAIN or 0.0.0.0
    const response = Buffer.alloc(query.length);
    query.copy(response);

    // Set QR bit (response), keep rest of flags, set RCODE to 0
    response[2] = 0x81; // QR=1, Opcode=0, AA=1
    response[3] = 0x80; // RA=1, RCODE=0

    // Answer count = 1
    response[6] = 0x00;
    response[7] = 0x01;

    // Append answer: pointer to question name + A record pointing to 0.0.0.0
    const answer = Buffer.from([
      0xc0, 0x0c,       // name pointer to question
      0x00, 0x01,       // type A
      0x00, 0x01,       // class IN
      0x00, 0x00, 0x00, 0x1e, // TTL 30s
      0x00, 0x04,       // rdlength 4
      0x00, 0x00, 0x00, 0x00  // 0.0.0.0
    ]);

    return Buffer.concat([response, answer]);
  } catch {
    return query; // fallback: echo query back
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // ── DoH endpoint ──────────────────────────────────────────
  if (url.pathname === "/dns-query") {
    if (req.method === "GET") {
      const dns = url.searchParams.get("dns");
      if (!dns) { res.writeHead(400); res.end("Missing dns param"); return; }
      const query = Buffer.from(dns, "base64url");
      const dnsResp = buildDnsResponse(query);
      res.writeHead(200, { "Content-Type": "application/dns-message" });
      res.end(dnsResp);
    } else if (req.method === "POST") {
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => {
        const query = Buffer.concat(chunks);
        const dnsResp = buildDnsResponse(query);
        res.writeHead(200, { "Content-Type": "application/dns-message" });
        res.end(dnsResp);
      });
    } else {
      res.writeHead(405); res.end();
    }
    return;
  }

  // ── Block page (shown for every other request) ─────────────
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!DOCTYPE html>
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
    .message {
      font-size: 1.25rem;
      font-weight: 500;
      color: #111;
      line-height: 1.6;
    }
    .sub {
      margin-top: 1rem;
      font-size: 0.85rem;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🚫</div>
    <p class="message">${YOUR_MESSAGE}</p>
    <p class="sub">Redirected by your custom DNS server</p>
  </div>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log(`DNS sinkhole running on port ${PORT}`);
  console.log(`DoH URL: https://YOUR-RAILWAY-URL/dns-query`);
});
