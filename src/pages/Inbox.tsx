import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Legacy /inbox route — redirects to /app which has the full bottom navigation.
 */
export default function Inbox() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/app", { replace: true });
  }, [navigate]);

  return null;
}