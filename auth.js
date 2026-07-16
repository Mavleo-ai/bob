// Auth Pages — Firebase Authentication
// Expects firebase-config.js to be loaded before this file (provides `auth` global)

// ===== PASSWORD VISIBILITY TOGGLE =====
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.input-with-toggle').querySelector('input');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
});

// ===== PASSWORD STRENGTH METER (Sign Up only) =====
const pwInput = document.getElementById('passwordSignup');
const pwFill = document.getElementById('pwFill');
const pwLabel = document.getElementById('pwLabel');

if (pwInput && pwFill && pwLabel) {
  pwInput.addEventListener('input', () => {
    const val = pwInput.value;
    let strength = 0;
    if (val.length >= 8) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;

    pwFill.className = 'pw-fill';
    if (val.length === 0) {
      pwLabel.textContent = '';
      pwFill.style.width = '0%';
    } else if (strength <= 1) {
      pwFill.classList.add('weak');
      pwLabel.textContent = 'Weak';
      pwLabel.style.color = 'var(--red)';
    } else if (strength <= 2) {
      pwFill.classList.add('medium');
      pwLabel.textContent = 'Medium';
      pwLabel.style.color = '#FFA500';
    } else {
      pwFill.classList.add('strong');
      pwLabel.textContent = 'Strong';
      pwLabel.style.color = 'var(--lime)';
    }
  });
}

// ===== ERROR DISPLAY HELPER =====
function showError(form, message) {
  // Remove existing error
  const existing = form.querySelector('.auth-error');
  if (existing) existing.remove();

  const errorDiv = document.createElement('div');
  errorDiv.className = 'auth-error';
  errorDiv.textContent = message;
  form.prepend(errorDiv);

  // Auto-dismiss after 5s
  setTimeout(() => errorDiv.remove(), 5000);
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Try again.',
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

function setButtonLoading(btn, loading, originalText) {
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = originalText || 'Loading...';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';
  } else {
    btn.textContent = btn.dataset.originalText || 'Submit';
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }
}


// ===== SIGN IN — Email/Password =====
const signinForm = document.getElementById('signinForm');
if (signinForm) {
  signinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = signinForm.querySelector('.btn-lime');

    setButtonLoading(btn, true, 'Signing in...');

    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        window.location.href = 'index.html';
      })
      .catch((error) => {
        setButtonLoading(btn, false);
        showError(signinForm, friendlyError(error.code));
      });
  });
}


// ===== SIGN UP — Email/Password =====
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('emailSignup').value.trim();
    const phoneInput = document.getElementById('phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const password = document.getElementById('passwordSignup').value;
    const btn = signupForm.querySelector('.btn-lime');

    // Get referral code (manual input OR URL parameter fallback)
    const manualInput = document.getElementById('referralCode');
    const manualCode = manualInput ? manualInput.value.trim().toUpperCase() : '';
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('ref') ? urlParams.get('ref').trim().toUpperCase() : '';
    const finalRefCode = manualCode || urlCode;

    setButtonLoading(btn, true, 'Creating account...');

    let newUser = null;

    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        newUser = userCredential.user;
        // Update profile with display name
        return newUser.updateProfile({
          displayName: `${firstName} ${lastName}`
        });
      })
      .then(() => {
        // Generate a unique referral code for this user
        const db = firebase.firestore();
        const refCode = firstName.substring(0,3).toUpperCase() + Math.random().toString(36).substring(2,6).toUpperCase();
        
        return db.collection('users').doc(newUser.uid).set({
          name: `${firstName} ${lastName}`,
          email: email,
          phone: phone,
          referral_code: refCode,
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      })
      .then(() => {
        if (finalRefCode) {
          const lowerCode = finalRefCode.toLowerCase();
          if (lowerCode === 'bookmybox2026admin' || lowerCode === 'boxowner') {
            return Promise.resolve();
          }

          const db = firebase.firestore();
          // Find the user who owns this referral code
          return db.collection('users').where('referral_code', '==', finalRefCode).limit(1).get()
            .then(snapshot => {
              if (!snapshot.empty) {
                const referrerDoc = snapshot.docs[0];
                const referrerId = referrerDoc.id;
                const referrerData = referrerDoc.data();
                
                // Prevent self-referral
                if (referrerId === newUser.uid || referrerData.email === email || (phone && referrerData.phone === phone)) {
                  console.warn("Self-referral blocked: email/phone match.");
                  return;
                }
                
                // Check if a click tracker exists in localStorage
                const storedRef = localStorage.getItem('bmb_referred_by');
                let trackerId = null;
                if (storedRef) {
                  try {
                    const parsed = JSON.parse(storedRef);
                    if (parsed.code === finalRefCode) {
                      trackerId = parsed.tracker_id;
                    }
                  } catch (e) {}
                }
                
                if (trackerId) {
                  // Move click tracker status from clicked -> signed_up
                  return db.collection('referrals').doc(trackerId).set({
                    referred_user_id: newUser.uid,
                    status: 'signed_up',
                    signed_up_at: firebase.firestore.FieldValue.serverTimestamp()
                  }, { merge: true }).then(() => {
                    localStorage.removeItem('bmb_referred_by');
                  });
                } else {
                  // Direct manual code entry, create clean signed_up doc
                  return db.collection('referrals').add({
                    referrer_user_id: referrerId,
                    referred_user_id: newUser.uid,
                    status: 'signed_up',
                    signed_up_at: firebase.firestore.FieldValue.serverTimestamp()
                  });
                }
              }
            });
        }
      })
      .then(() => {
        if (finalRefCode && finalRefCode.toLowerCase() === 'bookmybox2026admin') {
          window.location.href = 'admin.html';
        } else if (finalRefCode && finalRefCode.toLowerCase() === 'boxowner') {
          window.location.href = 'box-panel.html';
        } else {
          window.location.href = 'index.html';
        }
      })
      .catch((error) => {
        setButtonLoading(btn, false);
        showError(signupForm, friendlyError(error.code));
      });
  });
}


// ===== GOOGLE SIGN IN =====
document.querySelectorAll('.btn-social').forEach(btn => {
  const text = btn.textContent.trim();

  if (text === 'Google') {
    btn.addEventListener('click', () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider)
        .then(() => {
          window.location.href = 'index.html';
        })
        .catch((error) => {
          const form = document.querySelector('.auth-form');
          showError(form, friendlyError(error.code));
        });
    });
  }

  // Apple Sign In
  if (text === 'Apple') {
    btn.addEventListener('click', () => {
      const provider = new firebase.auth.OAuthProvider('apple.com');
      auth.signInWithPopup(provider)
        .then(() => {
          window.location.href = 'index.html';
        })
        .catch((error) => {
          const form = document.querySelector('.auth-form');
          showError(form, friendlyError(error.code));
        });
    });
  }
});
