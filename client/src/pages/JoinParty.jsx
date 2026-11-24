import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AuthLayout from "./AuthLayout.jsx";
import { Button, Spinner } from "../components/ui/primitives.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import { api, errMsg } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { themeFor } from "../lib/avatars.js";

export default function JoinParty() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api
      .get(`/party/invite/${inviteCode}`)
      .then((r) => setInfo(r.data))
      .catch(() => setError("This invite link doesn't match a party. Ask your friend to send it again."));
  }, [inviteCode]);

  const join = async () => {
    if (!user) {
      navigate(`/signup?invite=${inviteCode}`);
      return;
    }
    setJoining(true);
    try {
      await api.post(`/party/join/${inviteCode}`);
      navigate("/plaza");
    } catch (err) {
      setError(errMsg(err, "Couldn't join this party."));
      setJoining(false);
    }
  };

  const plaza = info?.owner ? themeFor(info.owner.avatarId) : null;

  return (
    <AuthLayout theme={info?.owner?.avatarId || "frog"}>
      {!info && !error && <Spinner />}
      {error && (
        <>
          <h1 className="auth__title">Invite not found</h1>
          <p className="auth__lede">{error}</p>
          <Button variant="ghost" onClick={() => navigate("/")}>Go to sign in</Button>
        </>
      )}
      {info && !error && (
        <>
          <h1 className="auth__title">You're invited</h1>
          <div className="invite">
            <Avatar avatarId={info.owner?.avatarId} size={64} />
            <div>
              <p className="invite__party">{info.partyName}</p>
              <p className="invite__meta">
                Led by {info.owner?.username}, with {info.memberCount} {info.memberCount === 1 ? "member" : "members"} so far
              </p>
            </div>
          </div>
          {plaza && <p className="auth__lede">Plaza: {plaza.name}</p>}
          <Button variant="primary" size="lg" onClick={join} loading={joining || !ready}>
            {user ? "Join this party" : "Sign up to join"}
          </Button>
        </>
      )}
    </AuthLayout>
  );
}
