import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onIdTokenChanged, signOut as fbSignOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { isDemo, exitDemo } from "./demo.js";

const AuthContext = createContext({ user: null, ready: false });

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, ready: !auth });

  useEffect(() => {
    if (!auth) return;
    return onIdTokenChanged(auth, async (user) => {
      if (user) {
        try {
          localStorage.setItem("token", await user.getIdToken());
        } catch {}
      }
      setState({ user, ready: true });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (isDemo()) return children;
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export async function signOut() {
  if (isDemo()) {
    exitDemo();
    return;
  }
  localStorage.removeItem("token");
  if (auth) await fbSignOut(auth);
}
