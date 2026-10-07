import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Grid, Stack, TextField, Typography } from "@mui/material";
import { changePassword, updateMe } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { useNotify } from "../context/NotifyContext";
import { errorMessage } from "../utils/format";
import PageHeader from "../components/PageHeader";

export default function ProfilePage() {
  const { user, setUser, isAdmin } = useAuth();
  const notify = useNotify();
  const [profile, setProfile] = useState({ first_name: user?.first_name ?? "", last_name: user?.last_name ?? "", email: user?.email ?? "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setProfileError(null);
    try { setUser(await updateMe(profile)); notify("Profile updated"); } catch (err) { setProfileError(errorMessage(err)); } finally { setBusy(false); }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault(); setPwError(null);
    if (pw.next !== pw.confirm) { setPwError("New password and confirmation do not match."); return; }
    setBusy(true);
    try { await changePassword(pw.current, pw.next); notify("Password changed"); setPw({ current: "", next: "", confirm: "" }); }
    catch (err) { setPwError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Profile" subtitle={isAdmin ? "Administrator account" : "Your account details and password."} />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Account details</Typography>
            <form onSubmit={saveProfile}>
              <Stack spacing={2}>
                {profileError && <Alert severity="error">{profileError}</Alert>}
                <Stack direction="row" spacing={1.5}>
                  <TextField label="First name" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} required fullWidth />
                  <TextField label="Last name" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} required fullWidth />
                </Stack>
                <TextField label="Email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required />
                <Button type="submit" variant="contained" disabled={busy} sx={{ alignSelf: "flex-start" }}>Save changes</Button>
              </Stack>
            </form>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Change password</Typography>
            <form onSubmit={savePassword}>
              <Stack spacing={2}>
                {pwError && <Alert severity="error">{pwError}</Alert>}
                <TextField label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" />
                <TextField label="New password" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required helperText="At least 8 characters" inputProps={{ minLength: 8 }} autoComplete="new-password" />
                <TextField label="Confirm new password" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" />
                <Button type="submit" variant="contained" disabled={busy} sx={{ alignSelf: "flex-start" }}>Update password</Button>
              </Stack>
            </form>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
