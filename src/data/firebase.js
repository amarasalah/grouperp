// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA0YXwHpqTHQdAjqC-e_rwJgW9M8YsjVy8",
  authDomain: "groupement-project.firebaseapp.com",
  projectId: "groupement-project",
  storageBucket: "groupement-project.firebasestorage.app",
  messagingSenderId: "746932908534",
  appId: "1:746932908534:web:d324d8e87559cc6bbe97d7",
  measurementId: "G-CQ9F3RG003"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
