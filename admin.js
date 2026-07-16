'use strict';

const loginOverlay = document.getElementById('loginOverlay');
const adminDashboard = document.getElementById('adminDashboard');
const adminPassword = document.getElementById('adminPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

const addVenueForm = document.getElementById('addVenueForm');
const addVenueBtn = document.getElementById('addVenueBtn');
const venuesList = document.getElementById('venuesList');
const loadingVenues = document.getElementById('loadingVenues');

// db is already initialized in firebase-config.js

// Super simple hardcoded auth for demo/MVP
const ADMIN_SECRET = 'admin123';

loginBtn.addEventListener('click', () => {
  if (adminPassword.value === ADMIN_SECRET) {
    loginOverlay.style.display = 'none';
    adminDashboard.style.display = 'block';
    document.getElementById('ownerDashboard').style.display = 'block';
    loadVenues();
    loadOwners();
  } else {
    loginError.style.display = 'block';
  }
});

adminPassword.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// Add Venue Logic
addVenueForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) return alert('Firebase Firestore is not initialized.');
  
  addVenueBtn.textContent = 'Adding...';
  addVenueBtn.disabled = true;

  const newVenue = {
    name: document.getElementById('vName').value.trim(),
    location: document.getElementById('vLocation').value.trim(),
    rating: document.getElementById('vRating').value.trim(),
    price: parseInt(document.getElementById('vPrice').value, 10) || 500,
    manager: document.getElementById('vManager').value.trim(),
    operatingHours: document.getElementById('vTime').value.trim(),
    googleMapUrl: document.getElementById('vGoogleLink').value.trim(),
    contactNumber: document.getElementById('vContact').value.trim(),
    images: [
      document.getElementById('vImage1').value.trim(),
      document.getElementById('vImage2').value.trim(),
      document.getElementById('vImage3').value.trim(),
      document.getElementById('vImage4').value.trim(),
      document.getElementById('vImage5').value.trim()
    ].filter(url => url !== ''),
    about: document.getElementById('vAbout').value.trim(),
    amenities: {
      parking: document.getElementById('vFeatureParking').checked,
      floodlit: document.getElementById('vFeatureFloodlit').checked,
      payAtVenue: document.getElementById('vFeaturePayAtVenue').checked
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('venues').add(newVenue);
    addVenueForm.reset();
    addVenueBtn.textContent = '✅ Added!';
    addVenueBtn.style.background = '#4CAF50';
    loadVenues();
  } catch (error) {
    console.error('Error adding venue:', error);
    alert('Failed to add venue. Ensure you have write permissions.');
  } finally {
    setTimeout(() => {
      addVenueBtn.textContent = 'Add Venue to Home Page';
      addVenueBtn.style.background = '';
      addVenueBtn.disabled = false;
    }, 2000);
  }
});

// Load Venues Logic
function loadVenues() {
  if (!db) return;
  
  db.collection('venues').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
    loadingVenues.style.display = 'none';
    venuesList.innerHTML = '';
    
    const oVenueSelect = document.getElementById('oVenue');
    oVenueSelect.innerHTML = '<option value="" disabled selected>Select a venue...</option>';

    if (snapshot.empty) {
      venuesList.innerHTML = '<p style="color:var(--text-dim);">No venues added yet.</p>';
      return;
    }

    snapshot.forEach(doc => {
      const v = doc.data();
      const div = document.createElement('div');
      div.className = 'venue-row';
      div.innerHTML = `
        <div class="venue-info">
          <h4>${v.name}</h4>
          <p>${v.location} · ${v.rating} · ₹${v.price}/hr · Mgr: ${v.manager}</p>
          <p style="font-size:12px; margin-top:4px;">⏱️ ${v.operatingHours || 'N/A'} | 📞 ${v.contactNumber || 'N/A'}</p>
        </div>
        <div class="venue-actions">
          <button class="btn btn-outline" style="border-color: var(--red); color: var(--red); padding: 8px 16px; font-size: 13px;" onclick="deleteVenue('${doc.id}')">Delete</button>
        </div>
      `;
      venuesList.appendChild(div);

      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = v.name;
      oVenueSelect.appendChild(opt);
    });
  });
}

