'use strict';

const urlParams = new URLSearchParams(window.location.search);
const venueId = urlParams.get('id');

const loadingVenue = document.getElementById('loadingVenue');
const venueContainer = document.getElementById('venueContainer');

const vHeroMain = document.getElementById('vHeroMain');
const vHeroSub1 = document.getElementById('vHeroSub1');
const vHeroSub2 = document.getElementById('vHeroSub2');
const vFeatures = document.getElementById('vFeatures');
const vAboutText = document.getElementById('vAboutText');
const vTitle = document.getElementById('vTitle');
const vLoc = document.getElementById('vLoc');
const vRating = document.getElementById('vRating');
const vHours = document.getElementById('vHours');
const vPriceBadge = document.getElementById('vPriceBadge');
const vReviews = document.getElementById('vReviews');

const slotsGrid = document.getElementById('slotsGrid');

let currentVenue = null;
let selectedSlots = [];
let userWalletBalance = 0;
let userSubscriptionType = null;
let userHomeBoxId = null;

function getEffectivePrice(basePrice) {
  let p = basePrice || 500;
  if (userSubscriptionType === 'promax') return Math.max(0, p - 50);
  if (userSubscriptionType === 'pro' && userHomeBoxId === venueId) return Math.max(0, p - 50);
  return p;
}

function updatePriceBadgeUI() {
  if (!document.getElementById('vPriceBadge') || !currentVenue) return;
  const p = currentVenue.price || 500;
  const eff = getEffectivePrice(p);
  const badge = document.getElementById('vPriceBadge');
  if (eff < p) {
    badge.innerHTML = `₹${p}/hr &middot; <span style="color:var(--lime);">₹${eff} for you</span>`;
  } else {
    badge.innerHTML = `₹${p}/hr`;
  }
}

const authInterval = setInterval(() => {
  if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
    clearInterval(authInterval);
    auth.onAuthStateChanged(async (user) => {
      if (user && typeof db !== 'undefined') {
        const udoc = await db.collection('users').doc(user.uid).get();
        if (udoc.exists) {
          const data = udoc.data();
          userWalletBalance = data.wallet || 0;
          if (data.hasSubscription) {
            userSubscriptionType = data.subscriptionType || 'promax';
            userHomeBoxId = data.homeBoxId || null;
          } else {
            userSubscriptionType = null;
            userHomeBoxId = null;
          }
        }
        updatePriceBadgeUI();
        if (typeof updateBookingSummaryUI === 'function') updateBookingSummaryUI();
      } else {
        userWalletBalance = 0;
        userSubscriptionType = null;
        userHomeBoxId = null;
        updatePriceBadgeUI();
        if (typeof updateBookingSummaryUI === 'function') updateBookingSummaryUI();
      }
    });
  }
}, 500);

if (!venueId) {
  loadingVenue.textContent = 'Venue not found.';
} else {
  const dbInterval = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      clearInterval(dbInterval);
      loadVenueDetails();
    }
  }, 500);
}

