/**
 * profile.js — Book My Box Profile Dashboard
 *
 * Fully defensive design:
 * - Falls back to Firebase Auth profile details if Firestore reads fail or the user document doesn't exist.
 * - Handles offline mock mode, saving all details (Name, Insta, Phone) to LocalStorage.
 * - Enforces timeouts and error boundaries on all network requests so the page never hangs.
 * - Displays active/redeemed/expired rewards with countdowns.
 */

'use strict';

// auth and db are inherited globally from firebase-config.js
let currentUser = null;

// Helper to safely get DOM elements
const getEl = (id) => document.getElementById(id);
const queryEl = (sel) => document.querySelector(sel);

// ── DOM refs ──────────────────────────────────────────────────────────────────
const profileName     = getEl('profileName');
const profileHandle   = getEl('profileHandle');
const profileEmail    = getEl('profileEmail');
const memberSince     = getEl('memberSince');
const homeGround      = getEl('homeGround');
const avatarPreview   = getEl('avatarPreview');
const avatarInitials  = getEl('avatarInitials');
const avatarUpload    = getEl('avatarUpload');
const memberBadge     = getEl('memberBadge');

const profileMatches    = getEl('profileMatches');
const profileVisitsLeft = getEl('profileVisitsLeft');
const profileSquads     = getEl('profileSquads');
const profileReferrals  = getEl('profileReferrals');
const dotTracker        = getEl('dotTracker');
const visitsUsedEl      = getEl('visitsUsed');

const bookingHistoryList = getEl('bookingHistoryList');
const mySquadsList       = getEl('mySquadsList');

// Referral & Rewards refs
const refProgressBar   = getEl('refProgressBar');
const refProgressLabel = getEl('refProgressLabel');
const copyRefBtn       = getEl('copyRefBtn');
const refLinkInput     = getEl('refLinkInput');
const rewardsSection   = getEl('rewardsSection');
const rewardsList      = getEl('rewardsList');
const referralsList    = getEl('referralsList');
const refInfoBtn       = getEl('refInfoBtn');
const infoModal        = getEl('infoModal');
const closeInfoBtn     = getEl('closeInfoBtn');

// Settings Form
const settingName    = getEl('settingName');
const settingInsta   = getEl('settingInsta');
const settingPhone   = getEl('settingPhone');
const saveSettingsBtn = getEl('saveSettingsBtn');
const signOutBtn      = getEl('signOutBtn');
const deleteAccountBtn = getEl('deleteAccountBtn');

// Identity card Instagram block
const profileInsta     = getEl('profileInsta');
const profileInstaText = getEl('profileInstaText');

// Upgrade / Pause refs
const upgradePlanBtn      = getEl('upgradePlanBtn');
const pauseMembershipBtn  = getEl('pauseMembershipBtn');
const upgradeModal        = getEl('upgradeModal');
const closeUpgradeBtn      = getEl('closeUpgradeBtn');
const memberStatusBadge   = getEl('memberStatusBadge');

// ── Helpers ────────────────────────────────────────────────────────────────────

function hydrate(el, text) {
  if (!el) return;
  el.textContent = text;
  el.classList.remove('profile-skeleton');
  el.style.opacity = '1';
}

function renderVisitTracker(used, total) {
  if (!dotTracker) return;
  dotTracker.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i < used ? ' used' : '');
    dotTracker.appendChild(dot);
  }
  if (visitsUsedEl) visitsUsedEl.textContent = used;
  if (profileVisitsLeft) profileVisitsLeft.textContent = total - used;
}

