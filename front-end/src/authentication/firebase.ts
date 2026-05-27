import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GithubAuthProvider, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
    firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

const getFirebaseAuth = () => {
    if (!isFirebaseConfigured) {
        throw new Error('Firebase auth is not configured. Add REACT_APP_FIREBASE_* values to the front-end env file.');
    }

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    return getAuth(app);
};

export const getAuthInstance = () => getFirebaseAuth();

export const signInWithFirebaseProvider = async (providerName: 'google' | 'github') => {
    const auth = getFirebaseAuth();
    const provider = providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
    return signInWithPopup(auth, provider);
};

export const subscribeToFirebaseAuthState = (onAuthChange) => {
    if (!isFirebaseConfigured) {
        return () => {};
    }

    return onAuthStateChanged(getFirebaseAuth(), onAuthChange);
};

export const signOutFromFirebase = async () => {
    if (!isFirebaseConfigured) {
        return;
    }

    await getFirebaseAuth().signOut();
};
