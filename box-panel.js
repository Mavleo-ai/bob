'use strict';

const loginOverlay = document.getElementById('loginOverlay');
const mainDashboard = document.getElementById('mainDashboard');
const ownerUsernameInput = document.getElementById('ownerUsername');
const ownerPasswordInput = document.getElementById('ownerPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

const addSlotForm = document.getElementById('addSlotForm');
const addSlotBtn = document.getElementById('addSlotBtn');
const slotsList = document.getElementById('slotsList');
const loadingSlots = document.getElementById('loadingSlots');
const headerVenueName = document.getElementById('headerVenueName');
const headerVenueMeta = document.getElementById('headerVenueMeta');

let currentOwner = null;

// Initialize db
const dbInterval = setInterval(() => {
  if (typeof firebase !== 'undefined' && firebase.firestore) {
    clearInterval(dbInterval);
    checkSession();
  }
}, 500);

function checkSession() {
  const session = localStorage.getItem('bmb_owner_session');
  if (session) {
    try {
      currentOwner = JSON.parse(session);
      showDashboard();
    } catch(e) {}
  }
}

loginBtn.addEventListener('click', async () => {
  const user = ownerUsernameInput.value.trim();
  const pass = ownerPasswordInput.value.trim();
  if (!user || !pass) return;

  loginBtn.textContent = 'Verifying...';
  loginBtn.disabled = true;

  try {
    const snapshot = await db.collection('box_owners').where('username', '==', user).where('password', '==', pass).limit(1).get();
    
    if (snapshot.empty) {
      loginError.style.display = 'block';
    } else {
      const ownerData = snapshot.docs[0].data();
      currentOwner = {
        id: snapshot.docs[0].id,
        venueId: ownerData.venueId,
        venueName: ownerData.venueName,
        username: ownerData.username
      };
      localStorage.setItem('bmb_owner_session', JSON.stringify(currentOwner));
      showDashboard();
    }
  } catch(err) {
    console.error(err);
    alert('Error connecting to database');
  } finally {
    loginBtn.textContent = 'Login';
    loginBtn.disabled = false;
  }
});

ownerPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

function showDashboard() {
  loginOverlay.style.display = 'none';
  mainDashboard.style.display = 'block';
  headerVenueName.textContent = currentOwner.venueName;
  loadVenueData();
}

const ownerPriceInput = document.getElementById('ownerPriceInput');
const updatePriceBtn = document.getElementById('updatePriceBtn');
const slotsToggleGrid = document.getElementById('slotsToggleGrid');

const ALL_TIMES = [
  "5:00 AM - 6:00 AM", "6:00 AM - 7:00 AM", "7:00 AM - 8:00 AM", "8:00 AM - 9:00 AM",
  "9:00 AM - 10:00 AM", "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM", "12:00 PM - 1:00 PM",
  "1:00 PM - 2:00 PM", "2:00 PM - 3:00 PM", "3:00 PM - 4:00 PM", "4:00 PM - 5:00 PM",
  "5:00 PM - 6:00 PM", "6:00 PM - 7:00 PM", "7:00 PM - 8:00 PM", "8:00 PM - 9:00 PM",
  "9:00 PM - 10:00 PM", "10:00 PM - 11:00 PM", "11:00 PM - 12:00 AM"
];

let unsubscribeVenue = null;

function loadVenueData() {
  if (!db || !currentOwner) return;
  
  if (unsubscribeVenue) unsubscribeVenue();
  
  unsubscribeVenue = db.collection('venues').doc(currentOwner.venueId).onSnapshot(docSnap => {
    if (!docSnap.exists) return;
    
    const venue = docSnap.data();
    
    // Update Price Input
    if (document.activeElement !== ownerPriceInput) {
      ownerPriceInput.value = venue.price || 500;
    }
    
    // Render Schedule Grid
    const operatingHoursList = venue.operatingHoursList || [];
    slotsToggleGrid.innerHTML = '';
    
    ALL_TIMES.forEach(time => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.padding = '12px 8px';
      btn.style.fontSize = '12px';
      btn.style.fontWeight = '700';
      btn.style.cursor = 'pointer';
      btn.style.border = '1px solid var(--card-line)';
      btn.textContent = time.split(' - ')[0]; // Show only start time
      
      const isOpen = operatingHoursList.includes(time);
      
      if (!isOpen) {
        // Closed
        btn.style.background = 'var(--bg)';
        btn.style.color = 'var(--text-dim)';
        btn.addEventListener('click', () => toggleSchedule(time, 'add'));
      } else {
        // Open
        btn.style.background = 'rgba(198,255,61,0.1)';
        btn.style.borderColor = 'var(--lime)';
        btn.style.color = 'var(--lime)';
        btn.addEventListener('click', () => toggleSchedule(time, 'remove'));
      }
      
      slotsToggleGrid.appendChild(btn);
    });
  });
}

async function toggleSchedule(time, action) {
  if (!db || !currentOwner) return;
  const venueRef = db.collection('venues').doc(currentOwner.venueId);
  
  try {
    if (action === 'add') {
      await venueRef.update({
        operatingHoursList: firebase.firestore.FieldValue.arrayUnion(time)
      });
    } else if (action === 'remove') {
      await venueRef.update({
        operatingHoursList: firebase.firestore.FieldValue.arrayRemove(time)
      });
    }
  } catch (err) {
    console.error('Error toggling schedule:', err);
    alert('Failed to update schedule.');
  }
}

