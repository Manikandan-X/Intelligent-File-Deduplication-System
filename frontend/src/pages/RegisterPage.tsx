import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Link, Stack, TextField, Typography } from "@mui/material";
import { register } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { useNotify } from "../context/NotifyContext";
import { errorMessage } from "../utils/format";
import AuthShell from "./AuthShell";

export default function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, email: form.email.trim() });
      notify("Account created — sign in to continue");
      navigate("/login");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start finding duplicate files in minutes.">
      <form onSubmit={submit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField label="First name" value={form.first_name} onChange={set("first_name")} required inputProps={{ minLength: 2, maxLength: 100 }} size="medium" />
            <TextField label="Last name" value={form.last_name} onChange={set("last_name")} required inputProps={{ minLength: 2, maxLength: 100 }} size="medium" />
          </Stack>
          <TextField label="Email" type="email" value={form.email} onChange={set("email")} required size="medium" />
          <TextField label="Password" type="password" value={form.password} onChange={set("password")} required helperText="At least 8 characters" inputProps={{ minLength: 8, maxLength: 128 }} size="medium" />
          <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Already registered? <Link component={RouterLink} to="/login" fontWeight={700}>Sign in</Link>
          </Typography>
        </Stack>
      </form>
    </AuthShell>
  );
}
