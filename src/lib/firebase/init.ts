import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from './config';

// Initialize Firebase only once
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
