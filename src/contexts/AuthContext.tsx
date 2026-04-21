import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, findUserProfileRefByAuthUser, signOut } from '../lib/firebase';

export type Role = 'admin' | 'safety' | 'field' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
});

export const useAuth = () => useContext(AuthContext);

// Define the initial admin email
const ADMIN_EMAIL = 'paaaaanchi1225@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (firebaseUser) {
        setLoading(true);

        findUserProfileRefByAuthUser(firebaseUser).then((userRef) => {
          if (!userRef) {
            setProfile(null);
            signOut().catch(console.error);
            setLoading(false);
            return;
          }

          unsubscribeProfile = onSnapshot(
            userRef,
            (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;

                // Auto-upgrade the designated admin if their role is not 'admin'
                if (firebaseUser.email === ADMIN_EMAIL && data.role !== 'admin') {
                  updateDoc(userRef, { role: 'admin' }).catch(console.error);
                }

                setProfile(data);
              } else {
                setProfile(null);
              }
              setLoading(false);
            },
            (error) => {
              console.error('Error fetching user profile', error);
              setProfile(null);
              setLoading(false);
            },
          );
        }).catch((error) => {
          console.error('Error checking user profile access', error);
          setProfile(null);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