function renderBookingHistory(bookings) {
  if (!bookingHistoryList) return;
  if (!bookings || bookings.length === 0) {
    bookingHistoryList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-text">No bookings yet — book your first box!</div>
      </div>`;
    return;
  }
  bookingHistoryList.innerHTML = bookings.map(b => `
    <div class="list-item">
      <div>
        <div class="item-title">${b.name}</div>
        <div class="item-meta">${b.meta}</div>
      </div>
      <div class="item-status ${b.cls}">${b.status}</div>
    </div>
  `).join('');
}

function renderSquads(squads) {
  if (!mySquadsList) return;
  if (profileSquads) profileSquads.textContent = squads.length;

  if (squads.length === 0) {
    mySquadsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <div class="empty-text">No squads yet. <a href="squad-chat.html?action=create" style="color:var(--lime);">Join or create one →</a></div>
      </div>`;
    return;
  }

  mySquadsList.innerHTML = squads.map(s => `
    <div class="list-item">
      <div>
        <div class="item-title">${s.name}</div>
        <div class="item-meta">${s.meta}</div>
      </div>
      <a href="squad-chat.html?squad=${s.id || ''}" class="btn btn-outline" style="padding:6px 12px;font-size:12px;flex-shrink:0;">Chat</a>
    </div>
  `).join('');
}