updatePriceBtn.addEventListener('click', async () => {
  if (!db || !currentOwner) return;
  
  if (!currentOwner.venueId) {
    return alert('Your account is missing a linked venue. Please contact admin.');
  }

  const newPrice = parseInt(ownerPriceInput.value, 10);
  
  if (!newPrice || newPrice < 0) {
    return alert('Please enter a valid price.');
  }
  
  updatePriceBtn.textContent = 'Updating...';
  updatePriceBtn.disabled = true;
  
  try {
    await db.collection('venues').doc(currentOwner.venueId).set({
      price: newPrice
    }, { merge: true });
    updatePriceBtn.textContent = '✅ Updated';
    updatePriceBtn.style.background = '#4CAF50';
  } catch(err) {
    console.error(err);
    alert('Failed to update price. ' + (err.message || ''));
  } finally {
    setTimeout(() => {
      updatePriceBtn.textContent = 'Update Price';
      updatePriceBtn.style.background = '';
      updatePriceBtn.disabled = false;
    }, 2000);
  }
});

const viewBookingsDate = document.getElementById('viewBookingsDate');
const bookingsList = document.getElementById('bookingsList');
let unsubscribeBookings = null;

viewBookingsDate.addEventListener('change', () => {
  const date = viewBookingsDate.value;
  if (!date) {
    bookingsList.innerHTML = '<div style="color: var(--text-dim); padding: 20px 0; border-top: 1px dashed var(--card-line);">Please select a date above.</div>';
    if (unsubscribeBookings) unsubscribeBookings();
    return;
  }
  
  if (!db || !currentOwner) return;
  
  if (unsubscribeBookings) unsubscribeBookings();
  
  bookingsList.innerHTML = '<div style="color: var(--text-dim); padding: 20px 0;">Loading bookings...</div>';
  
  unsubscribeBookings = db.collection('venues').doc(currentOwner.venueId).collection('slots')
    .where('date', '==', date)
    .where('status', 'in', ['booked', 'accepted'])
    .onSnapshot(snapshot => {
      bookingsList.innerHTML = '';
      
      if (snapshot.empty) {
        bookingsList.innerHTML = '<div style="color: var(--text-dim); padding: 20px 0; border-top: 1px dashed var(--card-line);">No bookings for this date.</div>';
        return;
      }
      
      const docs = [];
      snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
      
      // Sort chronologically
      docs.sort((a, b) => {
        const timeA = new Date('1970/01/01 ' + a.time.split(' - ')[0]);
        const timeB = new Date('1970/01/01 ' + b.time.split(' - ')[0]);
        return timeA - timeB;
      });
      
      docs.forEach(b => {
        const div = document.createElement('div');
        div.style.background = 'var(--bg)';
        div.style.border = '1px solid var(--card-line)';
        div.style.borderRadius = '8px';
        div.style.padding = '16px';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        
        div.innerHTML = `
          <div>
            <div style="font-weight: 800; color: var(--lime); font-size: 16px; margin-bottom: 4px;">${b.time}</div>
            <div style="font-size: 13px; color: var(--text-dim);">
              <strong style="color: var(--text);">${b.bookedByName || 'Unknown User'}</strong><br>
              ${b.bookedByEmail || 'No email provided'}<br>
              <span style="color: var(--cyan);">${b.bookedByPhone || 'No phone provided'}</span>
            </div>
          </div>
          <div style="text-align: right;">
            ${b.status === 'accepted' 
              ? `<div style="background: rgba(61,232,255,0.1); color: var(--cyan); padding: 6px 12px; border-radius: 100px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; display: inline-block;">Accepted</div>` 
              : `<button onclick="acceptBooking('${b.id}', '${b.bookedBy}')" style="background: var(--lime); color: #000; border: none; padding: 6px 12px; border-radius: 100px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; cursor: pointer;">Accept Booking</button>`
            }
            <div style="font-size: 11px; color: var(--text-dim);">
              ${b.paymentMethod === 'venue' ? 'Pay at Venue' : (b.paymentMethod === 'online' ? 'Paid Online' : '')}
            </div>
          </div>
        `;
        bookingsList.appendChild(div);
      });
    });
});

window.acceptBooking = async function(slotId, userId) {
  if (!confirm("Are you sure you want to accept this booking? The user will be rewarded ₹10 in their wallet.")) return;
  
  try {
    const batch = db.batch();
    
    // 1. Update slot status
    const slotRef = db.collection('venues').doc(currentOwner.venueId).collection('slots').doc(slotId);
    batch.update(slotRef, { status: 'accepted' });
    
    // 2. Credit wallet
    if (userId) {
      const userRef = db.collection('users').doc(userId);
      batch.set(userRef, { 
        wallet: firebase.firestore.FieldValue.increment(10) 
      }, { merge: true });
    }
    
    await batch.commit();
    console.log("Booking accepted and wallet credited.");
  } catch (error) {
    console.error("Error accepting booking:", error);
    alert("Failed to accept booking. Please try again.");
  }
};

const boxLogoutBtn = document.getElementById('boxLogoutBtn');
if (boxLogoutBtn) {
  boxLogoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('bmb_owner_session');
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().then(() => {
        window.location.href = 'index.html';
      }).catch(() => {
        window.location.href = 'index.html';
      });
    } else {
      window.location.href = 'index.html';
    }
  });
}
