# DNS Sinkhole

Shows a custom message for every website, via a DoH (DNS-over-HTTPS) URL.

## ✏️ Change your message

Open `server.js` and edit line 7:

```js
const YOUR_MESSAGE = "🚫 This site has been blocked by your DNS server.";
```

Change the text inside the quotes to whatever you want. Then redeploy.

---

## 🚀 Deploy to Railway

1. Go to https://railway.app and sign in
2. Click **New Project → Deploy from GitHub repo**
3. Push this folder to a GitHub repo first, then connect it
   - OR use **Railway CLI**: `railway up`
4. Railway will auto-detect Node.js and run `npm start`
5. Go to your project → **Settings → Networking → Generate Domain**
6. Your DoH URL will be: `https://YOUR-APP.railway.app/dns-query`

---

## 🌐 Set it in your browser (Chrome / Edge / Brave)

1. Go to `chrome://settings/security`
2. Scroll to **Use secure DNS**
3. Select **With: Custom**
4. Paste your URL: `https://YOUR-APP.railway.app/dns-query`
5. Done! Every site will now show your message.

### Firefox
1. Go to `about:preferences#privacy`
2. Scroll to **DNS over HTTPS**
3. Select **Max Protection → Custom**
4. Paste your URL

---

## ⚠️ Note

This redirects ALL DNS to 0.0.0.0, so websites will genuinely not load —
the browser will show your block page instead. To undo, set DNS back to
"Default" in your browser settings.
"# dns" 