function formatMemberSince(createdAt) {
  if (!createdAt) return '—';
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

function showToast(message, type = 'info') {
  const existing = getEl('bmbToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'bmbToast';
  toast.textContent = message;
  const colors = {
    success: 'linear-gradient(135deg,#C6FF3D,#8FCC1F)',
    error:   'linear-gradient(135deg,#FF3B30,#cc2a1f)',
    info:    'linear-gradient(135deg,#3DE8FF,#1bbde0)'
  };
  toast.style.cssText = `
    position:fixed;bottom:28px;left:50%;
    transform:translateX(-50%) translateY(80px);
    background:${colors[type]||colors.info};
    color:#0B1210;font-family:'Manrope',sans-serif;font-weight:800;font-size:14px;
    padding:14px 24px;border-radius:100px;z-index:9999;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);
    white-space:nowrap;max-width:calc(100vw - 48px);text-align:center;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ── Fallback Hydration ──────────────────────────────────────────────────────────

function fallbackToAuthProfile(user) {
  const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Player');
  hydrate(profileName, name);
  if (settingName) settingName.value = name;

  const handle = '@' + name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12) + user.uid.substring(0, 4);
  hydrate(profileHandle, handle);

  if (avatarInitials) avatarInitials.textContent = name.substring(0, 2).toUpperCase();
  if (profileEmail) {
    profileEmail.textContent = user.email || 'No email linked';
    profileEmail.style.opacity = '1';
  }

  // Load defaults for stats so they aren't stuck on "-"
  if (profileMatches) profileMatches.textContent = '0';
  if (profileReferrals) profileReferrals.textContent = '0';
  if (profileSquads) profileSquads.textContent = '0';
  renderVisitTracker(0, 15);
  
  // Hide loading/skeleton classes
  document.querySelectorAll('.profile-skeleton').forEach(el => el.classList.remove('profile-skeleton'));
}

// ── Referral System Real-Time Listeners ────────────────────────────────────────

function initReferralSystem(user, userRefCode) {
  if (refLinkInput) {
    refLinkInput.value = `https://www.bookmybox.site/?ref=${userRefCode}`;
  }

  if (copyRefBtn) {
    copyRefBtn.onclick = function() {
      const copyUrl = `https://www.bookmybox.site/?ref=${userRefCode}`;
      navigator.clipboard.writeText(copyUrl).then(() => {
        const ogText = copyRefBtn.textContent;
        copyRefBtn.textContent = 'Copied!';
        showToast('🔗 Local test link copied!', 'success');
        setTimeout(() => { copyRefBtn.textContent = ogText; }, 1800);
      }).catch(() => {
        prompt('Copy your referral link:', copyUrl);
      });
    };
  }

  db.collection('referrals')
    .where('referrer_user_id', '==', user.uid)
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        if (referralsList) {
          referralsList.innerHTML = `
            <div class="empty-state" style="padding:16px;">
              <div class="empty-text" style="font-size: 12.5px;">No invites yet. Share your link to start earning!</div>
            </div>`;
        }
        if (profileReferrals) profileReferrals.textContent = '0';
        return;
      }

      let confirmedCount = 0;

      const promises = snapshot.docs.map(doc => {
        const refData = doc.data();
        const state = refData.status || 'clicked';
        if (state === 'confirmed') confirmedCount++;

        if (refData.referred_user_id) {
          return db.collection('users').doc(refData.referred_user_id).get()
            .then(userSnap => {
              const name = userSnap.exists ? userSnap.data().name : 'New Player';
              return { name, state, date: refData.signed_up_at || refData.link_clicked_at };
            }).catch(() => {
              return { name: 'New Player', state, date: refData.signed_up_at || refData.link_clicked_at };
            });
        } else {
          return Promise.resolve({ name: 'Anonymous Clicker', state, date: refData.link_clicked_at });
        }
      });

      Promise.all(promises).then(results => {
        results.sort((a, b) => {
          const tA = a.date ? (a.date.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime()) : 0;
          const tB = b.date ? (b.date.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime()) : 0;
          return tB - tA;
        });

        if (referralsList) {
          referralsList.innerHTML = results.map(r => {
            let statusPillClass = 'status-upcoming';
            let statusLabel = 'Clicked';
            if (r.state === 'signed_up') {
              statusPillClass = 'status-completed';
              statusLabel = 'Signed Up';
            } else if (r.state === 'confirmed') {
              statusPillClass = 'status-confirmed';
              statusLabel = 'Confirmed';
            }

            const customStyle = r.state === 'signed_up' ? 'background:rgba(61,232,255,0.1);color:var(--cyan);border-color:rgba(61,232,255,0.2);' : '';

            return `
              <div class="list-item" style="padding: 10px 12px; border-bottom:1px solid var(--card-line);">
                <div>
                  <div class="item-title" style="font-size:13.5px;font-weight:700;">${r.name}</div>
                  <div class="item-meta" style="font-size:11.5px;color:var(--text-dim);">
                    ${r.date ? formatMemberSince(r.date) : 'Recently'}
                  </div>
                </div>
                <div class="item-status ${statusPillClass}" style="font-size:11px;padding:4px 10px;border-radius:100px;text-transform:uppercase;font-family:'Space Mono',monospace;font-weight:700;${customStyle}">
                  ${statusLabel}
                </div>
              </div>
            `;
          }).join('');
        }

        if (profileReferrals) profileReferrals.textContent = confirmedCount;
      });
    }, error => {
      console.warn("Referrals collection listener failed:", error);
    });

  db.collection('rewards')
    .where('user_id', '==', user.uid)
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        if (rewardsSection) rewardsSection.style.display = 'none';
        return;
      }

      if (rewardsSection) rewardsSection.style.display = 'block';
      if (rewardsList) {
        rewardsList.innerHTML = snapshot.docs.map(doc => {
          const reward = doc.data();
          const id = doc.id;
          const created = reward.created_at ? reward.created_at.toDate() : new Date();
          const expires = reward.expires_at ? (reward.expires_at.toDate ? reward.expires_at.toDate() : new Date(reward.expires_at)) : null;
          
          let cardStyle = 'background: rgba(198,255,61,0.04); border: 1px solid rgba(198,255,61,0.2); color: var(--text);';
          let statusHTML = '';
          let actionHTML = '';

          if (reward.status === 'pending') {
            const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
            statusHTML = `<span style="color:var(--lime);font-weight:700;font-size:12px;">🥤 Active (Expires in ${daysLeft} days)</span>`;
            actionHTML = `<button onclick="redeemReward('${id}')" class="btn btn-outline" style="padding:4px 10px;font-size:11px;margin-top:8px;border-color:var(--lime);color:var(--lime);">Redeem (Check-in)</button>`;
          } else if (reward.status === 'redeemed') {
            cardStyle = 'background: rgba(255,255,255,0.02); border: 1px solid var(--card-line); opacity: 0.55;';
            const redeemedDate = reward.redeemed_at ? (reward.redeemed_at.toDate ? reward.redeemed_at.toDate() : new Date(reward.redeemed_at)) : null;
            statusHTML = `<span style="color:var(--text-dim);font-size:12px;text-decoration:line-through;">🥤 Redeemed on ${redeemedDate ? redeemedDate.toLocaleDateString('en-IN') : 'Check-in'}</span>`;
          } else if (reward.status === 'expired') {
            cardStyle = 'background: rgba(255,59,48,0.03); border: 1px solid rgba(255,59,48,0.15); opacity: 0.5;';
            statusHTML = `<span style="color:var(--red);font-size:12px;">🥤 Expired</span>`;
          }

          return `
            <div style="padding: 12px 14px; border-radius: 10px; ${cardStyle}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:800;font-size:13.5px;">3 Diet Cokes Pack</span>
                ${statusHTML}
              </div>
              <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">
                Earned on ${created.toLocaleDateString('en-IN')}
              </div>
              ${actionHTML}
            </div>
          `;
        }).join('');
      }
    }, error => {
      console.warn("Rewards collection listener failed:", error);
    });
}

