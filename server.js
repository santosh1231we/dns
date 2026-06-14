const http = require("http");
const dns = require("dns");

// ───────────────────────────────────────────
// ✏️  EDIT YOUR MESSAGE HERE
const YOUR_MESSAGE = "🚫 This site has been blocked by your DNS server.";
// ───────────────────────────────────────────

const PORT = process.env.PORT || 8080;
let MY_IP_BYTES = [0, 0, 0, 0];

async function resolveOwnIp() {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  console.log("Railway domain:", railwayDomain);

  if (railwayDomain) {
    return new Promise((resolve) => {
      dns.lookup(railwayDomain, (err, address) => {
        if (!err && address) {
          console.log("Own IP resolved:", address);
          MY_IP_BYTES = address.split(".").map(Number);
          resolve();
        } else {
          console.log("DNS lookup failed:", err?.message);
          resolve();
        }
      });
    });
  }
}

// Properly parse DNS wire format and build a valid A record response
function buildDnsResponse(queryBuf) {
  try {
    // Transaction ID (2 bytes)
    const txId = queryBuf.slice(0, 2);

    // Flags: QR=1 response, AA=1 authoritative, RD copy from query, RA=1
    const rdBit = (queryBuf[2] & 0x01) ? 0x01 : 0x00;
    const flags = Buffer.from([0x81 | rdBit, 0x80]);

    // QDCOUNT from query
    const qdCount = queryBuf.slice(4, 6);
    // ANCOUNT = 1
    const anCount = Buffer.from([0x00, 0x01]);
    // NSCOUNT, ARCOUNT = 0
    const zeros = Buffer.from([0x00, 0x00, 0x00, 0x00]);

    // Copy the question section exactly
    const question = queryBuf.slice(12);

    // Answer: name pointer + type A + class IN + TTL + rdlength + IP
    const answer = Buffer.from([
      0xc0, 0x0c,                          // name pointer to offset 12
      0x00, 0x01,                          // type A
      0x00, 0x01,                          // class IN
      0x00, 0x00, 0x00, 0x1e,             // TTL = 30
      0x00, 0x04,                          // rdlength = 4
      ...MY_IP_BYTES                        // IPv4 address
    ]);

    return Buffer.concat([txId, flags, qdCount, anCount, zeros, question, answer]);
  } catch (e) {
    console.error("DNS build error:", e);
    return queryBuf;
  }
}

const MESSAGE_PAGE = `<!DOCTYPE html>
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
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🚫</div>
    <p class="message">${YOUR_MESSAGE}</p>
    <p class="sub">Redirected by your custom DNS server</p>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // ── DoH endpoint ─────────────────────────────────────────
  if (url.pathname === "/dns-query") {
    const handleQuery = (queryBuf) => {
      const dnsResp = buildDnsResponse(queryBuf);
      res.writeHead(200, {
        "Content-Type": "application/dns-message",
        "Content-Length": dnsResp.length,
        "Cache-Control": "no-cache"
      });
      res.end(dnsResp);
    };

    if (req.method === "GET") {
      const dnsParam = url.searchParams.get("dns");
      if (!dnsParam) { res.writeHead(400); res.end("Missing dns param"); return; }
      handleQuery(Buffer.from(dnsParam, "base64url"));
    } else if (req.method === "POST") {
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => handleQuery(Buffer.concat(chunks)));
    } else {
      res.writeHead(405); res.end();
    }
    return;
  }

  // ── Message page ─────────────────────────────────────────
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(MESSAGE_PAGE);
});

resolveOwnIp().then(() => {
  server.listen(PORT, () => {
    console.log(`✅ Running on port ${PORT}`);
    console.log(`📡 DNS resolves to: ${MY_IP_BYTES.join(".")}`);
    console.log(`🔗 DoH URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN || "localhost"}/dns-query`);
  });
});
