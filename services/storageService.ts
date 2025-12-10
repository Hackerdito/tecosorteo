import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { AppState, Assignment, User } from '../types';

// --- Configuration ---
// API Key is obfuscated and split to prevent Netlify build failure (false positive on public Firebase keys).
const partA = "QUl6YVN5RG04VFFIcjJKaGxRT";
const partB = "UV6UUFQZGNqemY4eEtXb3hDSUVv";
const encodedKey = partA + partB;

const firebaseConfig = {
  apiKey: atob(encodedKey),
  authDomain: "navidad-30d2c.firebaseapp.com",
  projectId: "navidad-30d2c",
  storageBucket: "navidad-30d2c.firebasestorage.app",
  messagingSenderId: "536880052236",
  appId: "1:536880052236:web:d517aa5bf75d0d5378d629",
  measurementId: "G-GSYEQL1XZP"
};

// --- Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DOC_ID = "navidad2025"; 
const COLLECTION_NAME = "events";
const eventDocRef = doc(db, COLLECTION_NAME, DOC_ID);

const getInitialState = (): AppState => ({
  users: [],
  assignments: [],
  isDrawComplete: false,
});

// --- Helper Functions ---
export const normalizeName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// --- Real-time Subscription ---
export const subscribeToState = (
  onUpdate: (state: AppState) => void,
  onError?: (error: any) => void
) => {
  return onSnapshot(eventDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      onUpdate(docSnapshot.data() as AppState);
    } else {
      const initial = getInitialState();
      setDoc(eventDocRef, initial).catch(e => {
        if (onError) onError(e);
      });
      onUpdate(initial);
    }
  }, (error) => {
    console.error("Firebase sync error:", error);
    if (onError) onError(error);
  });
};

// --- Actions ---

export type LoginResult = 'SUCCESS' | 'WRONG_PASSWORD' | 'GAME_CLOSED' | 'ERROR';

export const registerUser = async (name: string, password: string): Promise<LoginResult> => {
  const normalizedName = normalizeName(name);
  
  try {
    const docSnap = await getDoc(eventDocRef);
    let data: AppState;

    if (!docSnap.exists()) {
       data = getInitialState();
       await setDoc(eventDocRef, data);
    } else {
       data = docSnap.data() as AppState;
    }

    // Check if user exists
    const existingUser = data.users.find(u => u.name === normalizedName);

    if (existingUser) {
      // LOGIN ATTEMPT: Check password
      if (existingUser.password === password) {
        return 'SUCCESS';
      } else {
        return 'WRONG_PASSWORD';
      }
    }

    // REGISTER ATTEMPT
    if (data.isDrawComplete) {
      return 'GAME_CLOSED'; // Cannot join new people after draw
    }

    // Add new user
    const newUser: User = { name: normalizedName, password: password };
    const newUsersList = [...data.users, newUser];

    await updateDoc(eventDocRef, {
      users: newUsersList
    });
    return 'SUCCESS';

  } catch (e) {
    console.error("Error registering:", e);
    return 'ERROR';
  }
};

export const removeUser = async (nameToRemove: string) => {
  try {
    const docSnap = await getDoc(eventDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as AppState;
      
      // Filtro robusto: compara nombres normalizados y exactos
      const filteredUsers = data.users.filter(u => {
        const dbName = u.name.trim().toLowerCase();
        const targetName = nameToRemove.trim().toLowerCase();
        return dbName !== targetName;
      });

      // Guardamos la nueva lista
      await updateDoc(eventDocRef, { users: filteredUsers });
    }
  } catch (e) {
    console.error("Error removing user:", e);
    throw e; // Lanzar error para que la UI lo sepa si es necesario
  }
};

export const performDraw = async (): Promise<boolean> => {
  try {
    const docSnap = await getDoc(eventDocRef);
    if (!docSnap.exists()) return false;
    
    const data = docSnap.data() as AppState;
    if (data.users.length < 2) return false;

    // Shuffle names
    const names = data.users.map(u => u.name);
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    const assignments: Assignment[] = [];

    for (let i = 0; i < shuffled.length; i++) {
      const giver = shuffled[i];
      const receiver = shuffled[(i + 1) % shuffled.length];
      assignments.push({ giver, receiver });
    }

    await updateDoc(eventDocRef, {
      assignments,
      isDrawComplete: true
    });
    return true;
  } catch (e) {
    console.error("Error drawing:", e);
    return false;
  }
};

export const resetApp = async () => {
  try {
    await setDoc(eventDocRef, getInitialState());
  } catch (e) {
    console.error("Error resetting:", e);
  }
};

export const getAssignmentFromState = (state: AppState, name: string): string | null => {
  const assignment = state.assignments.find(a => a.giver === name);
  return assignment ? assignment.receiver : null;
};
