// Retrieve database reference safely without re-declaring 'db' which causes SyntaxError
let database = null;
try {
  database = (typeof db !== 'undefined') ? db : ((typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null);
} catch (err) {
  console.error("Firestore initialization failed:", err);
}

// ===== DOM REFS =====
const chatMessages = document.getElementById('chatMessages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const toggleInfoPanel = document.getElementById('toggleInfoPanel');
const infoDrawer = document.getElementById('infoDrawer');
const closeDrawer = document.getElementById('closeDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');

// Main structures
const chatMainCol = document.getElementById('chatMainCol');
const squadSetupScreen = document.getElementById('squadSetupScreen');

// Setup screen tabs & panes
const tabCreateBtn = document.getElementById('tabCreateBtn');
const tabJoinBtn = document.getElementById('tabJoinBtn');
const paneCreate = document.getElementById('paneCreate');
const paneJoin = document.getElementById('paneJoin');

// Setup forms
const setupCreateForm = document.getElementById('setupCreateForm');
const setupJoinForm = document.getElementById('setupJoinForm');
const setupJoinCodeInput = document.getElementById('setupJoinCode');
const setupJoinPreview = document.getElementById('setupJoinPreview');
const setupPreviewName = document.getElementById('setupPreviewName');
const setupPreviewMembers = document.getElementById('setupPreviewMembers');

// Squad details DOM
const squadNameEl = document.querySelector('.squad-name');
const squadMetaEl = document.querySelector('.squad-meta');
const drawerBadgeEl = document.querySelector('.squad-badge-big');
const drawerNameEl = document.querySelector('.info-drawer h4');
const drawerSubEl = document.querySelector('.drawer-sub');
const drawerMembersEl = document.querySelector('.info-drawer .member-list');
const leaveSquadBtn = document.getElementById('leaveSquadBtn');

// Parse Query String
const urlParams = new URLSearchParams(window.location.search);
let squadId = urlParams.get('squad');
const joinLinkCode = urlParams.get('join');

let currentUser = null;
let currentSquadName = "Vanasthalipuram Strikers";
let currentSquadMemberCount = 1;
let currentSquadAdminId = null;
let unsubMessages = null;
let unsubSquad = null;

// Initial mock messages (seeding structure for mock squads)
const defaultSeedMessages = [];

// Scroll to bottom helper
function scrollToBottom() {
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Info drawer toggle
function openDrawer() {
  if (infoDrawer) infoDrawer.classList.add('open');
  if (drawerOverlay) drawerOverlay.classList.add('open');
}
function closeDrawerFn() {
  if (infoDrawer) infoDrawer.classList.remove('open');
  if (drawerOverlay) drawerOverlay.classList.remove('open');
}
if (toggleInfoPanel) toggleInfoPanel.addEventListener('click', openDrawer);
if (closeDrawer) closeDrawer.addEventListener('click', closeDrawerFn);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawerFn);

// Esc to close drawer
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDrawerFn();
});

// Setup Screen Tab Toggle
if (tabCreateBtn && tabJoinBtn) {
  tabCreateBtn.addEventListener('click', () => {
    tabCreateBtn.classList.add('active');
    tabJoinBtn.classList.remove('active');
    paneCreate.style.display = 'block';
    paneJoin.style.display = 'none';
  });
  tabJoinBtn.addEventListener('click', () => {
    tabJoinBtn.classList.add('active');
    tabCreateBtn.classList.remove('active');
    paneJoin.style.display = 'block';
    paneCreate.style.display = 'none';
  });
}

// ===== AUTH STATE =====
let authResolved = false;
const authTimeout = setTimeout(function() {
  if (!authResolved) {
    console.warn("Firebase Auth state check timed out, falling back to mock workspace.");
    loadMockWorkspace();
  }
}, 1500);

if (typeof firebase !== 'undefined' && firebase.auth) {
  try {
    firebase.auth().onAuthStateChanged(function(user) {
      authResolved = true;
      clearTimeout(authTimeout);
      if (user) {
        currentUser = user;
        
        // Listen to user stats
        if (database) {
          database.collection('users').doc(user.uid).onSnapshot(function(doc) {
            const navGlobalStats = document.getElementById('navGlobalStats');
            const navMatchCount = document.getElementById('navMatchCount');
            const navReferCount = document.getElementById('navReferCount');
            
            if (navGlobalStats) navGlobalStats.style.display = 'flex';
            
            let matches = 0;
            let referrals = 0;

            if (doc.exists) {
              const data = doc.data();
              matches = data.matches || 0;
              referrals = data.referrals || 0;
              
              const chatProfileBtn = document.getElementById('chatProfileBtn');
              if (data.photoBase64 && chatProfileBtn) {
                chatProfileBtn.innerHTML = '';
                chatProfileBtn.style.backgroundImage = `url(${data.photoBase64})`;
                chatProfileBtn.style.backgroundSize = 'cover';
                chatProfileBtn.style.backgroundPosition = 'center';
                chatProfileBtn.style.width = '42px';
                chatProfileBtn.style.height = '42px';
                chatProfileBtn.style.padding = '0';
                chatProfileBtn.style.border = '2px solid var(--lime)';
              }
            }

            if (navMatchCount) navMatchCount.textContent = matches;
            if (navReferCount) navReferCount.textContent = referrals;
          });
        }
        
        initializeWorkspace();
      } else {
        currentUser = null;
        // If there are local cached squads, let them load the chat offline instead of forcing a redirect!
        const localSquads = getLocalSquads();
        if (localSquads.length > 0) {
          const mockPhoto = localStorage.getItem('mockPhoto');
          const chatProfileBtn = document.getElementById('chatProfileBtn');
          if (mockPhoto && chatProfileBtn) {
            chatProfileBtn.innerHTML = '';
            chatProfileBtn.style.backgroundImage = `url(${mockPhoto})`;
            chatProfileBtn.style.backgroundSize = 'cover';
            chatProfileBtn.style.backgroundPosition = 'center';
            chatProfileBtn.style.width = '42px';
            chatProfileBtn.style.height = '42px';
            chatProfileBtn.style.padding = '0';
            chatProfileBtn.style.border = '2px solid var(--lime)';
          }
          initializeWorkspace();
        } else {
          window.location.href = 'signin.html';
        }
      }
    });
  } catch (err) {
    authResolved = true;
    clearTimeout(authTimeout);
    console.error("Firebase auth listen failed, loading mock workspace:", err);
    loadMockWorkspace();
  }
} else {
  authResolved = true;
  clearTimeout(authTimeout);
  loadMockWorkspace();
}