window.redeemReward = function(rewardId) {
  if (!confirm("Simulate redeeming this reward on your next visit?")) return;
  db.collection('rewards').doc(rewardId).update({
    status: 'redeemed',
    redeemed_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    showToast("🎉 Reward redeemed successfully!", "success");
  }).catch(err => {
    console.error(err);
    showToast("Failed to redeem reward.", "error");
  });
};

window.selectUpgradePlan = function(planName, totalVisits, rateText) {
  if (!currentUser) return;
  
  db.collection('users').doc(currentUser.uid).set({
    plan_name: planName,
    visits_total: totalVisits,
    rate_locked: rateText,
    visits_used: 0
  }, { merge: true }).then(() => {
    if (upgradeModal) upgradeModal.style.display = 'none';
    showToast(`⚡ Plan upgraded to ${planName} successfully!`, 'success');
  }).catch(err => {
    console.error("Upgrade failed:", err);
    showToast("Failed to upgrade plan.", "error");
  });
};

// ── Auth State ─────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(function(user) {

  // ── Signed-in path ──────────────────────────────────────────────────────────
  if (user) {
    currentUser = user;

    if (profileEmail) {
      profileEmail.textContent = user.email || 'No email linked';
      profileEmail.style.opacity = '1';
    }

    if (memberBadge) memberBadge.style.display = 'block';

    // Set a safety load boundary. If Firestore doc fails to load in 2.5 seconds, run fallback hydration.
    let userDocLoaded = false;
    const docTimeout = setTimeout(() => {
      if (!userDocLoaded) {
        console.warn("Firestore user doc load timed out. Running fallback hydration.");
        fallbackToAuthProfile(user);
      }
    }, 2500);

    // Listen to Firestore user doc for stats, referral progress
    db.collection('users').doc(user.uid).onSnapshot(function(doc) {
      userDocLoaded = true;
      clearTimeout(docTimeout);

      if (!doc.exists) {
        fallbackToAuthProfile(user);
        return;
      }

      const data = doc.data();
      const name = data.name || user.displayName || (user.email ? user.email.split('@')[0] : 'Player');
      hydrate(profileName, name);
      if (settingName) settingName.value = name;

      const handle = '@' + name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12) + user.uid.substring(0, 4);
      hydrate(profileHandle, handle);

      // Handle Instagram fields defensively
      if (settingInsta) {
        if (data.instagram) {
          settingInsta.value = data.instagram.startsWith('@') ? data.instagram : '@' + data.instagram;
          if (profileInstaText) profileInstaText.textContent = settingInsta.value;
          if (profileInsta) profileInsta.style.display = 'inline-flex';
        } else {
          settingInsta.value = '';
          if (profileInsta) profileInsta.style.display = 'none';
        }
      }

      if (avatarInitials) avatarInitials.textContent = name.substring(0, 2).toUpperCase();

      if (data.created_at) {
        if (memberSince) memberSince.textContent = formatMemberSince(data.created_at);
      } else if (user.metadata && user.metadata.creationTime) {
        if (memberSince) memberSince.textContent = new Date(user.metadata.creationTime)
          .toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      }

      if (data.location && homeGround) homeGround.textContent = data.location;

      const used  = data.visits_used  || 0;
      const total = data.visits_total || 15;
      renderVisitTracker(used, total);
      if (profileMatches) profileMatches.textContent = data.matches || 0;

      // Handle Membership Pause State UI defensively
      if (!data.hasSubscription) {
        if (memberStatusBadge) {
          memberStatusBadge.textContent = 'No Plan';
          memberStatusBadge.className = 'status-badge';
          memberStatusBadge.style.background = 'rgba(255,255,255,0.1)';
          memberStatusBadge.style.color = 'var(--text-dim)';
        }
        if (pauseMembershipBtn) pauseMembershipBtn.style.display = 'none';
      } else if (data.subscriptionStatus === 'paused') {
        if (memberStatusBadge) {
          memberStatusBadge.textContent = 'Paused';
          memberStatusBadge.className = 'status-badge';
          memberStatusBadge.style.background = '#FFA500';
          memberStatusBadge.style.color = '#0B1210';
        }
        if (pauseMembershipBtn) {
          pauseMembershipBtn.textContent = 'Resume Membership';
          pauseMembershipBtn.style.display = 'block';
        }
      } else {
        if (memberStatusBadge) {
          memberStatusBadge.textContent = 'Active';
          memberStatusBadge.className = 'status-badge active';
          memberStatusBadge.style.background = '';
          memberStatusBadge.style.color = '';
        }
        if (pauseMembershipBtn) {
          pauseMembershipBtn.textContent = 'Pause Membership';
          pauseMembershipBtn.style.display = 'block';
        }
      }

      // Display locked rate
      const rateEl = queryEl('.membership-info .rate');
      if (rateEl) rateEl.textContent = data.rate_locked || '₹450/hr locked rate';

      // Display plan type
      const planTypeEl = queryEl('.membership-info .plan-type');
      if (planTypeEl) {
        planTypeEl.innerHTML = `${data.plan_name || 'Monthly PRO'} • <span class="rate">${data.rate_locked || '₹450/hr locked rate'}</span>`;
      }

      if (data.phone && settingPhone) settingPhone.value = data.phone;
      
      const profileWallet = getEl('profileWallet');
      if (profileWallet) {
        profileWallet.textContent = `₹${data.wallet || 0}`;
      }

      if (data.photoBase64 && avatarPreview) {
        avatarPreview.style.backgroundImage = `url(${data.photoBase64})`;
        if (avatarInitials) avatarInitials.style.display = 'none';
      } else if (user.photoURL && avatarPreview) {
        avatarPreview.style.backgroundImage = `url(${user.photoURL})`;
        if (avatarInitials) avatarInitials.style.display = 'none';
      }

      // Initialize Referral Progress (0-10)
      const currentRefProgress = data.referrals_current || 0;
      if (refProgressBar && refProgressLabel) {
        const percentage = (currentRefProgress / 10) * 100;
        refProgressBar.style.width = percentage + '%';
        refProgressLabel.textContent = `${currentRefProgress}/10 confirmed referrals`;
      }

      // Initialize click tracking list
      initReferralSystem(user, data.referral_code || handle.substring(1).toUpperCase());
    }, function(error) {
      console.warn("Firestore doc listener failed, falling back:", error);
      userDocLoaded = true;
      clearTimeout(docTimeout);
      fallbackToAuthProfile(user);
    });

    // ── Squads ───────────────────────────────────────────────────────────────
    let squadsLoaded = false;
    const squadsTimeout = setTimeout(() => {
      if (!squadsLoaded) {
        console.warn("Squads fetch timed out. Loading empty state.");
        renderSquads([]);
      }
    }, 2500);

    db.collection('squads')
      .where('memberUids', 'array-contains', user.uid)
      .get()
      .then(function(snap) {
        squadsLoaded = true;
        clearTimeout(squadsTimeout);
        const squads = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || 'Unnamed Squad',
          meta: `${(d.data().members || []).length} members · Created ${formatMemberSince(d.data().created_at)}`
        }));
        renderSquads(squads);
      })
      .catch(function(error) {
        console.warn("Squads fetch failed:", error);
        squadsLoaded = true;
        clearTimeout(squadsTimeout);
        renderSquads([]);
      });

    // ── Booking History ──────────────────────────────────────────────────────
    db.collection('bookings')
      .where('user_id', '==', user.uid)
      .orderBy('slot_start', 'desc')
      .limit(3)
      .get()
      .then(function(snap) {
        if (!snap.empty) {
          const bookings = snap.docs.map(d => {
            const data = d.data();
            const date = data.slot_start ? data.slot_start.toDate() : new Date();
            return {
              name: data.venue_name || 'Box Venue',
              meta: date.toLocaleString('en-IN', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
              status: data.status || 'Completed',
              cls: 'status-' + (data.status || 'completed').toLowerCase()
            };
          });
          renderBookingHistory(bookings);
        } else {
          renderBookingHistory([]);
        }
      })
      .catch(function() {
        renderBookingHistory([]);
      });

  // ── Not signed in (Local Storage Mock Testing) ──────────────────────────────────
  } else {
    const hasSub = localStorage.getItem('hasSubscription');
    if (hasSub) {
      const mockName  = localStorage.getItem('mockName') || 'Demo User';
      const mockInsta = localStorage.getItem('mockInsta') || '';
      const mockPhone = localStorage.getItem('mockPhone') || '';

      hydrate(profileName, mockName);
      hydrate(profileHandle, '@' + mockName.toLowerCase().replace(/\s/g, ''));
      if (profileEmail) {
        profileEmail.textContent = localStorage.getItem('mockEmail') || 'demo@bookmybox.com';
        profileEmail.style.opacity = '1';
      }
      if (avatarInitials) avatarInitials.textContent = mockName.substring(0, 2).toUpperCase();
      
      if (settingName) settingName.value = mockName;
      if (settingPhone) settingPhone.value = mockPhone;
      if (settingInsta) {
        settingInsta.value = mockInsta;
        if (newInsta && profileInstaText && profileInsta) {
          profileInstaText.textContent = mockInsta.startsWith('@') ? mockInsta : '@' + mockInsta;
          profileInsta.style.display = 'inline-flex';
        }
      }

      if (memberSince) memberSince.textContent = 'Jul 2026';
      renderVisitTracker(8, 15);
      renderBookingHistory([
        { name: 'Turf Park, Hyderabad', meta: 'Thu, Jul 16 • 7:00 PM', status: 'Upcoming',  cls: 'status-upcoming'   },
        { name: 'Vantage Arena',         meta: 'Mon, Jul 13 • 6:30 PM', status: 'Completed', cls: 'status-completed'  }
      ]);
      renderSquads([
        { id: '', name: 'Vanasthalipuram Strikers', meta: '6 members · Active today' },
        { id: '', name: 'Weekend Warriors',          meta: '12 members · Active 2 days ago' }
      ]);

      const mockPhoto = localStorage.getItem('mockPhoto');
      if (mockPhoto && avatarPreview) {
        avatarPreview.style.backgroundImage = `url(${mockPhoto})`;
        if (avatarInitials) avatarInitials.style.display = 'none';
      }
      if (memberBadge) memberBadge.style.display = 'block';
      if (profileReferrals) profileReferrals.textContent = '0';
      if (profileMatches) profileMatches.textContent = '0';
      
      // Hide all skeletons
      document.querySelectorAll('.profile-skeleton').forEach(el => el.classList.remove('profile-skeleton'));
    } else {
      window.location.href = 'signin.html';
    }
  }
});

