import assert from "node:assert/strict";

const target = await (await fetch("http://localhost:9333/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const task = pending.get(message.id);
    if (task) { pending.delete(message.id); message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result); }
  }
  if (message.method === "Runtime.consoleAPICalled") {
    const text = message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
    if (/hydrat|didn't match|server rendered HTML/i.test(text)) errors.push(text);
  }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    if (await evaluate("Boolean(" + expression + ")")) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out: " + expression);
}
try {
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__revealCalls=0;const originalAnimate=Element.prototype.animate;Element.prototype.animate=function(...args){window.__revealCalls++;return originalAnimate.apply(this,args)};" });
  await send("Page.navigate", { url: "http://localhost:3000/about" });
  await waitFor('document.readyState === "complete" && document.querySelector(".prose p")');
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await evaluate('window.scrollTo(0, document.querySelector(".prose").offsetTop)');
  await waitFor("window.__revealCalls > 0");
  assert.equal(await evaluate('document.querySelectorAll(".prose > [data-reveal]").length'), 0);
  const revealCalls = await evaluate("window.__revealCalls");
  await evaluate('document.querySelector(\'a[href="/experience"]\').click()');
  await waitFor('location.pathname === "/experience" && document.querySelector("h1")?.textContent.includes("Where I have worked")');
  await evaluate('document.querySelector(\'a[href="/about"]\').click()');
  await waitFor('location.pathname === "/about" && document.querySelector(".prose p")');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  assert.equal(await evaluate('document.querySelectorAll(".prose > [data-reveal]").length'), 0);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url: "http://localhost:3000/about" });
  await waitFor('document.readyState === "complete" && document.querySelector(".prose p")');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  assert.equal(await evaluate("window.__revealCalls"), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ hydrationErrors: errors.length, revealCalls, clientNavigation: true, reducedMotion: true, reactOwnedAttributesUnchanged: true }));
} finally {
  socket.close();
  await fetch("http://localhost:9333/json/close/" + target.id);
}
