# DNS Sinkhole

Shows a custom message for every website, via DoH (DNS-over-HTTPS).

## ✏️ Change your message

Open `server.js` and edit **line 7**:

```js
const YOUR_MESSAGE = "🚫 This site has been blocked by your DNS server.";
```

Change the text, commit, push — Railway auto-redeploys.

---

## 🚀 Deploy to Railway

1. Push this folder to a GitHub repo
2. Go to https://railway.app → **New Project → Deploy from GitHub repo**
3. Select your repo — Railway auto-detects Node.js and runs `npm start`
4. Go to your project → **Settings → Networking → Generate Domain**
5. Your DoH URL: `https://YOUR-APP.up.railway.app/dns-query`

> Railway automatically sets `RAILWAY_PUBLIC_DOMAIN` so the server
> knows its own IP and uses it in DNS responses. No config needed.

---

## 🌐 Add to your browser

### Chrome / Edge / Brave
1. Go to `chrome://settings/security`
2. Scroll to **Use secure DNS**
3. Pick **With: Custom**
4. Paste: `https://YOUR-APP.up.railway.app/dns-query`

### Firefox
1. Go to `about:preferences#privacy`
2. Scroll to **DNS over HTTPS → Max Protection → Custom**
3. Paste your URL

---

## ⚠️ Heads up

This affects ALL websites in that browser — youtube, google, everything.
To turn it off, go back to DNS settings and switch to Default.
