// ===== MOBILE NAV TOGGLE =====
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    menuToggle.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuToggle.textContent = '☰';
  }));
}

// ===== TICKER =====
const tickerItems = [
  "🏏 STRIKERS BOX ARENA · SLOTS OPEN TONIGHT 7PM",
  "🔥 MEMBERSHIP: 15 VISITS FOR ₹200 — SAVE ₹750/MONTH",
  "⚡ MORNING SLOTS BEFORE 9AM — 30% OFF TODAY",
  "🏆 SQUAD OF 6+? FREE DIGITAL SCOREBOARD ON US",
  "💬 GROUP CHAT + VENUE DIRECT LINE — NOW LIVE"
];
const track = document.getElementById('tickerTrack');
if (track) {
  const content = tickerItems.map(t => `<span>${t}</span>`).join('');
  track.innerHTML = content + content;
}

// ===== TOAST NOTIFICATION =====
function showToast(message, type = 'info') {
  const existing = document.getElementById('bmbToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'bmbToast';
  toast.textContent = message;
  const colors = {
    success: 'linear-gradient(135deg, #C6FF3D, #8FCC1F)',
    error:   'linear-gradient(135deg, #FF3B30, #cc2a1f)',
    info:    'linear-gradient(135deg, #3DE8FF, #1bbde0)'
  };
  toast.style.cssText = `
    position: fixed; bottom: 28px; left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: ${colors[type] || colors.info};
    color: #0B1210; font-family: 'Manrope', sans-serif;
    font-weight: 800; font-size: 14px;
    padding: 14px 24px; border-radius: 100px; z-index: 9999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    transition: transform 0.4s cubic-bezier(0.16,1,0.3,1);
    white-space: nowrap; max-width: calc(100vw - 48px); text-align: center;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ===== MEMBERSHIP CHECKOUT MODAL =====
const getMembershipBtn   = document.getElementById('getMembershipBtn');
const checkoutModal      = document.getElementById('checkoutModal');
const closeCheckoutBtn   = document.getElementById('closeCheckoutBtn');
const confirmCheckoutBtn = document.getElementById('confirmCheckoutBtn');

if (getMembershipBtn && checkoutModal) {
  getMembershipBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (typeof auth !== 'undefined' && !auth.currentUser) {
      window.location.href = 'signin.html';
      return;
    }
    checkoutModal.style.display = 'flex';
  });

  closeCheckoutBtn && closeCheckoutBtn.addEventListener('click', () => {
    checkoutModal.style.display = 'none';
  });

  confirmCheckoutBtn && confirmCheckoutBtn.addEventListener('click', function () {
    if (typeof auth !== 'undefined' && auth.currentUser &&
        typeof firebase !== 'undefined' && firebase.firestore) {
      const db = firebase.firestore();
      const ogText = confirmCheckoutBtn.textContent;
      confirmCheckoutBtn.textContent = 'Processing...';
      confirmCheckoutBtn.disabled = true;

      const processMembership = () => {
        const confirmReferral = (uid) => {
          return db.collection('referrals')
            .where('referred_user_id', '==', uid)
            .where('status', '==', 'signed_up')
            .limit(1)
            .get()
            .then(refSnap => {
              if (refSnap.empty) return Promise.resolve();
              
              const refDoc = refSnap.docs[0];
              const referrerId = refDoc.data().referrer_user_id;
              
              const referrerRef = db.collection('users').doc(referrerId);
              const referralRef = db.collection('referrals').doc(refDoc.id);
              
              return db.runTransaction(transaction => {
                return transaction.get(referrerRef).then(referrerDoc => {
                  let currentProgress = 0;
                  if (referrerDoc.exists) {
                    currentProgress = referrerDoc.data().referrals_current || 0;
                  }
                  
                  let nextProgress = currentProgress + 1;
                  let unlockReward = false;
                  if (nextProgress >= 10) {
                    nextProgress = 0;
                    unlockReward = true;
                  }
                  
                  // Update referrer stats
                  transaction.set(referrerRef, {
                    referrals_total: firebase.firestore.FieldValue.increment(1),
                    referrals_current: nextProgress
                  }, { merge: true });
                  
                  // Confirm the referral state
                  transaction.set(referralRef, {
                    status: 'confirmed',
                    confirmed_at: firebase.firestore.FieldValue.serverTimestamp()
                  }, { merge: true });
                  
                  // Create Coke reward if 10th confirmed referral is reached
                  if (unlockReward) {
                    const rewardRef = db.collection('rewards').doc();
                    const expires = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
                    transaction.set(rewardRef, {
                      user_id: referrerId,
                      reward_type: '3_diet_cokes',
                      status: 'pending',
                      created_at: firebase.firestore.FieldValue.serverTimestamp(),
                      expires_at: expires
                    });
                  }
                });
              });
            });
        };

        const subPromise = db.collection('users').doc(auth.currentUser.uid).set({
          hasSubscription: true
        }, { merge: true });

        const refPromise = confirmReferral(auth.currentUser.uid);

        Promise.all([subPromise, refPromise]).then(() => {
          localStorage.setItem('hasSubscription', 'true');
          checkoutModal.style.display = 'none';
          showToast('🎉 Membership activated! Welcome to the squad.', 'success');
          getMembershipBtn.textContent = 'Active Member ✅';
          getMembershipBtn.style.backgroundColor = '#34C759';
        }).catch(err => {
          console.error("Error activating membership:", err);
          alert("Error processing membership.");
          confirmCheckoutBtn.textContent = ogText;
          confirmCheckoutBtn.disabled = false;
        });
      };

      if (typeof window.processRazorpayPayment === 'function') {
        window.processRazorpayPayment(200, 'PRO Membership', () => {
          processMembership();
        });
        
        // reset button in case they cancel
        setTimeout(() => {
          confirmCheckoutBtn.textContent = ogText;
          confirmCheckoutBtn.disabled = false;
        }, 3000);
      } else {
        processMembership();
      }
    }
  });
}

// ===== AUTH STATE — NAV BUTTON & MATCH COUNT =====
if (typeof auth !== 'undefined' && auth) {
  auth.onAuthStateChanged(function (user) {
    const authBtn  = document.getElementById('authBtn');
    const chatLink = document.querySelector('a[href="squad-chat.html"]');

    if (user) {
      if (authBtn) {
        authBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        authBtn.style.padding = '10px 12px';
        authBtn.style.borderRadius = '50%';
        authBtn.href = 'profile.html';
      }

      if (firebase.firestore) {
        const db = firebase.firestore();

        // Route squad chat link
        if (chatLink) {
          db.collection('squads')
            .where('memberUids', 'array-contains', user.uid)
            .limit(1).get()
            .then(snap => {
              chatLink.href = !snap.empty
                ? 'squad-chat.html?squad=' + snap.docs[0].id
                : 'squad-chat.html';
            })
            .catch(() => { chatLink.href = 'squad-chat.html'; });
        }

        // Listen to user doc for match count + photo
        db.collection('users').doc(user.uid).onSnapshot(doc => {
          const navMatchCount = document.getElementById('navMatchCount');
          const currentAuthBtn = document.getElementById('authBtn');

          if (doc.exists) {
            const data = doc.data();
            if (navMatchCount) navMatchCount.textContent = data.matches || 0;
            if (data.photoBase64 && currentAuthBtn) {
              currentAuthBtn.innerHTML = '';
              currentAuthBtn.style.backgroundImage = `url(${data.photoBase64})`;
              currentAuthBtn.style.backgroundSize = 'cover';
              currentAuthBtn.style.backgroundPosition = 'center';
              currentAuthBtn.style.width = '42px';
              currentAuthBtn.style.height = '42px';
              currentAuthBtn.style.padding = '0';
              currentAuthBtn.style.border = '2px solid var(--lime)';
            }
            
            // Referral UI on Home Page
            const homeRefProgressBar = document.getElementById('homeRefProgressBar');
            const homeRefProgressLabel = document.getElementById('homeRefProgressLabel');
            const homeRefLinkInput = document.getElementById('homeRefLinkInput');
            const homeCopyRefBtn = document.getElementById('homeCopyRefBtn');
            
            if (homeRefProgressBar && homeRefProgressLabel) {
              const currentRefProgress = data.referrals_current || 0;
              const percentage = (currentRefProgress / 10) * 100;
              setTimeout(() => { homeRefProgressBar.style.width = percentage + '%'; }, 100);
              homeRefProgressLabel.textContent = `${currentRefProgress}/10 confirmed`;
              homeRefProgressLabel.style.color = 'var(--text)';
            }
            
            if (homeRefLinkInput && homeCopyRefBtn) {
              const handle = '@' + (data.name || 'Player').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12) + user.uid.substring(0, 4);
              const userRefCode = data.referral_code || handle.substring(1).toUpperCase();
              const refUrl = `https://bookmybox.com/ref/${userRefCode}`;
              
              homeRefLinkInput.value = refUrl;
              homeRefLinkInput.style.color = 'var(--text)';
              homeCopyRefBtn.disabled = false;
              
              homeCopyRefBtn.onclick = function() {
                navigator.clipboard.writeText(refUrl).then(() => {
                  const ogHTML = homeCopyRefBtn.innerHTML;
                  homeCopyRefBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
                  setTimeout(() => { homeCopyRefBtn.innerHTML = ogHTML; }, 2000);
                });
              };
            }
          }
        });
      }
    } else {
      const hasSub = localStorage.getItem('hasSubscription');
      if (authBtn) {
        if (hasSub) {
          authBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
          authBtn.style.padding = '10px 12px';
          authBtn.style.borderRadius = '50%';
          authBtn.href = 'profile.html';
          const mockPhoto = localStorage.getItem('mockPhoto');
          if (mockPhoto) {
            authBtn.innerHTML = '';
            authBtn.style.backgroundImage = `url(${mockPhoto})`;
            authBtn.style.backgroundSize = 'cover';
            authBtn.style.backgroundPosition = 'center';
            authBtn.style.width = '42px';
            authBtn.style.height = '42px';
            authBtn.style.padding = '0';
            authBtn.style.border = '2px solid var(--lime)';
          }
          
          // Mock mode referral UI
          const homeRefProgressBar = document.getElementById('homeRefProgressBar');
          const homeRefProgressLabel = document.getElementById('homeRefProgressLabel');
          const homeRefLinkInput = document.getElementById('homeRefLinkInput');
          const homeCopyRefBtn = document.getElementById('homeCopyRefBtn');
          if (homeRefProgressBar && homeRefProgressLabel) {
            setTimeout(() => { homeRefProgressBar.style.width = '0%'; }, 100);
            homeRefProgressLabel.textContent = `0/10 confirmed`;
            homeRefProgressLabel.style.color = 'var(--text)';
          }
          if (homeRefLinkInput && homeCopyRefBtn) {
            const mockName = localStorage.getItem('mockName') || 'DemoUser';
            const userRefCode = mockName.substring(0,8).toUpperCase() + '123';
            const refUrl = `https://bookmybox.com/ref/${userRefCode}`;
            homeRefLinkInput.value = refUrl;
            homeRefLinkInput.style.color = 'var(--text)';
            homeCopyRefBtn.disabled = false;
            homeCopyRefBtn.onclick = function() {
              navigator.clipboard.writeText(refUrl).then(() => {
                const ogHTML = homeCopyRefBtn.innerHTML;
                homeCopyRefBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
                setTimeout(() => { homeCopyRefBtn.innerHTML = ogHTML; }, 2000);
              });
            };
          }
        } else {
          authBtn.textContent = 'Sign in';
          authBtn.style.padding = '';
          authBtn.style.borderRadius = '';
          authBtn.href = 'signin.html';
        }
      }
      if (chatLink) chatLink.href = 'signin.html';
    }
  });
}

