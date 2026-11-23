import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AuthProvider, RequireAuth } from "./lib/auth.jsx";
import { ToastProvider } from "./components/ui/primitives.jsx";
import { useSettings } from "./lib/settings.js";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import { ForgotPassword, ResetPassword } from "./pages/PasswordPages.jsx";
import JoinParty from "./pages/JoinParty.jsx";
import { sfx } from "./lib/sound.js";

function Redirect({ to }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

const AvatarSelect = lazy(() => import("./pages/AvatarSelect.jsx"));
const PlazaPage = lazy(() => import("./pages/PlazaPage.jsx"));

function useClickSounds() {
  useEffect(() => {
    const onClick = (e) => {
      if (e.target.closest("button, a, [role=tab], [role=radio]")) sfx("click", 0.45);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}

export default function App() {
  const { reducedMotion } = useSettings();
  const location = useLocation();
  useClickSounds();
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? "1" : "0";
  }, [reducedMotion]);

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div className="boot" />}>
            <Routes location={location}>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/join/:inviteCode" element={<JoinParty />} />
              <Route path="/avatar" element={<RequireAuth><AvatarSelect /></RequireAuth>} />
              <Route path="/avatarRegister" element={<Redirect to="/avatar" />} />
              <Route path="/plaza" element={<RequireAuth><PlazaPage /></RequireAuth>} />
              <Route path="/dashboard" element={<Redirect to="/plaza" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
