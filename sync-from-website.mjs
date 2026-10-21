// Copies the website's pages into both apps and re-applies the small app-only changes.
// Run after changing the website:  node sync-from-website.mjs
// Then rebuild each app (see README.md).
import fs from "node:fs";

const SITE = new URL("../lugaw-app/public/", import.meta.url);
// The shop's website (links that leave the app) and the server the apps talk to. Both are the same
// Render service; the apps use the onrender.com name, which works even where new domains are blocked.
const WEB = "https://lugawdelights.com";
const API = "https://lugaw-delights.onrender.com/api/index.php";
const read = f => fs.readFileSync(new URL(f, SITE), "utf8");
const write = (app, f, s) => { fs.writeFileSync(new URL(`${app}/www/${f}`, import.meta.url), s); console.log(`  ${app}/www/${f}`); };
const must = (s, a, b, where) => { if (!s.includes(a)) throw new Error(`${where}: can't find "${a.slice(0, 60)}"`); return s.replace(a, b); };

// In the app there are no extra windows: full-size photos and documents open in a panel
const APP_PANEL = `// In the app there are no extra windows, so full-size photos and documents open in a
// full-screen panel with a Close button.
export function showPanel(html, { asDocument = false } = {}) {
  const p = document.createElement("div");
  p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true");
  p.style.cssText = "position:fixed;inset:0;z-index:100;background:#000;display:grid;grid-template-rows:auto 1fr";
  p.innerHTML = \`<div style="padding:10px;padding-top:max(10px,env(safe-area-inset-top));text-align:right;background:#000">
    <button type="button" class="btn small" data-close>Close</button></div><div data-body style="overflow:auto;display:grid;place-items:center"></div>\`;
  const body = p.querySelector("[data-body]");
  if (asDocument) { const f = document.createElement("iframe"); f.srcdoc = html; f.style.cssText = "border:0;width:100%;height:100%;background:#fff"; body.style.display = "block"; body.append(f); }
  else body.innerHTML = html;
  p.querySelector("[data-close]").onclick = () => p.remove();
  document.body.append(p);
}

// Tapping a proof photo opens it full size
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-proof-full]"); if (!b) return;
  showPanel(\`<img src="\${b.querySelector("img").src}" alt="Proof photo" style="max-width:100%;max-height:100%">\`);
});
`;
const site = read("common.js"), cut = site.indexOf("// Tapping a proof photo opens it full size in a new window");
if (cut < 0) throw new Error("common.js: can't find the proof-photo section");
const appCommon = site.slice(0, cut) + APP_PANEL;

console.log("Shared files");
for (const app of ["rider", "customer"]) {
  write(app, "common.js", appCommon);
  for (const f of ["config.js", "style.css", "logo.jpg", "icon.png"]) fs.copyFileSync(new URL(f, SITE), new URL(`${app}/www/${f}`, import.meta.url));
}
fs.copyFileSync(new URL("contract.js", SITE), new URL("rider/www/contract.js", import.meta.url));

console.log("Rider app page");
let r = read("rider.html");
r = must(r, `import { auth, db, isConfigured, SHOP,`, `import { showPanel, auth, db, isConfigured, SHOP,`, "rider.html");
r = must(r, `  const w=window.open("","_blank"); if(!w) return;
  w.document.open(); w.document.write(agreementHTML(agreement)); w.document.close();`, `  showPanel(agreementHTML(agreement), { asDocument: true });`, "rider.html");
r = must(r, `<a href="index.html">Order food</a>`, `<a href="${WEB}/" target="_blank" rel="noopener">Order food</a>`, "rider.html");
write("rider", "index.html", r);

console.log("Customer app page");
let c = read("index.html");
c = must(c, `<a href="rider.html#register">Ride with us</a>`, `<a href="${WEB}/rider.html#register" target="_blank" rel="noopener">Ride with us</a>`, "index.html");
write("customer", "index.html", c);
// Every app: the client library (fb/) and the server's full address in config.js
const appConfig = must(read("config.js"), `apiBase: ""`, `apiBase: "${API}"`, "config.js");
for (const app of ["rider", "customer", "seller", "owner", "kitchen"]) {
  fs.mkdirSync(new URL(`${app}/www/fb/`, import.meta.url), { recursive: true });
  for (const f of fs.readdirSync(new URL("fb/", SITE))) fs.copyFileSync(new URL(`fb/${f}`, SITE), new URL(`${app}/www/fb/${f}`, import.meta.url));
}

