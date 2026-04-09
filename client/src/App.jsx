import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/login.jsx";
import Signup from "./pages/signup.jsx";
import Dashboard from "./pages/dashboard.jsx";
import Map from "./pages/map.jsx";
import JoinParty from "./pages/joinParty.jsx";
import AvatarRegister from "./pages/avatarRegister.jsx";
import ForgotPassword from "./pages/forgotPassword.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/map" element={<Map />} />
        <Route path="/join-party" element={<JoinParty />} />
        <Route path="/avatarRegister" element={<AvatarRegister />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </Router>
  );
}

export default App;
