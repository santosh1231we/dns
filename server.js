const http = require("http");
const dnsPacket = require("dns-packet");

// ───────────────────────────────────────────
// ✏️  EDIT YOUR MESSAGE HERE
const YOUR_MESSAGE = "🚫 This site has been blocked by your DNS server.";
// ───────────────────────────────────────────

const PORT = process.env.PORT || 8080;

// This is a dummy local IP address. Since Railway uses shared routing,
// responding with 127.0.0.1 forces the browser to look for a local page,
// or you can set this to a specific static IP if you host your message page elsewhere.
const REDIRECT_IP = "127.0.0.1"; 

function handleDnsWireFormat(queryBuf) {
  try {
    // Safely decode the binary DNS query from Chrome
    const decoded = dnsPacket.decode(queryBuf);
    
    // Find the domain the browser is looking for
    const question = decoded.questions && decoded.questions[0];
    
    const answers = [];
    if (question && question.type === 'A') {
      answers.push({
        type: 'A',
        name: question.name,
        ttl: 30,
        data: REDIRECT_IP
      });
    }

    // Build a perfectly formatted binary response packet
    return dnsPacket.encode({
      type: 'response',
      id: decoded.id,
      flags: dnsPacket.AUTHORITATIVE_ANSWER,
      questions: decoded.questions,
      answers: answers
    });
  } catch (e) {
    console.error("Failed to process DNS packet:", e);
    return queryBuf; // Fallback to sending back what we got if it fails
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
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // ── DoH endpoint ─────────────────────────────────────────
  if (url.pathname === "/dns-query") {
    
    const sendResponse = (dnsResp) => {
      res.writeHead(200, {
        "Content-Type": "application/dns-message",
        "Content-Length": dnsResp.length,
        "Cache-Control": "no-cache"
      });
      res.end(dnsResp);
    };

    if (req.method === "GET") {
      const dnsParam = url.searchParams.get("dns");
      if (!dnsParam) { 
        res.writeHead(400); 
        res.end("Missing dns param"); 
        return; 
      }
      // Decode base64url parameter from Chrome GET request
      const queryBuf = Buffer.from(dnsParam, "base64url");
      sendResponse(handleDnsWireFormat(queryBuf));
      return;
    } 
    
    if (req.method === "POST") {
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => {
        sendResponse(handleDnsWireFormat(Buffer.concat(chunks)));
      });
      return;
    }

    res.writeHead(405);
    res.end();
    return;
  }

  // ── Message page (For any other paths) ───────────────────
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(MESSAGE_PAGE);
});

server.listen(PORT, () => {
  console.log(`✅ DoH Server successfully running on port ${PORT}`);
});