// ===== DYNAMIC VENUES =====
function loadVenues() {
  const dynamicVenuesGrid = document.getElementById('dynamicVenuesGrid');
  if (!dynamicVenuesGrid) return;
  
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    dynamicVenuesGrid.innerHTML = '<p style="color:var(--text-dim); padding: 20px;">Unable to connect to database.</p>';
    return;
  }
  
  const db = firebase.firestore();
  db.collection('venues').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    dynamicVenuesGrid.innerHTML = '';
    
    if (snapshot.empty) {
      dynamicVenuesGrid.innerHTML = '<p style="color:var(--text-dim); padding: 20px;">No boxes available currently.</p>';
      return;
    }
    
    snapshot.forEach(doc => {
      const v = doc.data();
      const bgImg = v.image || 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=500';
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="venue-img" style="background-image: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7)), url('${bgImg}');">
          <span class="venue-badge">${v.rating}</span>
        </div>
        <div class="venue-body">
          <h3>${v.name}</h3>
          <div class="venue-meta">${v.location}</div>
          <div class="venue-foot">
            <div class="price"><span class="now">₹${v.price}/hr</span></div>
            <a class="mini-btn" href="venue-details.html?id=${doc.id}" style="border:none; cursor:pointer; text-decoration:none; display:inline-block; text-align:center;">Book</a>
          </div>
        </div>
      `;
      dynamicVenuesGrid.appendChild(card);
    });
  });
}

// Initialize venues if on home page
if (document.getElementById('dynamicVenuesGrid')) {
  loadVenues();
  
  // Add drag-to-scroll for desktop users
  const slider = document.getElementById('dynamicVenuesGrid');
  let isDown = false;
  let startX;
  let scrollLeft;

  slider.addEventListener('mousedown', (e) => {
    isDown = true;
    slider.style.cursor = 'grabbing';
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  });
  slider.addEventListener('mouseleave', () => {
    isDown = false;
    slider.style.cursor = 'pointer';
  });
  slider.addEventListener('mouseup', () => {
    isDown = false;
    slider.style.cursor = 'pointer';
  });
  slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 2; // scroll-fast
    slider.scrollLeft = scrollLeft - walk;
  });
}

// Razorpay integration removed as per request
