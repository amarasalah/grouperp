// Authentication & Authorization Service
import { auth, db } from './firebase.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    getAuth
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

// ===== CURRENT USER STATE =====
let _currentUser = null;       // Firebase auth user
let _currentProfile = null;    // Firestore user profile (with role)
let _currentPermissions = null; // Resolved permissions from role
let _authReady = false;
const _authCallbacks = [];

// ===== AUTH STATE LISTENER =====
export function initAuth() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            _currentUser = user;
            if (user) {
                _currentProfile = await getUserProfile(user.uid);
                if (_currentProfile?.roleId) {
                    const role = await getRole(_currentProfile.roleId);
                    _currentPermissions = role?.permissions || {};
                    _currentProfile.roleName = role?.name || '';
                    _currentProfile.isSuperAdmin = role?.isSuperAdmin || false;
                } else {
                    _currentPermissions = {};
                }
            } else {
                _currentProfile = null;
                _currentPermissions = null;
            }
            _authReady = true;
            _authCallbacks.forEach(cb => cb(user));
            resolve(user);
        });
    });
}

export function onAuthChange(callback) {
    _authCallbacks.push(callback);
}

// ===== LOGIN / LOGOUT =====
export async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function logout() {
    await signOut(auth);
    _currentUser = null;
    _currentProfile = null;
    _currentPermissions = null;
}

// ===== CREATE USER (Firebase Auth + Firestore profile) =====
// Uses a secondary Firebase app so the admin session is not disrupted
export async function createAuthUser(email, password, profileData) {
    const tempApp = initializeApp(auth.app.options, '_tempUserCreation');
    const tempAuth = getAuth(tempApp);
    try {
        const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
        const uid = cred.user.uid;
        await setDoc(doc(db, 'app_users', uid), {
            ...profileData,
            email,
            uid,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return uid;
    } finally {
        await deleteApp(tempApp);
    }
}

// ===== USER PROFILE (Firestore) =====
async function getUserProfile(uid) {
    try {
        const snap = await getDoc(doc(db, 'app_users', uid));
        if (snap.exists()) return { id: snap.id, ...snap.data() };
        return null;
    } catch (e) {
        console.warn('getUserProfile error:', e.message);
        return null;
    }
}

// ===== ROLES =====
async function getRole(roleId) {
    try {
        const snap = await getDoc(doc(db, 'roles', roleId));
        if (snap.exists()) return { id: snap.id, ...snap.data() };
        return null;
    } catch (e) {
        console.warn('getRole error:', e.message);
        return null;
    }
}

// ===== GETTERS =====
export function isAuthenticated() {
    return !!_currentUser;
}

export function isAuthReady() {
    return _authReady;
}

export function getCurrentUser() {
    return _currentUser;
}

export function getCurrentProfile() {
    return _currentProfile;
}

export function isSuperAdmin() {
    return _currentProfile?.isSuperAdmin === true;
}

// ===== PERMISSION CHECKING =====
/**
 * Check if current user has access to a specific route.
 * Super admin has access to everything.
 * permissions = { '/route': { view: true, create: true, edit: true, delete: true } }
 */
export function hasRouteAccess(route) {
    if (isSuperAdmin()) return true;
    if (!_currentPermissions) return false;
    const perm = _currentPermissions[route];
    return perm && perm.view === true;
}

export function hasPermission(route, action) {
    if (isSuperAdmin()) return true;
    if (!_currentPermissions) return false;
    const perm = _currentPermissions[route];
    return perm && perm[action] === true;
}

export function getPermissions() {
    return _currentPermissions || {};
}

// ===== BOOTSTRAP SUPER ADMIN =====
/**
 * Ensures a super admin role and the default super admin user exist.
 * Only runs if no roles collection exists yet.
 */
export async function bootstrapSuperAdmin() {
    try {
        const rolesSnap = await getDocs(collection(db, 'roles'));
        if (rolesSnap.size > 0) return; // Already has roles

        // Create Super Admin role
        const allRoutes = [
            '/', '/categories', '/lots', '/produits',
            '/fournisseurs', '/bl-achat', '/facture-achat',
            '/clients', '/bc-vente', '/bl-vente', '/facture-vente',
            '/stock', '/caisse', '/reglements', '/parametres',
            '/roles', '/users'
        ];
        const permissions = {};
        allRoutes.forEach(r => {
            permissions[r] = { view: true, create: true, edit: true, delete: true };
        });

        await setDoc(doc(db, 'roles', 'super_admin'), {
            name: 'Super Admin',
            description: 'Accès complet à toutes les fonctionnalités',
            isSuperAdmin: true,
            permissions,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        console.log('✅ Super Admin role bootstrapped');
    } catch (e) {
        console.warn('Bootstrap error:', e.message);
    }
}
