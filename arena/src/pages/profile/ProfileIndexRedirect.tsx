import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

type Props = {
  fallbackTo?: string;
};

export default function ProfileIndexRedirect({ fallbackTo = "/zone" }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const username = user?.username;
    if (username) {
      navigate(`/profile/${encodeURIComponent(username)}`, { replace: true });
      return;
    }
    navigate(fallbackTo, { replace: true });
  }, [fallbackTo, navigate, user?.username]);

  return null;
}

