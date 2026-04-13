import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/login.jsx";
import Signup from "./pages/signup.jsx";
import Dashboard from "./pages/dashboard.jsx";
import AvatarRegister from "./pages/avatarRegister.jsx";
import JoinParty from "./pages/joinParty.jsx";
import ForgotPassword from "./pages/forgotPassword.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/avatarRegister" element={<AvatarRegister />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/join/:inviteCode" element={<JoinParty />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </Router>
  );
}

export default App;
