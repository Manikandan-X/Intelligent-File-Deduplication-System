import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Link, Stack, TextField, Typography } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../utils/format";
import AuthShell from "./AuthShell";

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Sign-in failed. Check your email and password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Manage your files and reclaim wasted storage.">
      <form onSubmit={submit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="email" size="medium" />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" size="medium" />
          <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            New here? <Link component={RouterLink} to="/register" fontWeight={700}>Create an account</Link>
          </Typography>
        </Stack>
      </form>
    </AuthShell>
  );
}