async function loadVenueDetails() {
  try {
    const doc = await db.collection('venues').doc(venueId).get();
    if (!doc.exists) {
      loadingVenue.textContent = 'Venue not found.';
      return;
    }
    currentVenue = doc.data();
    currentVenue.id = doc.id;

    loadingVenue.style.display = 'none';
    venueContainer.style.display = 'block';

    vTitle.textContent = currentVenue.name;
    vLoc.textContent = currentVenue.location;
    vRating.textContent = currentVenue.rating || '4.4';
    if (vReviews) vReviews.textContent = `(${currentVenue.reviews || 24} reviews)`;
    if (vPriceBadge) {
      updatePriceBadgeUI();
    }
    
    let images = currentVenue.images;
    if (!images || images.length === 0) {
      images = currentVenue.image ? [currentVenue.image] : [];
    }
    
    const mainImg = images[0] || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=1200';
    const sub1Img = images[1] || 'https://images.unsplash.com/photo-1518605368461-1e1e114bc446?w=800';
    const sub2Img = images[2] || 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800';
    
    if (vHeroMain) vHeroMain.style.backgroundImage = `url('${mainImg}')`;
    if (vHeroSub1) vHeroSub1.style.backgroundImage = `url('${sub1Img}')`;
    if (vHeroSub2) vHeroSub2.style.backgroundImage = `url('${sub2Img}')`;
    
    const extraCount = images.length - 3;
    if (extraCount > 0) {
      if (vHeroSub2) {
        vHeroSub2.innerHTML = `<span style="color: #fff; font-weight: 700; font-size: 14px;">+${extraCount} photo${extraCount > 1 ? 's' : ''}</span>`;
        vHeroSub2.style.backgroundColor = 'rgba(0,0,0,0.5)';
        vHeroSub2.style.backgroundBlendMode = 'overlay';
      }
    } else {
      if (vHeroSub2) {
        vHeroSub2.innerHTML = '';
        vHeroSub2.style.backgroundColor = 'transparent';
        vHeroSub2.style.backgroundBlendMode = 'normal';
      }
    }

    if (currentVenue.amenities) {
      if (currentVenue.amenities.parking && vFeatures) {
        vFeatures.innerHTML += `<div class="feature-chip" style="background:rgba(198,255,61,0.1); border:1px solid rgba(198,255,61,0.3); color:var(--lime); padding:8px 14px; border-radius:100px; font-size:13px; display:flex; align-items:center; gap:6px;">🅿️ Parking</div>`;
      }
      if (currentVenue.amenities.floodlit && vFeatures) {
        vFeatures.innerHTML += `<div class="feature-chip" style="background:rgba(61,232,255,0.1); border:1px solid rgba(61,232,255,0.3); color:var(--cyan); padding:8px 14px; border-radius:100px; font-size:13px; display:flex; align-items:center; gap:6px;">⚡ Floodlit</div>`;
      }
      if (currentVenue.amenities.payAtVenue && vFeatures) {
        vFeatures.innerHTML += `<div class="feature-chip" style="background:rgba(255,59,48,0.1); border:1px solid rgba(255,59,48,0.3); color:var(--red); padding:8px 14px; border-radius:100px; font-size:13px; display:flex; align-items:center; gap:6px;">💵 No advance payment</div>`;
      }
    }

    if (currentVenue.about) {
      if (vAboutText) vAboutText.textContent = currentVenue.about;
    } else {
      if (vAboutText) vAboutText.textContent = "Premium box cricket arena with high-quality artificial turf, excellent floodlights for night matches, and dedicated seating. Perfect for competitive matches and casual squad games.";
    }

    initDateSelector();

  } catch (e) {
    console.error(e);
    loadingVenue.textContent = 'Error loading venue.';
  }
}

const bookingDateInput = document.getElementById('bookingDate');
const slotsPlaceholder = document.getElementById('slotsPlaceholder');
const dateSelector = document.getElementById('dateSelector');

function initDateSelector() {
  if (!dateSelector) return;
  dateSelector.innerHTML = '';
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }); 
    const dateNum = d.getDate(); 
    
    const val = d.toISOString().split('T')[0];
    
    const pill = document.createElement('div');
    pill.className = 'date-pill';
    pill.innerHTML = `<div class="day">${dayName}</div><div class="date">${dateNum}</div>`;
    
    pill.addEventListener('click', () => {
      document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      bookingDateInput.value = val;
      
      slotsPlaceholder.style.display = 'none';
      slotsGrid.style.display = 'flex';
      
      selectedSlots = [];
      updateBookingSummaryUI();
      
      loadSlotsForDate(val);
    });
    
    dateSelector.appendChild(pill);
  }
  
  // Auto-click the first pill to load today's slots
  const firstPill = dateSelector.querySelector('.date-pill');
  if (firstPill) firstPill.click();
}

let unsubscribeSlots = null;

