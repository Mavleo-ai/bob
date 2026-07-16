const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('squad-chat.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost:3000/squad-chat.html" });

// Mock Firebase
dom.window.firebase = {
  firestore: { FieldValue: { serverTimestamp: () => Date.now() } }
};
dom.window.db = null;

dom.window.addEventListener('error', (event) => {
  console.error("DOM ERROR:", event.error);
});

try {
  const scriptContent = fs.readFileSync('squad-chat.js', 'utf8');
  const script = dom.window.document.createElement("script");
  script.textContent = scriptContent;
  dom.window.document.body.appendChild(script);
  console.log("Script executed successfully.");
} catch(e) {
  console.error("Caught error:", e);
}
