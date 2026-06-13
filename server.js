const http = require("http");
const dns = require("dns");
const os = require("os");

// ───────────────────────────────────────────
// ✏️  EDIT YOUR MESSAGE HERE
const YOUR_MESSAGE = "🚫 This site has been blocked by your DNS server.";
// ───────────────────────────────────────────

const PORT = process.env.PORT || 3000;
let MY_IP = null; // will be resolved at startup

// Fetch our own public IP at startup
async function resolveOwnIp() {
  return new Promise((resolve) => {
    // Railway sets RAILWAY_PUBLIC_DOMAIN env var
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    if (railwayDomain) {
      dns.lookup(railwayDomain, (err, address) => {
        if (!err && address) {
          console.log(`Resolved Railway IP from domain: ${address}`);
          resolve(address);
        } else {
          fallback(resolve);
        }
      });
    } else {
      fallback(resolve);
    }
  });
}

function fallback(resolve) {
  // fallback: use ipify to get public IP
  http.get("http://api.ipify.org", (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => {
      const ip = data.trim();
      console.log(`Resolved public IP via ipify: ${ip}`);
      resolve(ip);
    });
  }).on("error", () => {
    console.log("Could not resolve public IP, using 127.0.0.1");
    resolve("127.0.0.1");
  });
}

// Parse IP string into 4 bytes
function ipToBytes(ip) {
  return ip.split(".").map(Number);
}

// Build a DNS A-record response pointing to MY_IP
function buildDnsResponse(query) {
  try {
    const response = Buffer.alloc(query.length);
    query.copy(response);

    response[2] = 0x81; // QR=1, AA=1
    response[3] = 0x80; // RA=1, RCODE=0
    response[6] = 0x00;
    response[7] = 0x01; // answer count = 1

    const ipBytes = ipToBytes(MY_IP || "127.0.0.1");

    const answer = Buffer.from([
      0xc0, 0x0c,             // pointer to question name
      0x00, 0x01,             // type A
      0x00, 0x01,             // class IN
      0x00, 0x00, 0x00, 0x1e, // TTL 30s
      0x00, 0x04,             // rdlength = 4
      ...ipBytes              // the IP address
    ]);

    return Buffer.concat([response, answer]);
  } catch {
    return query;
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
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // ── DoH endpoint ──────────────────────────────────────────
  if (url.pathname === "/dns-query") {
    if (req.method === "GET") {
      const dnsParam = url.searchParams.get("dns");
      if (!dnsParam) { res.writeHead(400); res.end("Missing dns param"); return; }
      const query = Buffer.from(dnsParam, "base64url");
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

  // ── Message page for every other request ──────────────────
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(MESSAGE_PAGE);
});

// Startup: resolve our IP first, then start listening
resolveOwnIp().then((ip) => {
  MY_IP = ip;
  server.listen(PORT, () => {
    console.log(`✅ DNS sinkhole running on port ${PORT}`);
    console.log(`📡 Pointing all DNS to: ${MY_IP}`);
    console.log(`🔗 DoH URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN || "YOUR-RAILWAY-URL"}/dns-query`);
  });
});
