import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

// Firebase 콘솔에서 프로젝트 설정 > 앱 추가 후 아래 값을 교체하세요
const firebaseConfig = {
  apiKey: "AIzaSyD1nVp-XxlYHZp8MOSZEM75qlQfwV-sGsA",
  authDomain: "wedding-invitation-b3694.firebaseapp.com",
  projectId: "wedding-invitation-b3694",
  storageBucket: "wedding-invitation-b3694.firebasestorage.app",
  messagingSenderId: "782627279464",
  appId: "1:782627279464:web:5f430e8b98a41d287ca1dd"
};

const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let db = null, auth = null, storage = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  db      = getFirestore(app);
  auth    = getAuth(app);
  storage = getStorage(app);
}

export { db, auth, storage, isConfigured };
