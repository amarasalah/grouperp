// Auth Module - Firebase Authentication + User/Role management
import { auth, db } from './firebase.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

let currentUser = null;       // Firebase Auth user
let currentUserProfile = null; // Firestore user profile {uid, email, displayName, roleId, roleName, ...}
let currentRole = null;        // Firestore role {nom, permissions: {...}}
let authReadyResolve = null;
const authReadyPromise = new Promise(r => { authReadyResolve = r; });

// ===== AUTH STATE LISTENER =====
export function initAuth(onReady) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Load user profile from Firestore
            try {
                const profileSnap = await getDoc(doc(db, 'users', user.uid));
                if (profileSnap.exists()) {
                    currentUserProfile = { uid: user.uid, ...profileSnap.data() };
                    // Load role
                    if (currentUserProfile.roleId) {
                        const roleSnap = await getDoc(doc(db, 'roles', currentUserProfile.roleId));
                        if (roleSnap.exists()) {
                            currentRole = { id: currentUserProfile.roleId, ...roleSnap.data() };
                        }
                    }
                } else {
                    // User exists in Auth but not in Firestore (edge case)
                    currentUserProfile = { uid: user.uid, email: user.email, displayName: user.email };
                    currentRole = null;
                }
            } catch (e) {
                console.warn('Error loading user profile:', e);
                currentUserProfile = { uid: user.uid, email: user.email, displayName: user.email };
                currentRole = null;
            }
        } else {
            currentUser = null;
            currentUserProfile = null;
            currentRole = null;
        }
        if (authReadyResolve) { authReadyResolve(); authReadyResolve = null; }
        if (onReady) onReady(currentUser);
    });
}

// ===== WAIT FOR AUTH READY =====
export function waitForAuth() {
    return authReadyPromise;
}

// ===== LOGIN =====
export async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

// ===== LOGOUT =====
export async function logout() {
    sessionStorage.removeItem('selectedBcgId');
    await signOut(auth);
}

// ===== CREATE USER (Admin function) =====
export async function createUser(email, password, displayName, roleId, roleName) {
    // NOTE: Creating users with createUserWithEmailAndPassword signs in as that user.
    // For admin user creation, we'll handle re-login in the UI.
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        displayName: displayName || email,
        roleId: roleId || '',
        roleName: roleName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return cred.user.uid;
}

// ===== CREATE SUPER ADMIN (hidden setup) =====
export async function createSuperAdmin(email, password, displayName) {
    // First ensure the 'super_admin' role exists
    const roleRef = doc(db, 'roles', 'super_admin');
    const roleSnap = await getDoc(roleRef);
    if (!roleSnap.exists()) {
        await setDoc(roleRef, {
            nom: 'Super Admin',
            isSuperAdmin: true,
            permissions: {},
            createdAt: serverTimestamp()
        });
    }
    // Create the user
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        displayName: displayName || 'Super Admin',
        roleId: 'super_admin',
        roleName: 'Super Admin',
        isSuperAdmin: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return cred.user.uid;
}

// ===== GETTERS =====
export function getUser() {
    return currentUser;
}

export function getUserProfile() {
    return currentUserProfile;
}

export function getUserRole() {
    return currentRole;
}

export function isAuthenticated() {
    return !!currentUser;
}

export function isSuperAdmin() {
    return !!(currentUserProfile?.isSuperAdmin || currentRole?.isSuperAdmin);
}

// ===== PERMISSION CHECKS =====
export function hasMenuAccess(menuKey) {
    if (isSuperAdmin()) return true;
    if (!currentRole?.permissions) return false;
    return !!currentRole.permissions[menuKey]?.view;
}

export function hasPermission(menuKey, action) {
    // action: 'view', 'create', 'edit', 'delete'
    if (isSuperAdmin()) return true;
    if (!currentRole?.permissions) return false;
    return !!currentRole.permissions[menuKey]?.[action];
}

// ===== RELOAD PROFILE (after role changes) =====
export async function reloadProfile() {
    if (!currentUser) return;
    const profileSnap = await getDoc(doc(db, 'users', currentUser.uid));
    if (profileSnap.exists()) {
        currentUserProfile = { uid: currentUser.uid, ...profileSnap.data() };
        if (currentUserProfile.roleId) {
            const roleSnap = await getDoc(doc(db, 'roles', currentUserProfile.roleId));
            if (roleSnap.exists()) {
                currentRole = { id: currentUserProfile.roleId, ...roleSnap.data() };
            }
        }
    }
}
