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
const getProMembershipBtn    = document.getElementById('getProMembershipBtn');
const getProMaxMembershipBtn = document.getElementById('getProMaxMembershipBtn');
const checkoutModal      = document.getElementById('checkoutModal');
const closeCheckoutBtn   = document.getElementById('closeCheckoutBtn');
const confirmCheckoutBtn = document.getElementById('confirmCheckoutBtn');
const homeBoxSelection   = document.getElementById('homeBoxSelection');
const homeBoxSelect      = document.getElementById('homeBoxSelect');
const homeBoxError       = document.getElementById('homeBoxError');
const checkoutModalTitle = document.getElementById('checkoutModalTitle');
const checkoutModalDesc  = document.getElementById('checkoutModalDesc');
const checkoutModalPrice = document.getElementById('checkoutModalPrice');

let currentCheckoutPlan = null; // 'pro' or 'promax'

function openCheckoutModal(plan) {
  if (typeof auth !== 'undefined' && !auth.currentUser) {
    window.location.href = 'signin.html';
    return;
  }
  
  currentCheckoutPlan = plan;
  if (homeBoxError) homeBoxError.style.display = 'none';

  if (plan === 'pro') {
    if (checkoutModalTitle) checkoutModalTitle.textContent = 'Get Pro Membership';
    if (checkoutModalDesc) checkoutModalDesc.textContent = 'Member pricing at your selected home box.';
    if (checkoutModalPrice) checkoutModalPrice.textContent = '₹200';
    if (confirmCheckoutBtn) confirmCheckoutBtn.textContent = 'Pay ₹200 & Subscribe';
    if (homeBoxSelection) homeBoxSelection.style.display = 'block';
    
    // Fetch venues if dropdown is empty
    if (homeBoxSelect && homeBoxSelect.options.length <= 1 && typeof firebase !== 'undefined') {
      const db = firebase.firestore();
      db.collection('venues').get().then(snap => {
        homeBoxSelect.innerHTML = '<option value="" disabled selected>Select a box...</option>';
        snap.forEach(doc => {
          const v = doc.data();
          const opt = document.createElement('option');
          opt.value = doc.id;
          opt.textContent = v.name || 'Unnamed Box';
          homeBoxSelect.appendChild(opt);
        });
      }).catch(err => console.error("Error loading venues for select", err));
    }
  } else {
    if (checkoutModalTitle) checkoutModalTitle.textContent = 'Get Pro Max Membership';
    if (checkoutModalDesc) checkoutModalDesc.textContent = 'Ultimate flexibility. Member pricing everywhere.';
    if (checkoutModalPrice) checkoutModalPrice.textContent = '₹400';
    if (confirmCheckoutBtn) confirmCheckoutBtn.textContent = 'Pay ₹400 & Subscribe';
    if (homeBoxSelection) homeBoxSelection.style.display = 'none';
  }

  if (checkoutModal) checkoutModal.style.display = 'flex';
}

if (getProMembershipBtn) {
  getProMembershipBtn.addEventListener('click', (e) => { e.preventDefault(); openCheckoutModal('pro'); });
}
if (getProMaxMembershipBtn) {
  getProMaxMembershipBtn.addEventListener('click', (e) => { e.preventDefault(); openCheckoutModal('promax'); });
}
// Fallback for legacy button id if it still exists elsewhere
const getMembershipBtn = document.getElementById('getMembershipBtn');
if (getMembershipBtn) {
  getMembershipBtn.addEventListener('click', (e) => { e.preventDefault(); openCheckoutModal('promax'); });
}

if (closeCheckoutBtn) {
  closeCheckoutBtn.addEventListener('click', () => { checkoutModal.style.display = 'none'; });
}