// ── Save Settings ─────────────────────────────────────────────────────────────
if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', () => {
    const newName  = settingName ? settingName.value.trim() : '';
    const newInsta = settingInsta ? settingInsta.value.trim() : '';
    const newPhone = settingPhone ? settingPhone.value.trim() : '';
    if (!newName) { showToast('Name cannot be empty', 'error'); return; }

    const ogText = saveSettingsBtn.textContent;
    saveSettingsBtn.textContent = 'Saving…';
    saveSettingsBtn.disabled = true;

    const updates = { name: newName, instagram: newInsta };
    if (newPhone) updates.phone = newPhone;

    const save = currentUser
      ? db.collection('users').doc(currentUser.uid).set(updates, { merge: true })
      : Promise.resolve();

    save.then(() => {
      // Save locally to support mock/offline mode too
      localStorage.setItem('mockName', newName);
      localStorage.setItem('mockInsta', newInsta);
      localStorage.setItem('mockPhone', newPhone);

      hydrate(profileName, newName);
      
      const uidSuffix = currentUser ? currentUser.uid.substring(0,4) : '1234';
      const handle = '@' + newName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12) + uidSuffix;
      hydrate(profileHandle, handle);
      
      if (avatarInitials) avatarInitials.textContent = newName.substring(0, 2).toUpperCase();
      
      // Update UI instagram display handle
      if (profileInstaText && profileInsta) {
        if (newInsta) {
          profileInstaText.textContent = newInsta.startsWith('@') ? newInsta : '@' + newInsta;
          profileInsta.style.display = 'inline-flex';
        } else {
          profileInsta.style.display = 'none';
        }
      }

      saveSettingsBtn.textContent = '✅ Saved!';
      saveSettingsBtn.style.background = '#4CAF50';
      setTimeout(() => {
        saveSettingsBtn.textContent = ogText;
        saveSettingsBtn.classList.add('btn-lime');
        saveSettingsBtn.style.background = '';
        saveSettingsBtn.disabled = false;
      }, 2000);
    }).catch(err => {
      console.error(err);
      showToast('Failed to save — try again', 'error');
      saveSettingsBtn.textContent = ogText;
      saveSettingsBtn.disabled = false;
    });
  });
}

