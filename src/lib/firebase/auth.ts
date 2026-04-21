import {
  User,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { app } from './init';
import { db } from './firestore';

export const auth = getAuth(app);

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const mapAuthErrorMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code;

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/too-many-requests':
      return '試行回数が上限に達しました。しばらく時間をおいて再度お試しください';
    case 'auth/network-request-failed':
      return 'ネットワーク接続を確認して再度お試しください';
    case 'auth/missing-email':
      return '会社メールアドレスを入力してください';
    default:
      return 'ログインに失敗しました。管理者にお問い合わせください';
  }
};

export const findUserProfileRefByAuthUser = async (user: User) => {
  const userByUidRef = doc(db, 'users', user.uid);
  const userByUidSnap = await getDoc(userByUidRef);
  if (userByUidSnap.exists()) {
    return userByUidRef;
  }

  if (user.email) {
    const usersByEmailQuery = query(collection(db, 'users'), where('email', '==', user.email));
    const usersByEmailSnap = await getDocs(usersByEmailQuery);
    if (!usersByEmailSnap.empty) {
      return doc(db, 'users', usersByEmailSnap.docs[0].id);
    }
  }

  return null;
};

export const signInWithEmailPassword = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    const allowedUserRef = await findUserProfileRefByAuthUser(result.user);

    if (!allowedUserRef) {
      await firebaseSignOut(auth);
      throw new AuthError('auth/not-registered', 'このアカウントは利用登録されていません');
    }

    return result.user;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('auth/login-failed', mapAuthErrorMessage(error));
  }
};

export const sendPasswordReset = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    throw new AuthError('auth/reset-failed', mapAuthErrorMessage(error));
  }
};

export const signOut = () => firebaseSignOut(auth);
