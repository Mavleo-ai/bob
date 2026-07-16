const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('signin.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost:3000/signin.html" });

dom.window.addEventListener('error', (event) => {
  console.error("DOM ERROR:", event.error);
});

try {
  const scriptContent = fs.readFileSync('auth.js', 'utf8');
  const script = dom.window.document.createElement("script");
  script.textContent = scriptContent;
  dom.window.document.body.appendChild(script);
  console.log("Script executed successfully.");
} catch(e) {
  console.error("Caught error:", e);
}
