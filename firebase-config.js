// Firebase App + Auth (CDN compat loaded in HTML via script tags)
// This file expects firebase-app-compat.js and firebase-auth-compat.js to be loaded before it.

const firebaseConfig = {
  apiKey: "AIzaSyCawOFT6DYMGkTw2tb9rzS7bJVE-3h9LiQ",
  authDomain: "bookmybox-cd3da.firebaseapp.com",
  databaseURL: "https://bookmybox-cd3da-default-rtdb.firebaseio.com",
  projectId: "bookmybox-cd3da",
  storageBucket: "bookmybox-cd3da.firebasestorage.app",
  messagingSenderId: "994021121149",
  appId: "1:994021121149:web:387245915601e520176514",
  measurementId: "G-K74B4MHCFH"
};

// Declare globals safely
var auth = null;
var db = null;

if (typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    if (firebase.firestore) {
      db = firebase.firestore();
    }
  } catch (err) {
    console.warn("Firebase initialization skipped or failed:", err);
  }
}

// ===== GLOBAL REFERRAL CLICK TRACKER =====
(function() {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      // Wait for Firebase Firestore to load
      const checkAndTrack = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.firestore && db) {
          clearInterval(checkAndTrack);
          
          const cleanCode = refCode.trim().toUpperCase();
          
          // Verify referrer exists
          db.collection('users').where('referral_code', '==', cleanCode).limit(1).get()
            .then(snap => {
              if (!snap.empty) {
                const referrerDoc = snap.docs[0];
                const referrerUid = referrerDoc.id;
                
                // Prevent self-referral check if currently logged in
                const user = auth.currentUser;
                if (user && user.uid === referrerUid) {
                  console.log("Self-referral click ignored.");
                  return;
                }
                
                // Check if we already have this referral tracking in localStorage
                const storedRef = localStorage.getItem('bmb_referred_by');
                if (storedRef) {
                  try {
                    const parsed = JSON.parse(storedRef);
                    if (parsed.code === cleanCode && (Date.now() - parsed.clicked_at < 30 * 24 * 60 * 60 * 1000)) {
                      console.log("Active click tracker already exists for this code.");
                      return;
                    }
                  } catch (e) {
                    localStorage.removeItem('bmb_referred_by');
                  }
                }
                
                // Create a 'clicked' status record in referrals collection
                db.collection('referrals').add({
                  referrer_user_id: referrerUid,
                  referred_user_id: null,
                  status: 'clicked',
                  link_clicked_at: firebase.firestore.FieldValue.serverTimestamp()
                }).then(docRef => {
                  localStorage.setItem('bmb_referred_by', JSON.stringify({
                    code: cleanCode,
                    referrer_uid: referrerUid,
                    tracker_id: docRef.id,
                    clicked_at: Date.now()
                  }));
                  console.log("Referral click tracked: ID", docRef.id);
                });
              } else {
                console.warn("Invalid referral code clicked:", cleanCode);
              }
            }).catch(err => console.error("Error tracking referral click:", err));
        }
      }, 500);
      
      // Auto-clear interval after 5 seconds if Firestore isn't loading
      setTimeout(() => clearInterval(checkAndTrack), 5000);
    }
  }
})();

// ===== GLOBAL FOUNDERS WIDGET =====
(function() {
  function addFoundersWidget() {
    if (document.getElementById('bmb-founders-widget')) return;
    
    // Only show on home page
    const path = window.location.pathname.toLowerCase();
    const isHome = path.endsWith('index.html') || path === '/' || path.endsWith('/bmb/');
    if (!isHome) return;

    const widget = document.createElement('div');
    widget.id = 'bmb-founders-widget';
    widget.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(10, 10, 10, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--lime, #c6ff3d);
        border-radius: 12px;
        padding: 12px 18px;
        color: #fff;
        font-size: 11px;
        font-family: 'Manrope', sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 6px;
        pointer-events: none;
        letter-spacing: 0.5px;
      ">
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <span style="color: var(--lime, #c6ff3d); font-weight: 800; font-size: 10px;">FOUNDER</span>
          <span style="font-weight: 600;">S. VARSHITH</span>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <span style="color: var(--lime, #c6ff3d); font-weight: 800; font-size: 10px;">CO-FOUNDER & CEO</span>
          <span style="font-weight: 600;">P. LEO SANDAL</span>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFoundersWidget);
  } else {
    addFoundersWidget();
  }
})();

// ===== GLOBAL RAZORPAY WRAPPER =====
window.processRazorpayPayment = function(amountInRupees, description, onSuccess) {
  if (typeof Razorpay === 'undefined') {
    alert("Razorpay SDK not loaded. Please check your connection.");
    return;
  }

  const user = firebase.auth().currentUser;
  
  const options = {
    "key": "ScU5iIqDR1rCpLbBPH1mtAHt", // Replace with actual Razorpay Key ID
    "amount": Math.round(amountInRupees * 100), // Amount in paise
    "currency": "INR",
    "name": "Book My Box",
    "description": description || "Payment",
    "handler": function (response) {
      console.log("Razorpay Success:", response.razorpay_payment_id);
      if (typeof onSuccess === 'function') {
        onSuccess(response.razorpay_payment_id);
      }
    },
    "prefill": {
      "name": user ? (user.displayName || "Player") : "Player",
      "email": user ? (user.email || "") : "",
    },
    "theme": {
      "color": "#c6ff3d" // BMB Lime
    }
  };
  
  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function (response) {
    console.error("Payment Failed:", response.error);
    alert("Payment failed: " + response.error.description);
  });
  rzp.open();
};