function loadSlotsForDate(date) {
  if (!db || !currentVenue) return;
  
  const operatingHoursList = currentVenue.operatingHoursList || [];
  
  if (operatingHoursList.length === 0) {
    slotsGrid.innerHTML = '<p style="color:var(--text-dim); grid-column: 1/-1;">This venue has not set up their operating hours yet.</p>';
    return;
  }

  if (unsubscribeSlots) unsubscribeSlots();

  unsubscribeSlots = db.collection('venues').doc(venueId).collection('slots')
    .where('date', '==', date)
    .where('status', '==', 'booked')
    .onSnapshot(snapshot => {
      slotsGrid.innerHTML = '';
      
      const bookedTimes = new Set();
      snapshot.forEach(doc => {
        bookedTimes.add(doc.data().time);
      });
      
      // Sort operating hours chronologically
      const sortedHours = [...operatingHoursList].sort((a, b) => {
        const timeA = new Date('1970/01/01 ' + a.split(' - ')[0]);
        const timeB = new Date('1970/01/01 ' + b.split(' - ')[0]);
        return timeA - timeB;
      });

      sortedHours.forEach(time => {
        const isBooked = bookedTimes.has(time);
        const el = document.createElement('div');
        el.className = `slot-list-item ${isBooked ? 'booked' : ''}`;
        
        const price = getEffectivePrice(currentVenue.price);
        
        el.innerHTML = `
          <div style="font-weight:700;">${time}</div>
          <div style="font-size:13px; font-weight:700; color:${isBooked ? 'var(--text-dim)' : 'var(--lime)'}">${isBooked ? 'Full' : 'Available'}</div>
        `;

        if (!isBooked) {
          el.addEventListener('click', () => selectSlot(el, time, date));
        }

        slotsGrid.appendChild(el);
      });
    });
}

function selectSlot(element, time, date) {
  const slotIdx = selectedSlots.findIndex(s => s.time === time && s.date === date);
  if (slotIdx > -1) {
    // Deselect
    selectedSlots.splice(slotIdx, 1);
    element.classList.remove('selected');
  } else {
    // Select
    selectedSlots.push({ time, date });
    element.classList.add('selected');
  }
  
  updateBookingSummaryUI();
}

function updateBookingSummaryUI() {
  const payBtn = document.getElementById('payAtVenueBtn');
  const summaryRows = document.getElementById('summaryRows');
  
  if (selectedSlots.length > 0) {
    if (summaryRows) summaryRows.style.display = 'block';
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = 'Reserve ' + selectedSlots.length + ' slot(s)';
    }
    
    const subtotal = getEffectivePrice(currentVenue.price) * selectedSlots.length;
    document.getElementById('displaySelectedPrice').textContent = `₹${subtotal}`;
    
    const discountPriceEl = document.getElementById('displayDiscountPrice');
    const discountRowEl = document.getElementById('displayDiscountRow');
    const finalPriceEl = document.getElementById('displayFinalPrice');
    const hintEl = document.getElementById('reservationHint');
    
    if (userWalletBalance > 0) {
      const discount = Math.min(userWalletBalance, subtotal);
      discountRowEl.style.display = 'flex';
      discountPriceEl.textContent = `-₹${discount}`;
      finalPriceEl.textContent = `₹${subtotal - discount}`;
      if (hintEl) hintEl.textContent = `No advance payment needed`;
    } else {
      discountRowEl.style.display = 'none';
      finalPriceEl.textContent = `₹${subtotal}`;
      if (hintEl) hintEl.textContent = `No advance payment needed`;
    }
  } else {
    if (summaryRows) summaryRows.style.display = 'none';
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = 'Select a slot to book';
    }
  }
}

function parseSlotDateTime(dateStr, timeStr) {
  try {
    const startTimeStr = timeStr.split(' - ')[0]; // "5:00 AM"
    const [time, modifier] = startTimeStr.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    
    if (modifier === 'PM' && hours < 12) {
      hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
      hours = 0;
    }
    
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    return new Date(year, month, day, hours, minutes, 0, 0);
  } catch (e) {
    console.error("Error parsing slot datetime:", e);
    return new Date();
  }
}

