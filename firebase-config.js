// deeltrack — Firebase Configuration
// Project: deeltrack

const firebaseConfig = {
  apiKey: "AIzaSyApYFLlP39E8_LGLsSOgzqFbt333U5Yli4",
  authDomain: "deeltrack.firebaseapp.com",
  projectId: "deeltrack",
  storageBucket: "deeltrack.firebasestorage.app",
  messagingSenderId: "686329348166",
  appId: "1:686329348166:web:fd19035b563c0fef7b4a47",
  measurementId: "G-T5QKV9PQQC"
};

// Initialize Firebase (guard against double-init)
if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}