// ===== INITIALIZE WORKSPACE =====
function initializeWorkspace() {
  if (urlParams.get('setup') === '1') {
    showSetupScreen();
    return;
  }

  // Check if join link is present in URL
  if (joinLinkCode) {
    showSetupScreen();
    tabJoinBtn.click();
    setupJoinCodeInput.value = joinLinkCode.toUpperCase();
    lookupSetupSquad(joinLinkCode.toUpperCase());
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }

  if (squadId) {
    // Show chat workspace
    squadSetupScreen.style.display = 'none';
    chatMainCol.style.display = 'flex';
    if (infoDrawer) infoDrawer.style.display = 'flex';

    loadSquadDetails(squadId);
    loadMessages(squadId);
  } else {
    // Find squads belonging to this user
    if (database && currentUser) {
      let queryResolved = false;
      const dbTimeout = setTimeout(function() {
        if (!queryResolved) {
          console.warn("Firestore query timed out, checking localStorage.");
          checkLocalSquads();
        }
      }, 1500);

      database.collection('squads')
        .where('memberUids', 'array-contains', currentUser.uid)
        .limit(1)
        .get()
        .then(function(snapshot) {
          clearTimeout(dbTimeout);
          queryResolved = true;
          if (!snapshot.empty) {
            const fetchedId = snapshot.docs[0].id;
            if (squadId !== fetchedId) {
              squadId = fetchedId;
              window.history.replaceState({}, '', 'squad-chat.html?squad=' + squadId);
              
              squadSetupScreen.style.display = 'none';
              chatMainCol.style.display = 'flex';
              if (infoDrawer) infoDrawer.style.display = 'flex';
              
              loadSquadDetails(squadId);
              loadMessages(squadId);
            }
          } else {
            checkLocalSquads();
          }
        })
        .catch(function(err) {
          clearTimeout(dbTimeout);
          queryResolved = true;
          console.error("Firestore lookup failed, checking local storage:", err);
          checkLocalSquads();
        });
    } else {
      checkLocalSquads();
    }
  }
}

function checkLocalSquads() {
  const localSquads = getLocalSquads();
  const searchUid = currentUser ? currentUser.uid : 'me';
  const myLocalSquad = localSquads.find(s => s.memberUids && s.memberUids.includes(searchUid)) || localSquads[0];
  
  if (myLocalSquad) {
    if (squadId !== myLocalSquad.id) {
      // Instead of reloading the page, just update state inline (SPA style)
      squadId = myLocalSquad.id;
      window.history.replaceState({}, '', 'squad-chat.html?squad=' + squadId);
      
      // Manually trigger the workspace load
      squadSetupScreen.style.display = 'none';
      chatMainCol.style.display = 'flex';
      if (infoDrawer) infoDrawer.style.display = 'flex';
      
      loadSquadDetails(squadId);
      loadMessages(squadId);
    }
  } else {
    // Show empty setup workspace
    showSetupScreen();
  }
}

function showSetupScreen() {
  squadSetupScreen.style.display = 'flex';
  chatMainCol.style.display = 'none';
  if (infoDrawer) infoDrawer.style.display = 'none';
  if (drawerOverlay) drawerOverlay.style.display = 'none';
}

function loadMockWorkspace() {
  // Absolute fallback offline mockup mode disabled as per request
  showSetupScreen();
}

// ===== CODE GENERATOR =====
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BMB-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ===== LOCAL STORAGE SQUAD MANAGEMENT =====
function getLocalSquads() {
  try {
    return JSON.parse(localStorage.getItem('bmb_squads')) || [];
  } catch (e) {
    return [];
  }
}

function saveLocalSquad(squad) {
  const squads = getLocalSquads();
  // Filter out any older instances of the same squad
  const filtered = squads.filter(s => s.id !== squad.id);
  filtered.push(squad);
  localStorage.setItem('bmb_squads', JSON.stringify(filtered));
}

function getLocalMessages(sId) {
  try {
    const list = JSON.parse(localStorage.getItem('bmb_messages_' + sId));
    return list || null;
  } catch (e) {
    return null;
  }
}

function saveLocalMessages(sId, messages) {
  localStorage.setItem('bmb_messages_' + sId, JSON.stringify(messages));
}

// ===== CREATE SQUAD SHARED ACTION =====
function createSquadAction(name, tagline, submitBtn, formEl) {
  if (!name) return;
  submitBtn.textContent = 'Creating...';
  submitBtn.style.pointerEvents = 'none';

  const sId = 'squad_' + Date.now();
  const code = generateCode();
  const newSquadObj = {
    id: sId,
    name: name,
    tagline: tagline || "Ready to play!",
    code: code,
    createdBy: currentUser ? currentUser.uid : 'me',
    createdByName: currentUser ? (currentUser.displayName || currentUser.email) : 'Player',
    createdAt: new Date().toISOString(),
    memberUids: [currentUser ? currentUser.uid : 'me'],
    members: [{
      uid: currentUser ? currentUser.uid : 'me',
      name: currentUser ? (currentUser.displayName || currentUser.email) : 'Player',
      role: 'admin',
    }],
    stats: { games: 0, wins: 0, streak: 0 }
  };

  saveLocalSquad(newSquadObj);
  saveLocalMessages(sId, defaultSeedMessages);

  if (database && currentUser) {
    database.collection('squads').add({
      name: name,
      tagline: tagline || "Ready to play!",
      code: code,
      createdBy: currentUser.uid,
      createdByName: currentUser.displayName || currentUser.email || 'Player',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      memberUids: [currentUser.uid],
      members: [{
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email || 'Player',
        role: 'admin',
        photoUrl: currentUser.photoURL || localStorage.getItem('mockPhoto') || null,
        joinedAt: new Date().toISOString()
      }],
      stats: { games: 0, wins: 0, streak: 0 }
    }).then(function(docRef) {
      window.location.href = 'squad-chat.html?squad=' + docRef.id;
    }).catch(function(err) {
      console.error("Firestore creation failed, fallback to local:", err);
      window.location.href = 'squad-chat.html?squad=' + sId;
    });
  } else {
    setTimeout(() => {
      window.location.href = 'squad-chat.html?squad=' + sId;
    }, 800);
  }
}

// ===== JOIN SQUAD SHARED ACTION =====
function joinSquadAction(code, submitBtn, formEl) {
  if (!code) return;
  submitBtn.textContent = 'Verifying...';
  submitBtn.style.pointerEvents = 'none';

  const isSubscribed = localStorage.getItem('hasSubscription') === 'true';

  if (database && currentUser) {
    database.collection('users').doc(currentUser.uid).get().then(doc => {
      const dbSub = doc.exists && doc.data().hasSubscription === true;
      if (!dbSub && !isSubscribed) {
        submitBtn.textContent = 'Join Squad';
        submitBtn.style.pointerEvents = 'auto';
        showSetupError(formEl, 'You must have an active Book My Box membership to join a squad.');
        return;
      }
      continueJoinAction(code, submitBtn, formEl);
    }).catch(err => {
      if (!isSubscribed) {
        submitBtn.textContent = 'Join Squad';
        submitBtn.style.pointerEvents = 'auto';
        showSetupError(formEl, 'You must have an active Book My Box membership to join a squad.');
        return;
      }
      continueJoinAction(code, submitBtn, formEl);
    });
  } else {
    if (!isSubscribed) {
      submitBtn.textContent = 'Join Squad';
      submitBtn.style.pointerEvents = 'auto';
      showSetupError(formEl, 'You must have an active Book My Box membership to join a squad.');
      return;
    }
    continueJoinAction(code, submitBtn, formEl);
  }
}

