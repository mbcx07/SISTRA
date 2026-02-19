
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  query, 
  where, 
  orderBy,
  limit
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { Tramite, Bitacora, Role, User } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyA_V82BKDeUOHExz-zUiazBxsfP6eXadmU",
  authDomain: "prestaciones-d3f9a.firebaseapp.com",
  projectId: "prestaciones-d3f9a",
  storageBucket: "prestaciones-d3f9a.firebasestorage.app",
  messagingSenderId: "510072300294",
  appId: "1:510072300294:web:213688c873acb375f47487",
  measurementId: "G-R20P8ZRHEE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserProfile: User | null = null;

export const ensureSession = (): Promise<User> => {
  return new Promise((resolve, reject) => {
    // Si ya tenemos el perfil cargado, no volvemos a suscribirnos
    if (currentUserProfile) {
      resolve(currentUserProfile);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      if (fUser) {
        unsubscribe(); 
        try {
          const userDoc = await getDoc(doc(db, "usuarios", fUser.uid));
          
          if (!userDoc.exists()) {
            const newUser: User = {
              id: fUser.uid,
              nombre: "Operador de Unidad",
              role: Role.CAPTURISTA_UNIDAD,
              unidad: "UMF-01",
              ooad: "03 - BAJA CALIFORNIA SUR"
            };
            try {
              await setDoc(doc(db, "usuarios", fUser.uid), newUser);
            } catch (e) {
              console.warn("Firestore: No se pudo escribir perfil, usando local.");
            }
            currentUserProfile = newUser;
          } else {
            currentUserProfile = userDoc.data() as User;
          }
          resolve(currentUserProfile!);
        } catch (error) {
          console.error("DB: Error cargando perfil:", error);
          const fallback: User = {
            id: fUser.uid,
            nombre: "Usuario Invitado",
            role: Role.CAPTURISTA_UNIDAD,
            unidad: "UMF-01",
            ooad: "03 - BAJA CALIFORNIA SUR"
          };
          currentUserProfile = fallback;
          resolve(fallback);
        }
      } else {
        signInAnonymously(auth).catch((error) => {
          unsubscribe();
          if (error.code === 'auth/configuration-not-found') {
            const configErrorUser: User = {
              id: 'AUTH_CONFIG_REQUIRED',
              nombre: "SISTEMA (SIN CONFIGURAR)",
              role: Role.ADMIN_SISTEMA,
              unidad: "N/A",
              ooad: "N/A"
            };
            currentUserProfile = configErrorUser;
            resolve(configErrorUser);
          } else {
            reject(error);
          }
        });
      }
    });
  });
};

export const dbService = {
  async getTramites(): Promise<Tramite[]> {
    try {
      const user = await ensureSession();
      if (user.id === 'AUTH_CONFIG_REQUIRED') return [];

      let q;
      if (user.role === Role.CAPTURISTA_UNIDAD) {
        q = query(
          collection(db, "tramites"), 
          where("beneficiario.entidadLaboral", "==", user.unidad),
          orderBy("fechaCreacion", "desc"),
          limit(100)
        );
      } else {
        q = query(
          collection(db, "tramites"), 
          orderBy("fechaCreacion", "desc"), 
          limit(100)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Tramite[];
      
      return Array.isArray(results) ? results : [];
    } catch (error: any) {
      console.error("DB Error (getTramites):", error);
      // Nunca lanzar, devolver vacío para evitar crash de UI
      return [];
    }
  },

  async saveTramite(tramite: Partial<Tramite>): Promise<string> {
    const user = await ensureSession();
    if (user.id === 'AUTH_CONFIG_REQUIRED') throw new Error("Auth no configurado.");

    try {
      if (tramite.id) {
        const docRef = doc(db, "tramites", tramite.id);
        const { id, ...data } = tramite;
        await updateDoc(docRef, data);
        return tramite.id;
      } else {
        const docRef = await addDoc(collection(db, "tramites"), {
          ...tramite,
          creadorId: user.id,
          unidad: user.unidad
        });
        return docRef.id;
      }
    } catch (error: any) {
      console.error("DB Error (saveTramite):", error);
      throw error;
    }
  },

  async getBitacora(tramiteId: string): Promise<Bitacora[]> {
    try {
      const q = query(
        collection(db, "bitacora"), 
        where("tramiteId", "==", tramiteId),
        orderBy("fecha", "asc")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Bitacora[];
    } catch (error: any) {
      return [];
    }
  },

  async addBitacora(bitacora: Omit<Bitacora, 'id' | 'fecha'>) {
    const user = await ensureSession();
    try {
      await addDoc(collection(db, "bitacora"), {
        ...bitacora,
        fecha: new Date().toISOString(),
        usuario: user.nombre
      });
    } catch (error: any) {}
  }
};
