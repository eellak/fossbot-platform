import { initializeApp, getApps } from 'firebase/app';
import {
    AuthCredential,
    fetchSignInMethodsForEmail,
    getAuth,
    GithubAuthProvider,
    GoogleAuthProvider,
    linkWithCredential,
    onAuthStateChanged,
    signInWithPopup,
} from 'firebase/auth';

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

const firebaseProviderForName = (providerName: 'google' | 'github') => (
    providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider()
);

const providerNameForSignInMethod = (method: string): 'google' | 'github' | undefined => {
    if (method === GoogleAuthProvider.GOOGLE_SIGN_IN_METHOD || method === 'google.com') {
        return 'google';
    }

    if (method === GithubAuthProvider.GITHUB_SIGN_IN_METHOD || method === 'github.com') {
        return 'github';
    }

    return undefined;
};

export const getPendingCredentialFromError = (error: any): AuthCredential | null => (
    GoogleAuthProvider.credentialFromError(error) || GithubAuthProvider.credentialFromError(error)
);

export const getEmailFromFirebaseError = (error: any): string | undefined => (
    error?.customData?.email || error?.email
);

export const signInWithFirebaseProvider = async (providerName: 'google' | 'github') => {
    const auth = getFirebaseAuth();
    return signInWithPopup(auth, firebaseProviderForName(providerName));
};

export const linkFirebaseProviderCollision = async (email: string, pendingCredential: AuthCredential) => {
    const auth = getFirebaseAuth();
    const methods = await fetchSignInMethodsForEmail(auth, email);
    const existingProviderName = methods.map(providerNameForSignInMethod).find(Boolean);

    if (!existingProviderName) {
        throw new Error('Account already exists with different credentials.');
    }

    const existingCredential = await signInWithPopup(auth, firebaseProviderForName(existingProviderName));

    if (existingCredential.user.email?.toLowerCase() !== email.toLowerCase()) {
        await auth.signOut();
        throw new Error('The selected account does not match the email that needs linking.');
    }

    await linkWithCredential(existingCredential.user, pendingCredential);
    return existingCredential;
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