function continueJoinAction(code, submitBtn, formEl) {
  submitBtn.textContent = 'Joining...';
  
  const localSquads = getLocalSquads();
  const matchedLocal = localSquads.find(s => s.code === code);
  if (matchedLocal) {
    if (currentUser && !matchedLocal.memberUids.includes(currentUser.uid)) {
      matchedLocal.memberUids.push(currentUser.uid);
      matchedLocal.members.push({
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email || 'Player',
        role: 'member',
        photoUrl: currentUser.photoURL || localStorage.getItem('mockPhoto') || null,
        joinedAt: new Date().toISOString()
      });
      saveLocalSquad(matchedLocal);
    }
  }

  if (database && currentUser) {
    database.collection('squads').where('code', '==', code).get()
      .then(function(snapshot) {
        if (snapshot.empty) {
          if (matchedLocal) {
            window.location.href = 'squad-chat.html?squad=' + matchedLocal.id;
          } else {
            submitBtn.textContent = 'Join Squad';
            submitBtn.style.pointerEvents = 'auto';
            showSetupError(formEl, 'No squad found with that code.');
          }
          return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        if (data.memberUids && data.memberUids.includes(currentUser.uid)) {
          window.location.href = 'squad-chat.html?squad=' + doc.id;
          return;
        }

        return doc.ref.update({
          memberUids: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
          members: firebase.firestore.FieldValue.arrayUnion({
            uid: currentUser.uid,
            name: currentUser.displayName || currentUser.email || 'Player',
            role: 'member',
            photoUrl: currentUser.photoURL || localStorage.getItem('mockPhoto') || null,
            joinedAt: new Date().toISOString()
          })
        }).then(function() {
          window.location.href = 'squad-chat.html?squad=' + doc.id;
        });
      })
      .catch(function(err) {
        if (matchedLocal) {
          window.location.href = 'squad-chat.html?squad=' + matchedLocal.id;
        } else {
          submitBtn.textContent = 'Join Squad';
          submitBtn.style.pointerEvents = 'auto';
          showSetupError(formEl, 'Failed to join. Try again.');
        }
        console.error(err);
      });
  } else {
    setTimeout(() => {
      if (matchedLocal) {
        window.location.href = 'squad-chat.html?squad=' + matchedLocal.id;
      } else {
        submitBtn.textContent = 'Join Squad';
        submitBtn.style.pointerEvents = 'auto';
        showSetupError(formEl, 'No squad found offline with that code.');
      }
    }, 800);
  }
}

// ===== REGISTER FORMS LISTENERS =====
if (setupCreateForm) {
  setupCreateForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('setupSquadName').value.trim();
    const tagline = document.getElementById('setupSquadTagline').value.trim();
    const btn = this.querySelector('.btn-lime');
    createSquadAction(name, tagline, btn, setupCreateForm);
  });
}

const modalCreateSquadForm = document.getElementById('createSquadForm');
if (modalCreateSquadForm) {
  modalCreateSquadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('squadName').value.trim();
    const tagline = document.getElementById('squadTagline').value.trim();
    const btn = this.querySelector('.btn-lime');
    createSquadAction(name, tagline, btn, modalCreateSquadForm);
  });
}

if (setupJoinForm) {
  setupJoinForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const code = setupJoinCodeInput.value.trim().toUpperCase();
    const btn = this.querySelector('.btn-lime');
    joinSquadAction(code, btn, setupJoinForm);
  });
}

const modalJoinSquadForm = document.getElementById('joinSquadForm');
if (modalJoinSquadForm) {
  modalJoinSquadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    const btn = this.querySelector('.btn-lime');
    joinSquadAction(code, btn, modalJoinSquadForm);
  });
}

// ===== SEED INITIAL SQUAD MESSAGES IN FIRESTORE =====
function seedSquadMessages(newSquadId) {
  // Removed fake seeding logic. New squads will start with an empty chat.
  return Promise.resolve();
}

// Live lookup inside setup screen
if (setupJoinCodeInput) {
  let lookupTimeout = null;
  setupJoinCodeInput.addEventListener('input', function() {
    const code = this.value.trim().toUpperCase();
    clearTimeout(lookupTimeout);
    if (code.length >= 9) {
      lookupTimeout = setTimeout(() => lookupSetupSquad(code), 400);
    } else {
      setupJoinPreview.style.display = 'none';
    }
  });
}

function lookupSetupSquad(code) {
  // Check local squads first
  const localSquads = getLocalSquads();
  const matched = localSquads.find(s => s.code === code);
  if (matched) {
    setupPreviewName.textContent = matched.name;
    setupPreviewMembers.textContent = matched.members.length + ' members (local)';
    setupJoinPreview.style.display = 'block';
    return;
  }

  if (!database) return;
  database.collection('squads').where('code', '==', code).get()
    .then(function(snapshot) {
      if (snapshot.empty) {
        setupJoinPreview.style.display = 'none';
        return;
      }
      const data = snapshot.docs[0].data();
      setupPreviewName.textContent = data.name;
      setupPreviewMembers.textContent = (data.memberUids ? data.memberUids.length : 0) + ' members';
      setupJoinPreview.style.display = 'block';
    })
    .catch(function() {});
}

// ===== LOAD SQUAD DETAILS =====
function loadSquadDetails(id) {
  // Try loading from localStorage first as instant cache/offline fallback
  const localSquads = getLocalSquads();
  const localSquadObj = localSquads.find(s => s.id === id);

  if (localSquadObj) {
    renderSquadInfoDOM(localSquadObj);
  }

  // Then subscribe to live Firestore if database is available and it's not a local-only squad ID
  if (!database || id.startsWith('squad_') || id === 'mock-demo') {
    setupMockLeaveBtn(id, localSquadObj);
    return;
  }

  let detailsResolved = false;
  const detailsTimeout = setTimeout(function() {
    if (!detailsResolved) {
      console.warn("Firestore squad details timed out. Using cached details.");
      if (localSquadObj) {
        renderSquadInfoDOM(localSquadObj);
      } else {
        loadMockSquadDetails();
      }
    }
  }, 1500);

  unsubSquad = database.collection('squads').doc(id).onSnapshot(function(doc) {
    clearTimeout(detailsTimeout);
    detailsResolved = true;
    if (!doc.exists) return;
    const data = doc.data();
    const squadObj = { id: doc.id, ...data };
    saveLocalSquad(squadObj); // sync cache
    renderSquadInfoDOM(squadObj);
    setupRealLeaveBtn(id, squadObj);
  }, function(err) {
    clearTimeout(detailsTimeout);
    detailsResolved = true;
    console.error("Firestore onSnapshot error:", err);
  });
}

