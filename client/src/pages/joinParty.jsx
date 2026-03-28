import React, { use, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function JoinParty() {
  // grab invite code from url params
  const { inviteToken } = useParams();
  const navigate = useNavigate();

  // sign up states
  const [formData, setFormData] = useState({
    usename: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/api/join-party", {
        ...formData,
        token: inviteToken,
      });
      alert("Welcome to the party!");
      navigate("/avatarRegister");
    } catch (err) {
      alert(
        "Failed to join party. Please check your invite link and try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="join-page">
      <div className="invitation-container">
        <h2> You've been invited! </h2>
        <p>
          {" "}
          A friend has invited you to join their party. Please create an account
          to get started!{" "}
        </p>
        <form onSubmit={handleJoin}>
          {/* Username Input */}
          <input
            type="text"
            placeholder="Choose a Username"
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            required
          />

          {/* Email Input */}
          <input
            type="email"
            placeholder="Your Email"
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
          />

          {/* Password Input */}
          <input
            type="password"
            placeholder="Create a Password"
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Joining..." : "Accept Invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinParty;
