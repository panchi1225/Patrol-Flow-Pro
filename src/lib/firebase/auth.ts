import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { app } from './init';
import { db } from './firestore';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Define the initial admin email
const ADMIN_EMAIL = 'paaaaanchi1225@gmail.com';

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    const targetRole = user.email === ADMIN_EMAIL ? 'admin' : 'viewer';

    if (!userSnap.exists()) {
      // Create basic profile if it doesn't exist.
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        role: targetRole,
        createdAt: new Date().toISOString()
      });
    } else {
      // If user exists but is the designated admin and doesn't have the admin role, upgrade them.
      const userData = userSnap.data();
      if (user.email === ADMIN_EMAIL && userData?.role !== 'admin') {
        await updateDoc(userRef, { role: 'admin' });
      }
    }
    return user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const signOut = () => firebaseSignOut(auth);