function renderSquadInfoDOM(squad) {
  currentSquadName = squad.name;
  squadNameEl.textContent = squad.name;
  const memberCount = squad.members ? squad.members.length : 1;
  currentSquadMemberCount = Math.max(1, memberCount);
  squadMetaEl.textContent = `${memberCount} members · Code: ${squad.code}`;
  
  const adminMember = squad.members ? squad.members.find(m => m.role === 'admin') : null;
  currentSquadAdminId = adminMember ? adminMember.uid : null;

  // PRIVACY LOCK
  if (currentUser && squad.id !== 'mock-demo') {
    const isMember = squad.members && squad.members.some(m => m.uid === currentUser.uid);
    if (!isMember) {
      document.getElementById('chatMainCol').style.display = 'none';
      document.getElementById('squadSetupScreen').style.display = 'flex';
      alert("You are not a member of this squad.");
      return;
    }
  }

  if (drawerNameEl) drawerNameEl.textContent = squad.name;
  const initials = squad.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  if (drawerBadgeEl) drawerBadgeEl.textContent = initials;
  if (drawerSubEl) {
    drawerSubEl.innerHTML = `Created by ${squad.createdByName || 'Admin'}`;
  }

  // Update invite code display
  const inviteCodeEl = document.getElementById('drawerInviteCode');
  if (inviteCodeEl) {
    const fullLink = window.location.origin + window.location.pathname + '?join=' + (squad.code || 'BMB-DEMO');
    inviteCodeEl.textContent = fullLink;
    inviteCodeEl.style.fontSize = '12px'; // Adjust font size for link
    inviteCodeEl.style.wordBreak = 'break-all';
  }

  // Wire up copy link button
  const copyCodeBtn = document.getElementById('drawerCopyCodeBtn');
  if (copyCodeBtn) {
    copyCodeBtn.onclick = function() {
      const shareLink = window.location.origin + window.location.pathname + '?join=' + squad.code;
      navigator.clipboard.writeText(shareLink).then(() => {
        copyCodeBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        setTimeout(() => {
          copyCodeBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy link`;
        }, 1800);
      }).catch(() => {
        prompt('Copy this invite link:', shareLink);
      });
    };
  }

  if (drawerMembersEl) {
    drawerMembersEl.innerHTML = '';
    if (squad.members) {
      squad.members.forEach(function(m) {
        const memberInitials = m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        
        // If user has a real profile pic, use it. Otherwise, use initials.
        const avatarContent = m.photoUrl 
          ? `<img src="${m.photoUrl}" alt="${m.name}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` 
          : memberInitials;

        const mRow = document.createElement('div');
        mRow.className = 'member-row';
        mRow.innerHTML = `
          <div class="av" style="padding:0; overflow:hidden;">${avatarContent}</div>
          <div>
            <span class="m-name">${escapeHtml(m.name)}</span>
            <span class="m-role">${m.role === 'admin' ? '👑 Admin' : 'Member'}</span>
          </div>
        `;
        drawerMembersEl.appendChild(mRow);
      });
    }
  }

  // Update Stats
  const statGames = document.getElementById('statGames');
  const statWins = document.getElementById('statWins');
  const statStreak = document.getElementById('statStreak');
  const stats = squad.stats || { games: 0, wins: 0, streak: 0 };
  
  if (statGames) statGames.textContent = stats.games;
  if (statWins) statWins.textContent = stats.wins;
  if (statStreak) statStreak.textContent = (stats.streak > 0 ? '🔥' : '') + stats.streak;

}

function setupMockLeaveBtn(id, localSquadObj) {
  if (leaveSquadBtn) {
    leaveSquadBtn.onclick = function() {
      if (confirm('Leave squad?')) {
        if (localSquadObj) {
          const squads = getLocalSquads().filter(s => s.id !== id);
          localStorage.setItem('bmb_squads', JSON.stringify(squads));
        }
        window.location.href = 'squad-chat.html';
      }
    };
  }
}

function setupRealLeaveBtn(id, data) {
  if (leaveSquadBtn) {
    if (currentUser && currentUser.uid === currentSquadAdminId) {
      leaveSquadBtn.textContent = 'Delete Squad Workspace';
      leaveSquadBtn.style.color = 'var(--red)';
      leaveSquadBtn.style.borderColor = 'var(--red)';
      leaveSquadBtn.onclick = function() {
        if (!confirm('Are you sure you want to permanently delete this squad workspace? This cannot be undone.')) return;
        database.collection('squads').doc(id).delete()
          .then(function() {
            const squads = getLocalSquads().filter(s => s.id !== id);
            localStorage.setItem('bmb_squads', JSON.stringify(squads));
            window.location.href = 'index.html';
          })
          .catch(function(err) {
            console.error(err);
          });
      };
    } else {
      leaveSquadBtn.textContent = 'Leave Squad';
      leaveSquadBtn.onclick = function() {
        if (!confirm('Leave "' + data.name + '"? You can rejoin with the invite link.')) return;
        const memberToRemove = data.members.find(m => m.uid === currentUser.uid);
        const updates = {
          memberUids: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        };
        if (memberToRemove) {
          updates.members = firebase.firestore.FieldValue.arrayRemove(memberToRemove);
        }
        database.collection('squads').doc(id).update(updates)
          .then(function() {
            // Remove local cache too
            const squads = getLocalSquads().filter(s => s.id !== id);
            localStorage.setItem('bmb_squads', JSON.stringify(squads));
            window.location.href = 'squad-chat.html';
          })
          .catch(function(err) {
            console.error(err);
          });
      };
    }
  }
}

function loadMockSquadDetails() {
  const dummySquad = {
    id: 'mock-demo',
    name: "Vanasthalipuram Strikers",
    code: "BMB-DEMO",
    members: [
      { name: "Arjun K.", role: "admin" },
      { name: "Rahul S.", role: "member" },
      { name: "Prateek M.", role: "member" },
      { name: "Vishal D.", role: "member" },
      { name: "Karthik R.", role: "member" },
      { name: "Sai T.", role: "member" }
    ]
  };
  renderSquadInfoDOM(dummySquad);
  setupMockLeaveBtn('mock-demo', null);
}

// ===== LOAD REAL-TIME MESSAGES =====
function triggerConfetti(x, y) {
  // Demo mock - real impl uses canvas
}

function loadVenuesForBooking() {
  const venueSelect = document.getElementById('bookVenue');
  if (!venueSelect || !database) return;

  database.collection('venues').orderBy('createdAt', 'desc').onSnapshot(
    snapshot => {
      venueSelect.innerHTML = '';
      if (snapshot.empty) {
        venueSelect.innerHTML = '<option value="" disabled selected>No venues available</option>';
        return;
      }
      
      snapshot.forEach(doc => {
        const v = doc.data();
        const opt = document.createElement('option');
        opt.value = doc.id;
        // Store extra data as data-attributes so we can access it when rendering the venue tab
        opt.dataset.googleLink = v.googleMapUrl || '';
        opt.dataset.contact = v.contactNumber || '';
        opt.dataset.whatsapp = v.whatsappNumber || '';
        opt.dataset.manager = v.manager || '';
        opt.dataset.rating = v.rating || '';
        opt.dataset.price = v.price || '';
        
        opt.textContent = `${v.name} (₹${v.price || 500}/hr)`;
        venueSelect.appendChild(opt);
      });
    },
    err => {
      console.error("Error loading venues", err);
      venueSelect.innerHTML = '<option value="" disabled selected>Error loading venues</option>';
    }
  );
}
// Try loading venues initially. If database isn't ready yet, it will fail silently.
// We can retry slightly delayed if database is still null
window.addEventListener('DOMContentLoaded', () => {
  const checkDb = setInterval(() => {
    if (database) {
      clearInterval(checkDb);
      loadVenuesForBooking();
      loadRecommendedVenues();
    }
  }, 500);
});

function loadRecommendedVenues() {
  const container = document.getElementById('recommendedVenuesContainer');
  if (!container || !database) return;
  
  database.collection('venues').limit(5).get().then(snapshot => {
    if (snapshot.empty) {
      container.innerHTML = '<div style="color:var(--text-dim); font-size:13px; text-align:center; padding:10px;">No venues found</div>';
      return;
    }
    
    container.innerHTML = '';
    snapshot.forEach(doc => {
      const v = doc.data();
      const defaultImg = 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=400';
      const imgUrl = (v.images && v.images.length > 0) ? v.images[0] : (v.image || defaultImg);
      
      const el = document.createElement('div');
      el.className = 'recommended-venue-card';
      el.style.cssText = 'background:var(--card); border:1px solid var(--card-line); border-radius:12px; overflow:hidden; margin-bottom:12px; display:flex; flex-direction:column;';
      
      el.innerHTML = `
        <div style="height:100px; background-image:url('${imgUrl}'); background-size:cover; background-position:center;"></div>
        <div style="padding:12px;">
          <div style="font-weight:800; font-size:14px; margin-bottom:4px;">${v.name}</div>
          <div style="font-size:12px; color:var(--text-dim); margin-bottom:12px;">📍 ${v.location} · ⭐ ${v.rating || '4.0'}</div>
          <button class="btn btn-lime" onclick="openBookingModalForVenue('${doc.id}')" style="width:100%; text-align:center; padding:8px; font-size:12px; font-weight:700;">Book Now (₹${v.price || 500}/hr)</button>
        </div>
      `;
      container.appendChild(el);
    });
  }).catch(err => {
    console.error("Error loading recommended venues", err);
    container.innerHTML = '<div style="color:var(--text-dim); font-size:13px; text-align:center; padding:10px;">Error loading venues</div>';
  });
}

window.openBookingModalForVenue = function(venueId) {
  const bookModal = document.getElementById('bookModal');
  const bookVenueSelect = document.getElementById('bookVenue');
  if (bookModal) {
    if (bookVenueSelect) {
      bookVenueSelect.value = venueId;
      if (typeof loadSquadBookingSlots === 'function') {
        loadSquadBookingSlots();
      }
    }
    bookModal.style.display = '';
    bookModal.classList.add('open');
  }
};

function loadMessages(id) {
  // Load from local storage first as instant load / offline fallback
  let localMsgs = getLocalMessages(id);
  if (!localMsgs) {
    if (id.startsWith('squad_') || id === 'mock-demo') {
      localMsgs = defaultSeedMessages;
      saveLocalMessages(id, defaultSeedMessages);
    }
  }

  if (localMsgs) {
    renderMessages(localMsgs);
  }

  // Subscribe to Firestore if possible and not a local-only squad ID
  if (!database || id.startsWith('squad_') || id === 'mock-demo') return;

  if (unsubMessages) unsubMessages();

  let messagesResolved = false;
  const messagesTimeout = setTimeout(function() {
    if (!messagesResolved) {
      console.warn("Firestore messages query timed out. Loading local messages fallback.");
      if (localMsgs) {
        renderMessages(localMsgs);
      } else {
        renderMessages(defaultSeedMessages);
      }
    }
  }, 1500);

  unsubMessages = database.collection('squads').doc(id).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(function(snapshot) {
      clearTimeout(messagesTimeout);
      messagesResolved = true;
      const messagesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      saveLocalMessages(id, messagesList); // sync cache
      renderMessages(messagesList);
    }, function(err) {
      clearTimeout(messagesTimeout);
      messagesResolved = true;
      console.error("Firestore onSnapshot messages error:", err);
    });
}

function renderMessages(messagesList) {
  if (!chatMessages) return;
  chatMessages.innerHTML = '<div class="date-divider"><span>Today</span></div>';

  messagesList.forEach(function(msg) {
    const msgDiv = document.createElement('div');
    const myUid = currentUser ? currentUser.uid : 'me';
    const isMe = (currentUser && msg.senderUid === currentUser.uid) || msg.senderUid === 'me';
    const isAdmin = (currentSquadAdminId === myUid) || myUid === 'me';
    const canDelete = isMe || isAdmin;

    msgDiv.className = isMe ? 'msg msg-out' : 'msg msg-in';

    const initials = msg.senderName ? msg.senderName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';
    
    let timeStr = 'Just now';
    if (msg.timestamp) {
      const date = msg.timestamp.seconds ? new Date(msg.timestamp.seconds * 1000) : new Date(msg.timestamp);
      timeStr = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
    }
    
    const deleteBtnHtml = canDelete ? `<span class="msg-delete" onclick="deleteMessage('${msg.id}')" style="cursor:pointer; margin-left:8px; opacity:0.6; font-size:12px;">🗑️</span>` : '';

    if (msg.type === 'poll') {
      msgDiv.innerHTML = `
        ${isMe ? '' : `<div class="msg-avatar">${initials}</div>`}
        <div class="msg-content">
          ${isMe ? '' : `<span class="msg-sender">${escapeHtml(msg.senderName)}</span>`}
          <div class="poll-card" data-poll-id="${msg.id}">
            <div class="poll-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>
              <span>POLL</span>
            </div>
            <div class="poll-question">${escapeHtml(msg.text)}</div>
            ${msg.options.map((opt, index) => {
              const votes = msg.votes && msg.votes[index] ? msg.votes[index].length : 0;
              const totalVotes = msg.votes ? Object.values(msg.votes).flat().length : 0;
              const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              const hasVoted = msg.votes && msg.votes[index] && msg.votes[index].includes(myUid);

              return `
                <div class="poll-option ${hasVoted ? 'selected' : ''}" onclick="votePoll('${msg.id}', ${index})">
                  <div class="poll-option-info">
                    <span class="poll-dot ${hasVoted ? 'active' : ''}"></span> ${escapeHtml(opt)}
                  </div>
                  <div class="poll-votes-bar"><div class="poll-fill" style="width:${percent}%"></div></div>
                  <span class="poll-count">${votes} votes</span>
                </div>
              `;
            }).join('')}
            <div class="poll-footer">Click an option to vote</div>
          </div>
          <span class="msg-time">${timeStr}${deleteBtnHtml}</span>
        </div>
      `;
    } else if (msg.type === 'booking') {
      const yesVotes = msg.yesVotes ? msg.yesVotes.length : 0;
      const noVotes = msg.noVotes ? msg.noVotes.length : 0;
      const votedYes = msg.yesVotes && msg.yesVotes.includes(myUid);
      const votedNo = msg.noVotes && msg.noVotes.includes(myUid);
      const canFinalize = yesVotes > (currentSquadMemberCount / 2);
      
      let buttonsHtml = '';
      if (msg.isFullyBooked) {
        buttonsHtml = `<button class="btn btn-lime booking-btn" style="background:var(--lime);color:#0B1210;" disabled>Fully Booked ✅</button>`;
      } else {
        buttonsHtml = `
          <div style="display:flex; gap:8px; margin-bottom: 8px;">
            <button class="btn btn-outline" style="flex:1; padding:6px; border-color: ${votedYes ? 'var(--lime)' : 'var(--card-line)'}; color: ${votedYes ? 'var(--lime)' : 'var(--text)'};" onclick="voteBooking('${msg.id}', 'yes')">Yes (${yesVotes})</button>
            <button class="btn btn-outline" style="flex:1; padding:6px; border-color: ${votedNo ? 'var(--red)' : 'var(--card-line)'}; color: ${votedNo ? 'var(--red)' : 'var(--text)'};" onclick="voteBooking('${msg.id}', 'no')">No (${noVotes})</button>
          </div>
          ${isAdmin ? `<button class="btn btn-lime booking-btn" onclick="finalizeBooking('${msg.id}')" ${canFinalize ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>Finalize Booking</button>` : ''}
        `;
      }

      msgDiv.innerHTML = `
        ${isMe ? '' : `<div class="msg-avatar">${initials}</div>`}
        <div class="msg-content">
          ${isMe ? '' : `<span class="msg-sender">${escapeHtml(msg.senderName)}</span>`}
          <div class="booking-card">
            <div class="booking-badge">🏟️ SQUAD BOOKING</div>
            <h4>${escapeHtml(msg.venue)}</h4>
            <div class="booking-details">
              <div class="booking-row"><span class="booking-label">Date</span><span>${escapeHtml(msg.date)}</span></div>
              <div class="booking-row"><span class="booking-label">Time</span><span>${escapeHtml(msg.time)}</span></div>
              <div class="booking-row"><span class="booking-label">Per person</span><span class="lime-text">₹${msg.splitPrice}</span></div>
              <div class="booking-row"><span class="booking-label">Total</span><span class="lime-text">₹${msg.totalPrice}</span></div>
            </div>
            ${buttonsHtml}
          </div>
          <span class="msg-time">${timeStr}${deleteBtnHtml}</span>
        </div>
      `;
    } else {
      msgDiv.innerHTML = `
        ${isMe ? '' : `<div class="msg-avatar">${initials}</div>`}
        <div class="msg-content">
          ${isMe ? '' : `<span class="msg-sender">${escapeHtml(msg.senderName)}</span>`}
          <div class="msg-bubble">${escapeHtml(msg.text)}</div>
          <span class="msg-time">${timeStr}${deleteBtnHtml}</span>
        </div>
      `;
    }

    chatMessages.appendChild(msgDiv);
  });

  // Find latest booking to update Venue tab and context bar
  const latestBooking = [...msgs].reverse().find(m => m.type === 'booking');
  if (latestBooking) {
    updateBookingContext(latestBooking);
    updateVenueTab(latestBooking.venueId);
  }

  scrollToBottom();
}

function updateBookingContext(msg) {
  const bar = document.getElementById('bookingContextBar');
  const text = document.getElementById('bookingContextText');
  if (bar && text) {
    bar.style.display = 'flex';
    text.textContent = `${msg.venue} · ${msg.date} ${msg.time} · ₹${msg.splitPrice}/person`;
  }
}

function updateVenueTab(venueId) {
  if (!venueId) return;
  const venueSelect = document.getElementById('bookVenue');
  if (!venueSelect) return;
  const opt = Array.from(venueSelect.options).find(o => o.value === venueId);
  if (!opt) return;

  const vName = opt.text.split(' (')[0];
  const vMap = opt.dataset.googleLink || '#';
  const vContact = opt.dataset.contact || 'N/A';
  const vWhatsapp = opt.dataset.whatsapp || '';
  const vManager = opt.dataset.manager || 'Manager';
  const vRating = opt.dataset.rating || 'N/A';
  
  const vTabName = document.getElementById('venueTabName');
  const vTabSub = document.getElementById('venueTabSub');
  const vTabAddress = document.getElementById('venueTabAddress');
  const vTabContact = document.getElementById('venueTabContact');
  const vTabHours = document.getElementById('venueTabHours');
  const waBtn = document.getElementById('venueWhatsAppBtn');

  if (vTabName) vTabName.textContent = vName;
  if (vTabSub) vTabSub.textContent = `${vRating} · Manager: ${vManager} · Typically <10 min`;
  
  if (vTabAddress) {
    vTabAddress.innerHTML = vMap !== '#' 
      ? `<a href="${vMap}" target="_blank" style="color:var(--cyan);text-decoration:underline;">View on Map</a>` 
      : 'N/A';
  }
  if (vTabContact) vTabContact.textContent = vContact;
  
  if (waBtn && vWhatsapp) {
    const waMsg = encodeURIComponent(`Hi, I have a booking at ${vName} via Book My Box. Can you help?`);
    waBtn.href = `https://wa.me/${vWhatsapp}?text=${waMsg}`;
    waBtn.style.display = 'flex';
  } else if (waBtn) {
    waBtn.style.display = 'none';
  }
}

// ===== SEND MESSAGE =====
function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  if (database && squadId && currentUser && !squadId.startsWith('squad_') && squadId !== 'mock-demo') {
    database.collection('squads').doc(squadId).collection('messages').add({
      text: text,
      senderUid: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email || 'Player',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      type: 'text'
    }).then(function() {
      msgInput.value = '';
    });
  } else {
    // Send in mock local storage mode
    const localMsgs = getLocalMessages(squadId) || [];
    localMsgs.push({
      id: "mock_" + Date.now(),
      type: "text",
      senderName: "Me",
      senderUid: "me",
      text: text,
      timestamp: new Date().toISOString()
    });
    saveLocalMessages(squadId, localMsgs);
    msgInput.value = '';
    renderMessages(localMsgs);
  }
}

if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (msgInput) {
  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// ===== IN-WEBSITE CUSTOM MODALS =====
const customPollModal = document.getElementById('pollModal');
const customBookModal = document.getElementById('bookModal');
const customCreateModal = document.getElementById('createModal');
const customJoinModal = document.getElementById('joinModal');

const createPollForm = document.getElementById('createPollForm');
const createBookingForm = document.getElementById('createBookingForm');

const closePollModal = document.getElementById('closePollModal');
const closeBookModal = document.getElementById('closeBookModal');
const closeCreateModal = document.getElementById('closeCreateModal');
const closeJoinModal = document.getElementById('closeJoinModal');


function openModal(el) { if (el) el.classList.add('open'); }
function closeModal(el) { if (el) el.classList.remove('open'); }

if (closePollModal) closePollModal.addEventListener('click', () => closeModal(customPollModal));
if (closeBookModal) closeBookModal.addEventListener('click', () => closeModal(customBookModal));
if (closeCreateModal) closeCreateModal.addEventListener('click', () => closeModal(customCreateModal));
if (closeJoinModal) closeJoinModal.addEventListener('click', () => closeModal(customJoinModal));

// Auto-open create squad modal if action=create query parameter is present
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'create') {
    setTimeout(() => {
      openModal(customCreateModal);
    }, 300);
  }
});