if (confirmCheckoutBtn) {
  confirmCheckoutBtn.addEventListener('click', function (e) {
    e.preventDefault();
    
    let selectedBoxId = null;
    if (currentCheckoutPlan === 'pro') {
      selectedBoxId = homeBoxSelect ? homeBoxSelect.value : null;
      if (!selectedBoxId) {
        if (homeBoxError) homeBoxError.style.display = 'block';
        return;
      }
    }
    
    if (typeof auth !== 'undefined' && auth.currentUser && typeof firebase !== 'undefined' && firebase.firestore) {
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
                  let referrerPlan = 'promax'; // default to promax for legacy/unknown
                  if (referrerDoc.exists) {
                    currentProgress = referrerDoc.data().referrals_current || 0;
                    referrerPlan = referrerDoc.data().subscriptionType || 'promax';
                  }
                  
                  let nextProgress = currentProgress + 1;
                  let unlockReward = false;
                  const threshold = (referrerPlan === 'pro') ? 10 : 5;
                  
                  if (nextProgress >= threshold) {
                    nextProgress = 0;
                    unlockReward = true;
                  }
                  
                  transaction.set(referrerRef, {
                    referrals_total: firebase.firestore.FieldValue.increment(1),
                    referrals_current: nextProgress
                  }, { merge: true });
                  
                  transaction.set(referralRef, {
                    status: 'confirmed',
                    confirmed_at: firebase.firestore.FieldValue.serverTimestamp()
                  }, { merge: true });
                  
                  if (unlockReward) {
                    const rewardRef = db.collection('rewards').doc();
                    const expires = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); 
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

        const updateData = {
          hasSubscription: true,
          subscriptionType: currentCheckoutPlan
        };
        if (currentCheckoutPlan === 'pro') {
          updateData.homeBoxId = selectedBoxId;
        }

        const subPromise = db.collection('users').doc(auth.currentUser.uid).set(updateData, { merge: true });
        const refPromise = confirmReferral(auth.currentUser.uid);

        Promise.all([subPromise, refPromise]).then(() => {
          localStorage.setItem('hasSubscription', 'true');
          localStorage.setItem('subscriptionType', currentCheckoutPlan);
          if (currentCheckoutPlan === 'pro' && selectedBoxId) {
             localStorage.setItem('homeBoxId', selectedBoxId);
          }
          checkoutModal.style.display = 'none';
          showToast('🎉 Membership activated! Welcome to the squad.', 'success');
          
          if (currentCheckoutPlan === 'pro' && getProMembershipBtn) {
            getProMembershipBtn.textContent = 'Active Pro ✅';
            getProMembershipBtn.style.backgroundColor = '#34C759';
            getProMembershipBtn.style.color = '#fff';
            getProMembershipBtn.style.borderColor = '#34C759';
          } else if (currentCheckoutPlan === 'promax' && getProMaxMembershipBtn) {
            getProMaxMembershipBtn.textContent = 'Active Pro Max ✅';
            getProMaxMembershipBtn.style.backgroundColor = '#34C759';
            getProMaxMembershipBtn.style.color = '#fff';
            getProMaxMembershipBtn.style.borderColor = '#34C759';
          }
        }).catch(err => {
          console.error("Error activating membership:", err);
          alert("Error processing membership.");
          confirmCheckoutBtn.textContent = ogText;
          confirmCheckoutBtn.disabled = false;
        });
      };
      
      if (typeof window.processRazorpayPayment === 'function') {
        const amount = currentCheckoutPlan === 'promax' ? 400 : 200;
        const desc = currentCheckoutPlan === 'promax' ? 'Pro Max Membership' : 'Pro Membership';
        window.processRazorpayPayment(amount, desc, () => {
          processMembership();
        }, () => {
          confirmCheckoutBtn.textContent = ogText;
          confirmCheckoutBtn.disabled = false;
          if (checkoutModal) checkoutModal.style.display = 'none';
        });
      } else {
        processMembership();
      }
    }
  });
}