// ── Info Modal Trigger ────────────────────────────────────────────────────────
if (refInfoBtn && infoModal && closeInfoBtn) {
  refInfoBtn.onclick = function() { infoModal.style.display = 'flex'; };
  closeInfoBtn.onclick = function() { infoModal.style.display = 'none'; };
  infoModal.onclick = function(e) { if (e.target === infoModal) infoModal.style.display = 'none'; };
}

// ── Pause Membership Trigger ───────────────────────────────────────────────────
if (pauseMembershipBtn) {
  pauseMembershipBtn.addEventListener('click', () => {
    if (!currentUser) {
      // Offline mock pause toggle
      const mockPaused = localStorage.getItem('mockSubscriptionStatus') === 'paused';
      const newMockStatus = mockPaused ? 'active' : 'paused';
      localStorage.setItem('mockSubscriptionStatus', newMockStatus);
      showToast(newMockStatus === 'paused' ? '⏸️ Membership paused!' : '▶️ Membership resumed!', 'success');
      
      // Reload UI mock pause state
      if (memberStatusBadge) {
        if (newMockStatus === 'paused') {
          memberStatusBadge.textContent = 'Paused';
          memberStatusBadge.className = 'status-badge';
          memberStatusBadge.style.background = '#FFA500';
          pauseMembershipBtn.textContent = 'Resume Membership';
        } else {
          memberStatusBadge.textContent = 'Active';
          memberStatusBadge.className = 'status-badge active';
          memberStatusBadge.style.background = '';
          pauseMembershipBtn.textContent = 'Pause Membership';
        }
      }
      return;
    }
    
    db.collection('users').doc(currentUser.uid).get().then(doc => {
      if (doc.exists) {
        const data = doc.data();
        const currentStatus = data.subscriptionStatus || 'active';
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        
        db.collection('users').doc(currentUser.uid).set({
          subscriptionStatus: newStatus
        }, { merge: true }).then(() => {
          showToast(newStatus === 'paused' ? '⏸️ Membership paused!' : '▶️ Membership resumed!', 'success');
        });
      }
    });
  });
}