// Close modals on overlay click
[customPollModal, customBookModal, customCreateModal, customJoinModal].forEach(modal => {
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeModal(modal);
    });
  }
});

// ===== POLL CREATION (MODAL FORM SUBMISSION) =====
const pollBtn = document.getElementById('pollBtn');
if (pollBtn) {
  pollBtn.addEventListener('click', () => openModal(customPollModal));
}

if (createPollForm) {
  createPollForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const question = document.getElementById('pollQuestion').value.trim();
    const opt1 = document.getElementById('pollOpt1').value.trim();
    const opt2 = document.getElementById('pollOpt2').value.trim();

    if (!question || !opt1 || !opt2) return;

    if (database && squadId && currentUser && !squadId.startsWith('squad_') && squadId !== 'mock-demo') {
      database.collection('squads').doc(squadId).collection('messages').add({
        text: question,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Player',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'poll',
        options: [opt1, opt2],
        votes: {
          0: [],
          1: []
        }
      }).then(() => {
        closeModal(customPollModal);
        createPollForm.reset();
        document.getElementById('pollOpt1').value = '7:00 PM';
        document.getElementById('pollOpt2').value = '8:00 PM';
      });
    } else {
      // Local storage mode
      const localMsgs = getLocalMessages(squadId) || [];
      localMsgs.push({
        id: "mock_" + Date.now(),
        type: "poll",
        senderName: "Me",
        senderUid: "me",
        text: question,
        options: [opt1, opt2],
        votes: { 0: [], 1: [] },
        timestamp: new Date().toISOString()
      });
      saveLocalMessages(squadId, localMsgs);
      closeModal(customPollModal);
      createPollForm.reset();
      document.getElementById('pollOpt1').value = '7:00 PM';
      document.getElementById('pollOpt2').value = '8:00 PM';
      renderMessages(localMsgs);
    }
  });
}