// Close checkout modal if clicking the dark overlay background
if (checkoutModal) {
  checkoutModal.addEventListener('click', (e) => {
    if (e.target === checkoutModal) {
      checkoutModal.style.display = 'none';
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
              
              const isSubscribed = data.hasSubscription === true;
              
              if (homeRefLinkInput) {
                homeRefLinkInput.value = isSubscribed ? `https://www.bookmybox.site/signup.html?ref=${userRefCode}` : 'Requires Membership';
                homeRefLinkInput.style.color = isSubscribed ? 'var(--text)' : 'var(--text-dim)';
              }
              
              homeCopyRefBtn.disabled = false;
              homeCopyRefBtn.onclick = function() {
                if (!isSubscribed) {
                  alert("You need an active Book My Box membership to get a referral code and earn rewards.");
                  return;
                }
                const refUrl = `https://www.bookmybox.site/signup.html?ref=${userRefCode}`;
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
            const isSubscribed = localStorage.getItem('hasSubscription') === 'true';
            if (homeRefLinkInput) {
              homeRefLinkInput.value = isSubscribed ? `https://www.bookmybox.site/signup.html?ref=${userRefCode}` : 'Requires Membership';
              homeRefLinkInput.style.color = isSubscribed ? 'var(--text)' : 'var(--text-dim)';
            }
            homeCopyRefBtn.disabled = false;
            homeCopyRefBtn.onclick = function() {
              if (!isSubscribed) {
                alert("You need an active Book My Box membership to get a referral code and earn rewards.");
                return;
              }
              const refUrl = `https://www.bookmybox.site/signup.html?ref=${userRefCode}`;
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
    
    const fragment = document.createDocumentFragment();
    
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
      fragment.appendChild(card);
    });
    
    // Add "Coming Soon" placeholder card to fill out grid visually
    const comingSoon = document.createElement('div');
    comingSoon.className = 'card';
    comingSoon.style.opacity = '0.6';
    comingSoon.style.borderStyle = 'dashed';
    comingSoon.innerHTML = `
      <div class="venue-img" style="background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; height: 160px;">
        <span style="font-size: 32px; filter: grayscale(1); opacity: 0.5;">🚧</span>
      </div>
      <div class="venue-body" style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 120px;">
        <h3 style="color: var(--text-dim);">Coming Soon</h3>
        <div style="font-size: 13px; color: var(--text-dim); margin-top: 4px;">More boxes loading</div>
      </div>
    `;
    fragment.appendChild(comingSoon);
    
    dynamicVenuesGrid.appendChild(fragment);
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

// ===== DIET COKE CAN FALLING ANIMATION =====
(function(){
  const can = document.getElementById('diet-coke-can');
  const refBox = document.getElementById('referralBox');
  if (!can || !refBox) return;

  const lanes = [15, 70, 40, 85, 25];
  
  let ticking = false;
  let cachedRefBoxTop = 0;
  let cachedRefBoxLeft = 0;
  let cachedRefBoxWidth = 0;
  
  function updateCache() {
    const rect = refBox.getBoundingClientRect();
    cachedRefBoxTop = rect.top + window.scrollY;
    cachedRefBoxLeft = rect.left;
    cachedRefBoxWidth = rect.width;
  }
  
  function updateAnimation(){
    const scrollY = window.scrollY;
    
    // The can should be already placed when the user gets to the subscription section.
    // We set the target scroll to when the section is just about to enter the viewport.
    const targetScrollY = Math.max(1, cachedRefBoxTop - window.innerHeight + 50);
    
    let progress = scrollY / targetScrollY;
    let isLanded = false;
    
    if (progress >= 1) {
      progress = 1;
      isLanded = true;
    }

    if (isLanded) {
      can.style.position = 'absolute';
      can.style.top = `${cachedRefBoxTop - 40}px`;
      can.style.left = `${cachedRefBoxLeft + cachedRefBoxWidth - 60}px`; 
      can.style.transform = `rotate(15deg)`;
      can.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    } else {
      can.style.position = 'fixed';
      can.style.top = '0px';
      can.style.transition = 'none'; // CRITICAL: Remove transition during scroll to avoid lag
      
      const boxTopAtTarget = cachedRefBoxTop - targetScrollY;
      const travel = boxTopAtTarget + 180 - 40; 
      let y = -180 + progress * travel;

      let rotate = progress * 540; 

      const seg = progress * (lanes.length - 1);
      const i = Math.floor(seg);
      const t = seg - i;
      const laneA = lanes[i] ?? lanes[lanes.length - 1];
      const laneB = lanes[i + 1] ?? lanes[lanes.length - 1];
      let xVW = laneA + (laneB - laneA) * t;

      const wobble = Math.sin(progress * 20) * 15;

      can.style.left = `calc(${xVW}vw + ${wobble}px)`;
      can.style.transform = `translateY(${y}px) rotate(${rotate}deg)`;
    }
    ticking = false;
  }
  
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateAnimation);
      ticking = true;
    }
  }
  
  function onResize() {
    updateCache();
    onScroll();
  }

  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onResize);
  
  // Wait a tiny bit for layout before initial position
  setTimeout(() => {
    updateCache();
    onScroll();
  }, 100);
})();
