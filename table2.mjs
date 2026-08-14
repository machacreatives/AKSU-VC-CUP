import { writeFileSync } from "fs";
const t = await (
  await fetch("http://localhost:9260/json/new?about:blank", { method: "PUT" })
).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (m, p = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
};
const ev = async (x) =>
  (await send("Runtime.evaluate", { expression: x, returnByValue: true }))
    .result.value;

const click = (label) =>
  ev(
    `[...document.querySelectorAll("button")].find(b=>b.textContent.trim().toLowerCase()===${JSON.stringify(label.toLowerCase())})?.click()`,
  );
const groups = () =>
  ev(
    `JSON.stringify([...document.querySelectorAll("span")].filter(s=>/^Group [A-D]$/.test(s.textContent.trim())).map(s=>s.textContent.trim()))`,
  );
const campusHeads = () =>
  ev(
    `JSON.stringify([...document.querySelectorAll("h3")].map(h=>h.textContent.trim()))`,
  );

for (const w of [1280, 390]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: w,
    height: 1150,
    deviceScaleFactor: 1,
    mobile: w < 768,
  });
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await new Promise((r) => setTimeout(r, 7000));
  await click("Table");
  await new Promise((r) => setTimeout(r, 900));
  console.log(
    `  @${w} default (All): groups=${await groups()} campuses=${await campusHeads()}`,
  );
  console.log(
    `  @${w} overflow: ${await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`)}px`,
  );
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(
    `${process.argv[2]}/table-all-${w}.png`,
    Buffer.from(shot.data, "base64"),
  );

  await click("Main Campus");
  await new Promise((r) => setTimeout(r, 800));
  console.log(
    `  @${w} Main Campus:  groups=${await groups()} campuses=${await campusHeads()}`,
  );
  await click("Obio Akpa Campus");
  await new Promise((r) => setTimeout(r, 800));
  console.log(`  @${w} Obio Akpa:    groups=${await groups()}`);
  await click("All groups");
  await new Promise((r) => setTimeout(r, 800));
  console.log(`  @${w} back to All:  groups=${await groups()}`);
}
ws.close();