// ===== BOOKING CREATION (MODAL FORM SUBMISSION) =====
const bookBtn = document.getElementById('bookBtn');
if (bookBtn) {
  bookBtn.addEventListener('click', () => openModal(customBookModal));
}

let selectedSquadBookingSlots = [];
let currentSquadBookingPrice = 500;

function loadSquadBookingSlots() {
  const venueId = document.getElementById('bookVenue').value;
  const dateStr = document.getElementById('bookDate').value;
  const slotsContainer = document.getElementById('bookSlotsContainer');
  const placeholder = document.getElementById('bookSlotsPlaceholder');
  
  if (!venueId || !dateStr) {
    if (placeholder) placeholder.style.display = 'block';
    if (slotsContainer) slotsContainer.style.display = 'none';
    return;
  }
  
  if (placeholder) placeholder.style.display = 'none';
  if (slotsContainer) slotsContainer.style.display = 'flex';
  
  slotsContainer.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:8px;">Loading slots...</div>';
  
  if (!database) return;
  
  database.collection('venues').doc(venueId).get().then(doc => {
    if (!doc.exists) return;
    const v = doc.data();
    currentSquadBookingPrice = v.price || 500;
    
    let allSlots = ['6:00 AM — 7:00 AM', '7:00 AM — 8:00 AM', '8:00 AM — 9:00 AM', '9:00 AM — 10:00 AM', '4:00 PM — 5:00 PM', '5:00 PM — 6:00 PM', '6:00 PM — 7:00 PM', '7:00 PM — 8:00 PM', '8:00 PM — 9:00 PM'];
    if (v.operatingHoursList && v.operatingHoursList.length > 0) {
      allSlots = v.operatingHoursList;
    }
    
    database.collection('venues').doc(venueId).collection('slots').where('date', '==', dateStr).get().then(snap => {
      let booked = [];
      snap.forEach(s => booked.push(s.data().time));
      
      selectedSquadBookingSlots = [];
      updateSquadBookingCost();
      
      slotsContainer.innerHTML = '';
      allSlots.forEach(slot => {
        const isBooked = booked.includes(slot);
        const div = document.createElement('div');
        div.style.cssText = `padding: 10px; border-radius: 8px; border: 1px solid var(--card-line); background: ${isBooked ? 'var(--bg)' : 'var(--card)'}; color: ${isBooked ? 'var(--text-dim)' : 'var(--text)'}; cursor: ${isBooked ? 'not-allowed' : 'pointer'}; display: flex; justify-content: space-between; align-items: center; user-select: none; transition: all 0.2s ease;`;
        
        const label = document.createElement('span');
        label.textContent = slot;
        div.appendChild(label);
        
        if (isBooked) {
          const badge = document.createElement('span');
          badge.textContent = 'Booked';
          badge.style.cssText = 'font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;';
          div.appendChild(badge);
        } else {
          div.addEventListener('click', () => {
            if (selectedSquadBookingSlots.includes(slot)) {
              selectedSquadBookingSlots = selectedSquadBookingSlots.filter(s => s !== slot);
              div.style.background = 'var(--card)';
              div.style.borderColor = 'var(--card-line)';
            } else {
              selectedSquadBookingSlots.push(slot);
              div.style.background = 'rgba(61,232,255,0.1)';
              div.style.borderColor = 'var(--cyan)';
            }
            updateSquadBookingCost();
          });
        }
        slotsContainer.appendChild(div);
      });
      
      if (allSlots.length === 0) {
        slotsContainer.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:8px;">No slots available</div>';
      }
    });
  });
}