window.deleteVenue = async (id) => {
  if (confirm('Are you sure you want to delete this venue? It will be removed from the home page instantly.')) {
    try {
      await db.collection('venues').doc(id).delete();
    } catch (e) {
      console.error(e);
      alert('Error deleting venue.');
    }
  }
};

// ===== BOX OWNER LOGIC =====
const createOwnerForm = document.getElementById('createOwnerForm');
const createOwnerBtn = document.getElementById('createOwnerBtn');
const ownersList = document.getElementById('ownersList');
const loadingOwners = document.getElementById('loadingOwners');

if (createOwnerForm) {
  createOwnerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!db) return;

    createOwnerBtn.textContent = 'Creating...';
    createOwnerBtn.disabled = true;

    const oVenueSelect = document.getElementById('oVenue');
    const venueId = oVenueSelect.value;
    const venueName = oVenueSelect.options[oVenueSelect.selectedIndex].text;
    const username = document.getElementById('oUsername').value.trim();
    const password = document.getElementById('oPassword').value.trim();

    try {
      // Check if username already exists
      const existing = await db.collection('box_owners').where('username', '==', username).get();
      if (!existing.empty) {
        alert('Username already exists. Please choose another.');
        return;
      }

      await db.collection('box_owners').add({
        venueId,
        venueName,
        username,
        password, // In a real app, do NOT store plain text passwords
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      createOwnerForm.reset();
      createOwnerBtn.textContent = '✅ Account Created!';
      createOwnerBtn.style.background = '#4CAF50';
    } catch (error) {
      console.error('Error creating owner:', error);
      alert('Failed to create account: ' + error.message);
    } finally {
      setTimeout(() => {
        createOwnerBtn.textContent = 'Create Box Owner Account';
        createOwnerBtn.style.background = '';
        createOwnerBtn.disabled = false;
      }, 2000);
    }
  });
}

function loadOwners() {
  if (!db) return;
  db.collection('box_owners').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    loadingOwners.style.display = 'none';
    ownersList.innerHTML = '';
    
    if (snapshot.empty) {
      ownersList.innerHTML = '<p style="color:var(--text-dim);">No owner accounts created yet.</p>';
      return;
    }

    snapshot.forEach(doc => {
      const o = doc.data();
      const div = document.createElement('div');
      div.className = 'venue-row';
      div.innerHTML = `
        <div class="venue-info">
          <h4>${o.username}</h4>
          <p>Venue: ${o.venueName} · Password: ${o.password}</p>
        </div>
        <div class="venue-actions" style="display: flex; gap: 8px;">
          <button class="btn btn-outline" style="padding: 8px 16px; font-size: 13px;" onclick="changeOwnerPassword('${doc.id}')">Change Password</button>
          <button class="btn btn-outline" style="border-color: var(--red); color: var(--red); padding: 8px 16px; font-size: 13px;" onclick="deleteOwner('${doc.id}')">Delete</button>
        </div>
      `;
      ownersList.appendChild(div);
    });
  });
}

window.deleteOwner = async (id) => {
  if (confirm('Are you sure you want to delete this owner account? They will no longer be able to log in.')) {
    try {
      await db.collection('box_owners').doc(id).delete();
    } catch (e) {
      console.error(e);
      alert('Error deleting owner.');
    }
  }
};

window.changeOwnerPassword = async (id) => {
  const newPassword = prompt('Enter new password for this box owner:');
  if (newPassword && newPassword.trim() !== '') {
    try {
      await db.collection('box_owners').doc(id).update({
        password: newPassword.trim()
      });
      alert('Password updated successfully!');
    } catch (e) {
      console.error(e);
      alert('Error updating password.');
    }
  }
};