async function createBooking(paymentMethod) {
  if (selectedSlots.length === 0) return;

  if (typeof auth !== 'undefined' && !auth.currentUser) {
    window.location.href = 'signin.html';
    return;
  }
  
  try {
    // Fetch user's phone number
    let userPhone = '';
    const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
    if (userDoc.exists) {
      userPhone = userDoc.data().phone || '';
    }
    
    if (!userPhone) {
      alert("Please update your phone number in your Profile section before booking so the box owner can contact you.");
      window.location.href = 'profile.html';
      return;
    }

    const batch = db.batch();
    const slotsRef = db.collection('venues').doc(venueId).collection('slots');
    
    const subtotal = getEffectivePrice(currentVenue.price) * selectedSlots.length;
    const discount = Math.min(userWalletBalance, subtotal);

    for (const slot of selectedSlots) {
      const newSlotRef = slotsRef.doc();
      batch.set(newSlotRef, {
        date: slot.date,
        time: slot.time,
        status: 'booked',
        bookedBy: auth.currentUser.uid,
        bookedByName: auth.currentUser.displayName || 'Unknown User',
        bookedByEmail: auth.currentUser.email || '',
        bookedByPhone: userPhone,
        paymentMethod: paymentMethod,
        discountApplied: discount / selectedSlots.length,
        bookedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const newBookingRef = db.collection('bookings').doc();
      batch.set(newBookingRef, {
        user_id: auth.currentUser.uid,
        venue_id: venueId,
        venue_name: currentVenue.name || 'Unnamed Box',
        slot_start: firebase.firestore.Timestamp.fromDate(parseSlotDateTime(slot.date, slot.time)),
        date: slot.date,
        time: slot.time,
        status: 'Upcoming',
        paymentMethod: paymentMethod,
        discountApplied: discount / selectedSlots.length,
        bookedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    if (discount > 0) {
      const userRef = db.collection('users').doc(auth.currentUser.uid);
      batch.set(userRef, {
        wallet: firebase.firestore.FieldValue.increment(-discount)
      }, { merge: true });
    }

    await batch.commit();

    let bookingSuccessModal = document.getElementById('bookingSuccessModal');
    if (!bookingSuccessModal) {
      bookingSuccessModal = document.createElement('div');
      bookingSuccessModal.id = 'bookingSuccessModal';
      bookingSuccessModal.style.cssText = 'position: fixed; inset: 0; background: rgba(10, 14, 20, 0.95); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 9999; align-items: center; justify-content: center; padding: 20px; display: none;';
      bookingSuccessModal.innerHTML = `
        <div style="background: var(--card); border: 1px solid var(--card-line); border-radius: 24px; max-width: 440px; width: 100%; padding: 40px 32px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <div style="width: 80px; height: 80px; background: rgba(198,255,61,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; border: 2px solid var(--lime);">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 style="font-family: 'Anton', sans-serif; font-size: 28px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0; color: #fff;">Booking Confirmed!</h2>
          <p style="color: var(--text-dim); font-size: 14.5px; line-height: 1.5; margin: 0 0 28px 0;">Your slot has been successfully reserved. Get your squad ready and pay at the venue!</p>
          
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-line); border-radius: 16px; padding: 16px; margin-bottom: 28px; text-align: left;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--lime); margin-bottom: 8px; letter-spacing: 0.5px;">Booking Details</div>
            <div style="font-weight: 800; font-size: 16px; color: #fff; margin-bottom: 4px;" id="successVenueName">Venue Name</div>
            <div style="font-size: 13.5px; color: var(--text-dim);" id="successDateTime">Date & Time</div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <a href="index.html" class="btn btn-outline" style="text-decoration: none; display: flex; align-items: center; justify-content: center; padding: 14px; font-size: 14px; font-weight: 700; border-color: rgba(255,255,255,0.15); color: #fff;">Back to Home</a>
            <a href="profile.html" class="btn btn-lime" style="text-decoration: none; display: flex; align-items: center; justify-content: center; padding: 14px; font-size: 14px; font-weight: 800; color: #000;">View History</a>
          </div>
        </div>
      `;
      document.body.appendChild(bookingSuccessModal);
    }

    if (bookingSuccessModal) {
      document.getElementById('successVenueName').textContent = currentVenue.name || 'Venue Name';
      
      const dateObj = new Date(selectedSlots[0].date);
      const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const times = selectedSlots.map(s => s.time.split(' - ')[0]).join(', ');
      document.getElementById('successDateTime').textContent = `${formattedDate} • ${times}`;
      
      bookingSuccessModal.style.display = 'flex';
    }
  } catch (error) {
    console.error("Error creating booking:", error);
    alert("There was an error processing your booking. Please try again.");
  }
}

document.getElementById('payAtVenueBtn').addEventListener('click', () => {
  createBooking('venue');
});

