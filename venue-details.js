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

const slotsGrid = document.getElementById('slotsGrid');

let currentVenue = null;
let selectedSlots = [];
let userWalletBalance = 0;

const authInterval = setInterval(() => {
  if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
    clearInterval(authInterval);
    auth.onAuthStateChanged(async (user) => {
      if (user && typeof db !== 'undefined') {
        const udoc = await db.collection('users').doc(user.uid).get();
        if (udoc.exists) userWalletBalance = udoc.data().wallet || 0;
      } else {
        userWalletBalance = 0;
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
    vRating.textContent = currentVenue.rating;
    vHours.textContent = currentVenue.operatingHours || 'Contact manager for hours';
    
    const defaultImg = 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200';
    let images = currentVenue.images;
    if (!images || images.length === 0) {
      images = currentVenue.image ? [currentVenue.image] : [defaultImg];
    }
    
    const mainImg = images[0] || defaultImg;
    const sub1Img = images[1] || mainImg;
    const sub2Img = images[2] || mainImg;
    
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
        vFeatures.innerHTML += `<div class="feature-chip" style="background:var(--card); border:1px solid var(--card-line); padding:8px 14px; border-radius:100px; font-size:13px; display:flex; align-items:center; gap:6px;">🅿️ Parking</div>`;
      }
      if (currentVenue.amenities.floodlit && vFeatures) {
        vFeatures.innerHTML += `<div class="feature-chip" style="background:var(--card); border:1px solid var(--card-line); padding:8px 14px; border-radius:100px; font-size:13px; display:flex; align-items:center; gap:6px;">⚡ Floodlit</div>`;
      }
      if (currentVenue.amenities.payAtVenue && vFeatures) {
        vFeatures.innerHTML += `<div class="feature-chip" style="background:var(--card); border:1px solid var(--card-line); padding:8px 14px; border-radius:100px; font-size:13px; display:flex; align-items:center; gap:6px;">💵 Pay at venue</div>`;
      }
    }

    if (currentVenue.about) {
      if (vAboutText) vAboutText.textContent = currentVenue.about;
    } else {
      if (vAboutText) vAboutText.textContent = "No description provided for this venue.";
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
        
        const price = currentVenue.price || 500;
        
        el.innerHTML = `
          <div style="font-weight:700;">${time}</div>
          <div style="color:var(--text-dim); font-size:13px;">${isBooked ? 'Booked' : '₹' + price}</div>
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
  if (selectedSlots.length > 0) {
    document.getElementById('bookingActionContainer').style.display = 'block';
    
    const subtotal = (currentVenue.price || 500) * selectedSlots.length;
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
      if (hintEl) hintEl.textContent = `No payment now - pay ₹${subtotal - discount} at the venue`;
    } else {
      discountRowEl.style.display = 'none';
      finalPriceEl.textContent = `₹${subtotal}`;
      if (hintEl) hintEl.textContent = `No payment now - pay ₹${subtotal} at the venue`;
    }
  } else {
    document.getElementById('bookingActionContainer').style.display = 'none';
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
    
    const subtotal = (currentVenue.price || 500) * selectedSlots.length;
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
    }

    if (discount > 0) {
      const userRef = db.collection('users').doc(auth.currentUser.uid);
      batch.set(userRef, {
        wallet: firebase.firestore.FieldValue.increment(-discount)
      }, { merge: true });
    }

    await batch.commit();

    alert(`Booking confirmed for ${selectedSlots.length} slot(s)! You can pay at the venue.`);
    window.location.href = 'index.html';
  } catch (error) {
    console.error("Error creating booking:", error);
    alert("There was an error processing your booking. Please try again.");
  }
}

document.getElementById('payAtVenueBtn').addEventListener('click', () => {
  createBooking('venue');
});