function updateSquadBookingCost() {
  const total = selectedSquadBookingSlots.length * currentSquadBookingPrice;
  const split = total / currentSquadMemberCount;
  document.getElementById('bookTotal').value = total;
  document.getElementById('bookSplit').value = Math.ceil(split);
}

const bookVenueEl = document.getElementById('bookVenue');
const bookDateEl = document.getElementById('bookDate');
if (bookVenueEl) bookVenueEl.addEventListener('change', loadSquadBookingSlots);
if (bookDateEl) bookDateEl.addEventListener('change', loadSquadBookingSlots);

if (createBookingForm) {
  createBookingForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const venueSelect = document.getElementById('bookVenue');
    const venueName = venueSelect.options[venueSelect.selectedIndex]?.text || '';
    const venueId = venueSelect.value;
    const date = document.getElementById('bookDate').value.trim();
    
    if (selectedSquadBookingSlots.length === 0) {
      alert("Please select at least one time slot.");
      return;
    }
    const time = selectedSquadBookingSlots.join(', ');
    const total = document.getElementById('bookTotal').value.trim();
    const split = document.getElementById('bookSplit').value.trim();

    if (!venueName || !date || !time || !total || !split) return;

    if (database && squadId && currentUser && !squadId.startsWith('squad_') && squadId !== 'mock-demo') {
      database.collection('squads').doc(squadId).collection('messages').add({
        venue: venueName,
        venueId: venueId,
        date: date,
        time: time,
        totalPrice: total,
        splitPrice: split,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Player',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'booking',
        yesVotes: [],
        noVotes: [],
        selectedSlots: selectedSquadBookingSlots
      }).then(() => {
        database.collection('squads').doc(squadId).update({
          'stats.games': firebase.firestore.FieldValue.increment(1)
        });
        database.collection('users').doc(currentUser.uid).update({
          'matches': firebase.firestore.FieldValue.increment(1)
        });
        closeModal(customBookModal);
        createBookingForm.reset();
        document.getElementById('bookDate').value = '';
        selectedSquadBookingSlots = [];
        updateSquadBookingCost();
        document.getElementById('bookSlotsContainer').innerHTML = '';
        document.getElementById('bookSlotsContainer').style.display = 'none';
        document.getElementById('bookSlotsPlaceholder').style.display = 'block';
      });
    } else {
      // Local storage mode
      const localMsgs = getLocalMessages(squadId) || [];
      localMsgs.push({
        id: "mock_" + Date.now(),
        type: "booking",
        senderName: "Me",
        senderUid: "me",
        venue: venueName,
        venueId: venueId,
        date: date,
        time: time,
        totalPrice: total,
        splitPrice: split,
        yesVotes: ["me"],
        noVotes: [],
        selectedSlots: selectedSquadBookingSlots,
        timestamp: new Date().toISOString()
      });
      saveLocalMessages(squadId, localMsgs);
      
      const squads = getLocalSquads();
      const sqIndex = squads.findIndex(s => s.id === squadId);
      if (sqIndex > -1) {
        if (!squads[sqIndex].stats) squads[sqIndex].stats = { games: 0, wins: 0, streak: 0 };
        squads[sqIndex].stats.games++;
        localStorage.setItem('bmb_squads', JSON.stringify(squads));
      }

      renderMessages(localMsgs);
      scrollToBottom();
      closeModal(customBookModal);
      createBookingForm.reset();
      document.getElementById('bookDate').value = '';
      selectedSquadBookingSlots = [];
      updateSquadBookingCost();
      document.getElementById('bookSlotsContainer').innerHTML = '';
      document.getElementById('bookSlotsContainer').style.display = 'none';
      document.getElementById('bookSlotsPlaceholder').style.display = 'block';
      renderMessages(localMsgs);
    }
  });
}

