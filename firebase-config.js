// Firebase Configuration for deeltrack
// Replace with your Firebase project credentials

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "deeltrack.firebaseapp.com",
  projectId: "deeltrack",
  storageBucket: "deeltrack.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Auth state observer
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log('User signed in:', user.email);
    localStorage.setItem('currentUser', JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    }));
  } else {
    console.log('User signed out');
    localStorage.removeItem('currentUser');
    // Redirect to login if not on public page
    if (!window.location.pathname.includes('login') && 
        !window.location.pathname.includes('signup')) {
      window.location.href = 'login.html';
    }
  }
});

// Firestore database reference
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

// Helper functions
async function saveDeal(dealData) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');
  
  dealData.createdBy = user.uid;
  dealData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  dealData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  
  return await db.collection('deals').add(dealData);
}

async function getDeals() {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');
  
  const snapshot = await db.collection('deals')
    .where('createdBy', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .get();
    
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function saveInvestor(investorData) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');
  
  investorData.sponsorId = user.uid;
  investorData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  
  return await db.collection('investors').add(investorData);
}

async function uploadDocument(file, dealId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');
  
  const storageRef = storage.ref(`documents/${user.uid}/${dealId}/${file.name}`);
  await storageRef.put(file);
  
  const downloadURL = await storageRef.getDownloadURL();
  
  // Save document metadata to Firestore
  await db.collection('documents').add({
    dealId,
    sponsorId: user.uid,
    name: file.name,
    url: downloadURL,
    type: file.type,
    size: file.size,
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  return downloadURL;
}