// Seller and owner apps: print through Android's print screen (Printer plugin) instead of a browser window
for (const app of ["seller", "owner"]) {
  write(app, "common.js", appCommon);
  for (const f of ["config.js", "style.css", "logo.jpg", "icon.png", "contract.js"]) fs.copyFileSync(new URL(f, SITE), new URL(`${app}/www/${f}`, import.meta.url));
}
fs.copyFileSync(new URL("loyverse.js", SITE), new URL("owner/www/loyverse.js", import.meta.url)); // Loyverse sales import
fs.copyFileSync(new URL("pastshifts.js", SITE), new URL("owner/www/pastshifts.js", import.meta.url)); // past shifts from the order timeline
fs.copyFileSync(new URL("escpos.js", SITE), new URL("seller/www/escpos.js", import.meta.url)); // Bluetooth receipt printer + cash drawer
const appPrint = (name, html) => `window.Capacitor?.Plugins?.Printer?.printHtml({ name: ${name}, html: ${html} })`;

console.log("Seller app page");
let s = read("seller.html");
s = must(s, `function printReceipt(o){
  const w=window.open("","_blank","width=420,height=640");
  if(!w) return false; // pop-up blocked
  w.document.open(); w.document.write(receiptHTML(o)); w.document.close();
  return true;
}`, `// In the app, receipts go to Android's print screen (any printer, or Save as PDF)
function printReceipt(o){
  const html=receiptHTML(o).replace(/<script>[\\s\\S]*?<\\/script>/g,"");
  const p=${appPrint("`Receipt ${o.code}`", "html")};
  if(!p) return false;
  p.catch(()=>{});
  return true;
}`, "seller.html");
s = must(s, `<a href="owner.html">owner dashboard</a>`, `<a href="${WEB}/owner.html" target="_blank" rel="noopener">owner dashboard</a>`, "seller.html");
write("seller", "index.html", s);

// Kitchen staff use the seller app too: its sign-in page links to the kitchen page,
// and a device that opened the kitchen page goes straight there next time.
console.log("Kitchen page (in the seller app)");
let k = read("kitchen.html");
k = must(k, `<a href="seller.html" id="toCashier">`, `<a href="index.html" id="toCashier">`, "kitchen.html");
k = must(k, `\${other==="owner"?"owner.html":"seller.html"}`, `\${other==="owner"?"${WEB}/owner.html":"index.html"}`, "kitchen.html");
write("seller", "kitchen.html", k);

// The Kitchen app: just the kitchen page. Cashiers and the owner use their own apps.
console.log("Kitchen app page");
write("kitchen", "common.js", appCommon);
for (const f of ["config.js", "style.css", "logo.jpg", "icon.png"]) fs.copyFileSync(new URL(f, SITE), new URL(`kitchen/www/${f}`, import.meta.url));
let ka = read("kitchen.html");
ka = must(ka, `    <p style="font-size:.88rem;margin:0"><a href="seller.html" id="toCashier">Cashier? Sign in on the seller dashboard</a></p>\n`, ``, "kitchen.html");
ka = must(ka, `$("#toCashier").onclick=`, `if($("#toCashier")) $("#toCashier").onclick=`, "kitchen.html");
ka = must(ka, `<a href="\${other==="owner"?"owner.html":"seller.html"}">\${other==="owner"?"owner":"seller"} dashboard</a>`,
  `\${other==="owner"?"Owner":"Seller"} app`, "kitchen.html");
write("kitchen", "index.html", ka);

console.log("Owner app page");
let o = read("owner.html");
o = must(o, `  const w=window.open("","_blank");
  if(!w){ b.textContent="Allow pop-ups to view"; return; }
  w.document.open(); w.document.write(agreementHTML(a)); w.document.close();`,
  `  // In the app the agreement opens in Android's print screen: preview, print or save as PDF
  const p=${appPrint("`Rider agreement - ${a.signedName}`", "agreementHTML(a)")};
  if(!p){ b.textContent="Printing isn't available on this phone"; return; }
  p.catch(()=>{});`, "owner.html");
write("owner", "index.html", o);

console.log("Server address");
for (const app of ["rider", "customer", "seller", "owner", "kitchen"]) write(app, "config.js", appConfig);

console.log("Done. Rebuild the apps to include these changes.");
