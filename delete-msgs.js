const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('squad-chat.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost:3000/squad-chat.html" });

dom.window.addEventListener('load', () => {
  setTimeout(() => {
    const db = dom.window.firebase.firestore();
    const squadId = 'XTdIdsboNoLwquOB5Ce2';
    db.collection('squads').doc(squadId).collection('messages').get().then(snap => {
      console.log(`Found ${snap.size} messages. Deleting...`);
      const batch = db.batch();
      snap.forEach(doc => {
        batch.delete(doc.ref);
      });
      return batch.commit();
    }).then(() => {
      console.log("Successfully deleted all messages!");
      process.exit(0);
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  }, 2000); // wait for firebase to init
});
