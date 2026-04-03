import aiStudioConfig from '../../../firebase-applet-config.json';

// Firebase configuration centralized here.
// To switch to a different project (e.g., Tokyo region production project),
// you can replace this object with your production config, or use environment variables.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || aiStudioConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || aiStudioConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || aiStudioConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || aiStudioConfig.storageBucket || `${aiStudioConfig.projectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || aiStudioConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || aiStudioConfig.appId,
  // AI Studio specific (can be undefined in standard Firebase projects)
  firestoreDatabaseId: aiStudioConfig.firestoreDatabaseId
};
