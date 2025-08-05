// frontend/src/contexts/AuthContext.jsx
import React, { useContext, useState, useEffect, createContext } from 'react';
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc
} from 'firebase/firestore';

// NEW: Import the shared auth and db instances from our central firebase.js file
import { auth, db } from '../firebase'; 

const googleProvider = new GoogleAuthProvider();
const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    async function signup(email, password, username) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, "users", user.uid), {
            username: username,
            email: user.email,
            bio: "Welcome to Inkwell AI!",
            avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${username}`,
            date_created: new Date().toISOString(),
        });
        return userCredential;
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    function signInWithGoogle() {
        return signInWithPopup(auth, googleProvider).then(async (result) => {
            const user = result.user;
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    username: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    bio: "Welcome to Inkwell AI!",
                    avatar_url: user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${user.displayName}`,
                    date_created: new Date().toISOString(),
                });
            }
            return result;
        });
    }

    function logout() {
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const idToken = await user.getIdToken();
                setToken(idToken);
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setCurrentUser({ ...user, ...userDoc.data() });
                } else {
                    setCurrentUser(user);
                }
            } else {
                setCurrentUser(null);
                setToken(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, [auth, db]);

    const value = {
        currentUser,
        setCurrentUser,
        token,
        loading,
        signup,
        login,
        signInWithGoogle,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}