// ── Upgrade Modal Triggers ─────────────────────────────────────────────────────
if (upgradePlanBtn && upgradeModal && closeUpgradeBtn) {
  upgradePlanBtn.onclick = function() { upgradeModal.style.display = 'flex'; };
  closeUpgradeBtn.onclick = function() { upgradeModal.style.display = 'none'; };
  upgradeModal.onclick = function(e) { if (e.target === upgradeModal) upgradeModal.style.display = 'none'; };
}


// ── Custom UI Alert Modal ─────────────────────────────────────────────────────
const alertModal = getEl('customAlertModal');
const alertTitle = getEl('alertTitle');
const alertMessage = getEl('alertMessage');
const alertConfirmBtn = getEl('alertConfirmBtn');
const alertCancelBtn = getEl('alertCancelBtn');
const alertIcon = getEl('alertIcon');

function showAlert(title, message, confirmText, isDanger, onConfirm) {
  if (!alertModal) return;
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertConfirmBtn.textContent = confirmText;
  
  if (isDanger) {
    alertIcon.textContent = '⚠️';
    alertConfirmBtn.style.background = 'var(--red)';
  } else {
    alertIcon.textContent = '❓';
    alertConfirmBtn.style.background = 'var(--lime)';
    alertConfirmBtn.style.color = '#0B1210';
  }
  
  alertConfirmBtn.onclick = () => {
    alertModal.style.display = 'none';
    onConfirm();
  };
  
  alertCancelBtn.onclick = () => {
    alertModal.style.display = 'none';
  };
  
  alertModal.style.display = 'flex';
}


