import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuration loaded from provisioned firebase-applet-config.json
const firebaseConfig = {
  projectId: "gen-lang-client-0813763992",
  appId: "1:773494247789:web:5d8b29f5f56e50271fca64",
  apiKey: "AIzaSyC9X3Z6u7vEl8YlEuoK0tXgvspoXSCf1wI",
  authDomain: "gen-lang-client-0813763992.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-zmessenger-f13c2cec-224d-45ba-82cc-0ed653c7ed03",
  storageBucket: "gen-lang-client-0813763992.firebasestorage.app",
  messagingSenderId: "773494247789",
  oAuthClientId: "773494247789-2a4jqj2qqjq7ju4evglinq0i0rs078do.apps.googleusercontent.com",
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