// ===== POLL VOTE TRANSACTION =====
window.votePoll = function(msgId, optIndex) {
  if (database && squadId && currentUser && !squadId.startsWith('squad_') && squadId !== 'mock-demo') {
    const msgRef = database.collection('squads').doc(squadId).collection('messages').doc(msgId);
    database.runTransaction(function(transaction) {
      return transaction.get(msgRef).then(function(doc) {
        if (!doc.exists) return;
        const data = doc.data();
        const votes = data.votes || { 0: [], 1: [] };

        Object.keys(votes).forEach(key => {
          votes[key] = votes[key].filter(uid => uid !== currentUser.uid);
        });

        if (!votes[optIndex]) votes[optIndex] = [];
        votes[optIndex].push(currentUser.uid);

        transaction.update(msgRef, { votes: votes });
      });
    });
  } else {
    // Local storage vote
    const localMsgs = getLocalMessages(squadId);
    if (localMsgs) {
      const msg = localMsgs.find(m => m.id === msgId);
      if (msg && msg.type === 'poll') {
        const myId = currentUser ? currentUser.uid : 'me';
        Object.keys(msg.votes).forEach(key => {
          msg.votes[key] = msg.votes[key].filter(uid => uid !== myId);
        });
        if (!msg.votes[optIndex]) msg.votes[optIndex] = [];
        msg.votes[optIndex].push(myId);
        saveLocalMessages(squadId, localMsgs);
        renderMessages(localMsgs);
      }
    }
  }
};

// ===== BOOKING VOTING TRANSACTION =====
window.voteBooking = function(msgId, voteType) {
  if (database && squadId && currentUser && !squadId.startsWith('squad_') && squadId !== 'mock-demo') {
    const msgRef = database.collection('squads').doc(squadId).collection('messages').doc(msgId);
    database.runTransaction(function(transaction) {
      return transaction.get(msgRef).then(function(doc) {
        if (!doc.exists) return;
        const data = doc.data();
        if (data.isFullyBooked) return;
        
        let yesVotes = data.yesVotes || [];
        let noVotes = data.noVotes || [];

        // Remove from both first
        yesVotes = yesVotes.filter(uid => uid !== currentUser.uid);
        noVotes = noVotes.filter(uid => uid !== currentUser.uid);

        if (voteType === 'yes') {
          yesVotes.push(currentUser.uid);
        } else if (voteType === 'no') {
          noVotes.push(currentUser.uid);
        }

        transaction.update(msgRef, { yesVotes, noVotes });
      });
    });
  } else {
    // Local storage vote
    const localMsgs = getLocalMessages(squadId);
    if (localMsgs) {
      const msg = localMsgs.find(m => m.id === msgId);
      if (msg && msg.type === 'booking' && !msg.isFullyBooked) {
        const myId = currentUser ? currentUser.uid : 'me';
        if (!msg.yesVotes) msg.yesVotes = [];
        if (!msg.noVotes) msg.noVotes = [];
        
        msg.yesVotes = msg.yesVotes.filter(uid => uid !== myId);
        msg.noVotes = msg.noVotes.filter(uid => uid !== myId);
        
        if (voteType === 'yes') msg.yesVotes.push(myId);
        else if (voteType === 'no') msg.noVotes.push(myId);
        
        saveLocalMessages(squadId, localMsgs);
        renderMessages(localMsgs);
      }
    }
  }
};

// ===== FINALIZE BOOKING (ADMIN ONLY) =====
window.finalizeBooking = function(msgId) {
  if (database && squadId && currentUser && !squadId.startsWith('squad_') && squadId !== 'mock-demo') {
    const msgRef = database.collection('squads').doc(squadId).collection('messages').doc(msgId);
    let triggerAutoBook = false;
    let bookingData = null;
    
    database.runTransaction(function(transaction) {
      return transaction.get(msgRef).then(function(doc) {
        if (!doc.exists) return;
        const data = doc.data();
        if (data.isFullyBooked) return;
        
        // Security check (UI already hides it, but extra safety)
        if (currentSquadAdminId && currentSquadAdminId !== currentUser.uid) return;
        
        bookingData = data;
      });
    }).then(() => {
      if (!bookingData) return;
      
      const proceedWithBooking = () => {
        const msgRef = database.collection('squads').doc(squadId).collection('messages').doc(msgId);
        database.runTransaction(t => {
          return t.get(msgRef).then(d => {
            t.update(msgRef, { isFullyBooked: true });
          });
        }).then(() => {
          if (bookingData.selectedSlots) {
            const batch = database.batch();
            bookingData.selectedSlots.forEach(slotTime => {
              const slotRef = database.collection('venues').doc(bookingData.venueId).collection('slots').doc();
              batch.set(slotRef, {
                date: bookingData.date,
                time: slotTime,
                status: 'booked',
                squadId: squadId,
                bookedBy: bookingData.senderUid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
              });
            });
            batch.commit().then(() => {
              console.log("Admin finalized auto-booking successful for slots:", bookingData.selectedSlots);
            }).catch(err => console.error("Auto-booking failed", err));
          }
        });
      };

      if (typeof window.processRazorpayPayment === 'function') {
        const amount = parseInt(bookingData.totalPrice, 10);
        window.processRazorpayPayment(amount, `Squad Booking at ${bookingData.venue}`, (paymentId) => {
          proceedWithBooking();
        });
      } else {
        proceedWithBooking();
      }
    });
  } else {
    // Local storage
    const localMsgs = getLocalMessages(squadId);
    if (localMsgs) {
      const msg = localMsgs.find(m => m.id === msgId);
      if (msg && msg.type === 'booking' && !msg.isFullyBooked) {
        msg.isFullyBooked = true;
        saveLocalMessages(squadId, localMsgs);
        renderMessages(localMsgs);
      }
    }
  }
};

// Error feedback helper
function showSetupError(form, message) {
  const existing = form.querySelector('.setup-error');
  if (existing) existing.remove();

  const err = document.createElement('div');
  err.className = 'setup-error';
  err.textContent = message;
  form.prepend(err);
  setTimeout(() => err.remove(), 4000);
}

// Escape HTML helper
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ===== DELETE MESSAGE =====
window.deleteMessage = function(msgId) {
  if (!confirm('Are you sure you want to delete this message?')) return;
  if (database && squadId && currentUser && !squadId.startsWith('squad_') && squadId !== 'mock-demo') {
    database.collection('squads').doc(squadId).collection('messages').doc(msgId).delete()
      .then(() => console.log('Message deleted'))
      .catch(err => console.error('Error deleting message:', err));
  } else {
    // Local storage
    let localMsgs = getLocalMessages(squadId);
    if (localMsgs) {
      localMsgs = localMsgs.filter(m => m.id !== msgId);
      saveLocalMessages(squadId, localMsgs);
      renderMessages(localMsgs);
    }
  }
};
