// Copies the website's pages into both apps and re-applies the small app-only changes.
// Run after changing the website:  node sync-from-website.mjs
// Then rebuild each app (see README.md).
import fs from "node:fs";

const SITE = new URL("../lugaw-app/public/", import.meta.url);
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
r = must(r, `<a href="index.html">Order food</a>`, `<a href="https://lugawdelights.netlify.app" target="_blank" rel="noopener">Order food</a>`, "rider.html");
write("rider", "index.html", r);

console.log("Customer app page");
let c = read("index.html");
c = must(c, `<a href="rider.html#register">Ride with us</a>`, `<a href="https://lugawdelights.netlify.app/rider.html#register" target="_blank" rel="noopener">Ride with us</a>`, "index.html");
write("customer", "index.html", c);
// Seller and owner apps: print through Android's print screen (Printer plugin) instead of a browser window
for (const app of ["seller", "owner"]) {
  write(app, "common.js", appCommon);
  for (const f of ["config.js", "style.css", "logo.jpg", "icon.png", "contract.js"]) fs.copyFileSync(new URL(f, SITE), new URL(`${app}/www/${f}`, import.meta.url));
}
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
s = must(s, `<a href="owner.html">owner dashboard</a>`, `<a href="https://lugawdelights.netlify.app/owner.html" target="_blank" rel="noopener">owner dashboard</a>`, "seller.html");
write("seller", "index.html", s);

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

console.log("Done. Rebuild the apps to include these changes.");
