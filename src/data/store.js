// Firestore Data Store Module
import { db } from './firebase.js';
import {
    collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
    query, orderBy, where, onSnapshot, serverTimestamp, setDoc
} from 'firebase/firestore';

// Helper: timeout wrapper for Firestore calls
function withTimeout(promise, ms = 5000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), ms))
    ]);
}

// ===== GENERIC CRUD =====
export async function getAll(collectionName, orderField = 'createdAt') {
    try {
        const q = query(collection(db, collectionName), orderBy(orderField, 'desc'));
        const snapshot = await withTimeout(getDocs(q));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn(`Error fetching ${collectionName}:`, e.message);
        try {
            const snapshot = await withTimeout(getDocs(collection(db, collectionName)));
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e2) {
            console.warn(`Fallback also failed for ${collectionName}:`, e2.message);
            return [];
        }
    }
}

export async function getById(collectionName, id) {
    const snap = await getDoc(doc(db, collectionName, id));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
}

export async function add(collectionName, data) {
    const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

export async function update(collectionName, id, data) {
    await updateDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: serverTimestamp()
    });
}

export async function remove(collectionName, id) {
    await deleteDoc(doc(db, collectionName, id));
}

export async function setDocument(collectionName, id, data) {
    await setDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

// ===== SETTINGS =====
const DEFAULTS = {
    companyName: 'Groupement des Poteaux Béton',
    companyAddress: '', companyPhone: '', companyEmail: '',
    companyRC: '', companyNIF: '', companyAI: '', companyNIS: '',
    taxRate: 19,
    devisAchatPrefix: 'DA', bcAchatPrefix: 'BCA', blAchatPrefix: 'BLA', factureAchatPrefix: 'FA',
    devisVentePrefix: 'DV', bcVentePrefix: 'BCV', blVentePrefix: 'BLV', factureVentePrefix: 'FV',
    devisAchatSeq: 1, bcAchatSeq: 1, blAchatSeq: 1, factureAchatSeq: 1,
    devisVenteSeq: 1, bcVenteSeq: 1, blVenteSeq: 1, factureVenteSeq: 1
};

export async function getSettings() {
    try {
        const snap = await withTimeout(getDoc(doc(db, 'settings', 'general')));
        if (snap.exists()) return snap.data();
        await setDoc(doc(db, 'settings', 'general'), DEFAULTS);
        return DEFAULTS;
    } catch (e) {
        console.warn('Settings fetch failed, using defaults:', e.message);
        return { ...DEFAULTS };
    }
}

export async function saveSettings(data) {
    await setDoc(doc(db, 'settings', 'general'), data, { merge: true });
}

export async function getNextNumber(prefixKey) {
    const settings = await getSettings();
    const prefix = settings[prefixKey] || 'DOC';
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const dateStr = `${mm}-${yy}`;
    const counterKey = `${prefix}-${dateStr}`;

    // Get or create monthly counter
    try {
        const counterRef = doc(db, 'counters', counterKey);
        const snap = await withTimeout(getDoc(counterRef));
        let seq = 1;
        if (snap.exists()) {
            seq = (snap.data().seq || 0) + 1;
        }
        await setDoc(counterRef, { seq, date: dateStr });
        return `${prefix}-${dateStr}-${String(seq).padStart(3, '0')}`;
    } catch (e) {
        // Fallback: use timestamp-based number
        const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
        return `${prefix}-${dateStr}-${seq}`;
    }
}

// ===== QUERY HELPERS =====
export async function getByField(collectionName, field, value) {
    const q = query(collection(db, collectionName), where(field, '==', value));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ===== LISTENERS =====
export function onCollectionChange(collectionName, callback) {
    return onSnapshot(collection(db, collectionName), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(data);
    });
}

// ===== STOCK HELPERS =====
export async function updateStock(produitId, quantite, type, reference) {
    // type: 'entree' (Achat BL) or 'sortie' (Vente BL)
    await add('stock_mouvements', {
        produitId,
        quantite,
        type,
        reference,
        date: new Date().toISOString()
    });
    // Update product stock
    const produit = await getById('produits', produitId);
    if (produit) {
        const currentStock = produit.stock || 0;
        const newStock = type === 'entree' ? currentStock + quantite : currentStock - quantite;
        await update('produits', produitId, { stock: Math.max(0, newStock) });
    }
}

// ===== CAISSE HELPERS =====
export async function addCaisseMovement(montant, type, description, reference) {
    await add('caisse', {
        montant,
        type, // 'entree' or 'sortie'
        description,
        reference,
        date: new Date().toISOString()
    });
}

// ===== FACTURE ↔ BL HELPERS =====
/**
 * Get how much quantity from each BL line has already been invoiced.
 * Returns a Map: blId -> { lineIndex -> totalFacturedQty }
 */
export async function getFacturedQtyMap(factureCollection) {
    const factures = await getAll(factureCollection).catch(() => []);
    const map = {}; // { blId: { lineIdx: qty } }
    factures.forEach(f => {
        (f.blAllocations || []).forEach(a => {
            if (!map[a.blId]) map[a.blId] = {};
            map[a.blId][a.lineIdx] = (map[a.blId][a.lineIdx] || 0) + (a.qty || 0);
        });
    });
    return map;
}

// ===== CASCADING DELETE =====
export async function deleteFactureWithReglements(factureCollection, factureId) {
    // Delete associated reglements
    const reglements = await getAll('reglements').catch(() => []);
    const related = reglements.filter(r => r.factureId === factureId);
    for (const r of related) {
        await remove('reglements', r.id);
    }
    // Delete the facture itself
    await remove(factureCollection, factureId);
    return related.length;
}


