import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Firebase 콘솔에서 프로젝트 설정 > 앱 추가 후 아래 값을 교체하세요
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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