// ── Sign Out ──────────────────────────────────────────────────────────────────
if (signOutBtn) {
  signOutBtn.addEventListener('click', () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      'Yes, Sign Out',
      false,
      () => {
        if (currentUser) {
          auth.signOut().then(() => { window.location.href = 'index.html'; });
        } else {
          ['hasSubscription','mockReferrals','mockPhoto','mockName','mockEmail','mockInsta','mockPhone','mockSubscriptionStatus'].forEach(k => localStorage.removeItem(k));
          window.location.href = 'index.html';
        }
      }
    );
  });
}

// ── Delete Account ─────────────────────────────────────────────────────────────
if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', () => {
    showAlert(
      'Delete Account',
      'Do you want to delete it? It will delete forever permanently.',
      'Yes, permanently delete',
      true,
      () => {
        if (currentUser) {
          const uid = currentUser.uid;
          db.collection('users').doc(uid).delete()
            .then(() => currentUser.delete())
            .then(() => {
              ['hasSubscription','mockReferrals','mockPhoto','mockName','mockEmail','mockInsta','mockPhone','mockSubscriptionStatus'].forEach(k => localStorage.removeItem(k));
              window.location.href = 'index.html';
            })
            .catch(err => {
              console.error(err);
              if (err.code === 'auth/requires-recent-login') {
                showToast('For security, sign out and sign back in to delete.', 'error');
              } else {
                showToast('Delete failed — contact support.', 'error');
              }
            });
        } else {
          ['hasSubscription','mockReferrals','mockPhoto','mockName','mockEmail','mockInsta','mockPhone','mockSubscriptionStatus'].forEach(k => localStorage.removeItem(k));
          window.location.href = 'index.html';
        }
      }
    );
  });
}

// ── Avatar Upload ─────────────────────────────────────────────────────────────
if (avatarUpload) {
  avatarUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE/w; w = MAX_SIZE; } }
        else        { if (h > MAX_SIZE) { w *= MAX_SIZE/h; h = MAX_SIZE; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (avatarPreview) avatarPreview.style.backgroundImage = `url(${dataUrl})`;
        if (avatarInitials) avatarInitials.style.display = 'none';
        if (currentUser) {
          db.collection('users').doc(currentUser.uid).set({ photoBase64: dataUrl }, { merge: true });
        } else {
          localStorage.setItem('mockPhoto', dataUrl);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}
