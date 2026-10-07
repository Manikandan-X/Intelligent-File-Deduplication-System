import { useCallback, useEffect, useState } from "react";
import {
  Alert, Avatar, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, LinearProgress,
  MenuItem, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import GroupIcon from "@mui/icons-material/GroupOutlined";
import { changeUserRole, createUser, deleteUser, listUsers, setUserActive, updateUser } from "../api/endpoints";
import type { Paginated, User } from "../types";
import { errorMessage, formatDate } from "../utils/format";
import { palette } from "../theme";
import { ADMIN_ROLE_ID, useAuth } from "../context/AuthContext";
import { useNotify } from "../context/NotifyContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const USER_ROLE_ID = Number(import.meta.env.VITE_USER_ROLE_ID ?? 2);
const ROLES = [{ id: ADMIN_ROLE_ID, name: "Admin" }, { id: USER_ROLE_ID, name: "User" }];

type FormState = { first_name: string; last_name: string; email: string; password: string; role_id: number };
const empty: FormState = { first_name: "", last_name: "", email: "", password: "", role_id: USER_ROLE_ID };

export default function UsersPage() {
  const { user: me } = useAuth();
  const notify = useNotify();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<User | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listUsers({ page, page_size: pageSize, search: debounced || undefined, is_active: active === "" ? undefined : active === "true" }));
      setError(null);
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [page, pageSize, debounced, active]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(empty); setFormError(null); setEditing("new"); };
  const openEdit = (u: User) => { setForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, password: "", role_id: u.role_id }); setFormError(null); setEditing(u); };

  const save = async () => {
    setSaving(true); setFormError(null);
    try {
      if (editing === "new") {
        await createUser(form);
        notify("User created");
      } else if (editing) {
        await updateUser(editing.id, { first_name: form.first_name, last_name: form.last_name, email: form.email });
        if (form.role_id !== editing.role_id) await changeUserRole(editing.id, form.role_id);
        notify("User updated");
      }
      setEditing(null); load();
    } catch (e) { setFormError(errorMessage(e)); } finally { setSaving(false); }
  };

  const toggleActive = async (u: User) => {
    try { await setUserActive(u.id, !u.is_active); notify(u.is_active ? "User deactivated" : "User activated"); load(); }
    catch (e) { notify(errorMessage(e), "error"); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await deleteUser(toDelete.id); notify("User deleted"); setToDelete(null); load(); }
    catch (e) { notify(errorMessage(e), "error"); setToDelete(null); }
  };

  const roleName = (id: number) => ROLES.find((r) => r.id === id)?.name ?? `Role ${id}`;
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: k === "role_id" ? Number(e.target.value) : e.target.value });

  return (
    <>
      <PageHeader title="Users" subtitle="Create accounts, change roles and deactivate access." actions={<Button variant="contained" startIcon={<PersonAddIcon />} onClick={openNew}>Add user</Button>} />
      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth />
          <TextField select label="Status" value={active} onChange={(e) => { setActive(e.target.value as "" | "true" | "false"); setPage(1); }} sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem><MenuItem value="true">Active</MenuItem><MenuItem value="false">Inactive</MenuItem>
          </TextField>
        </Stack>
      </Card>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card sx={{ overflow: "hidden" }}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead><TableRow><TableCell>User</TableCell><TableCell>Role</TableCell><TableCell>Joined</TableCell><TableCell>Active</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {data?.items.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ width: 34, height: 34, bgcolor: palette.deep, fontSize: 13 }}>{u.first_name[0]}{u.last_name[0]}</Avatar>
                      <div><Typography fontWeight={700}>{u.first_name} {u.last_name}</Typography><Typography variant="body2" color="text.secondary">{u.email}</Typography></div>
                    </Stack>
                  </TableCell>
                  <TableCell><Chip size="small" label={roleName(u.role_id)} sx={{ bgcolor: u.role_id === ADMIN_ROLE_ID ? `${palette.original}22` : `${palette.tide}22`, color: u.role_id === ADMIN_ROLE_ID ? palette.original : palette.tide }} /></TableCell>
                  <TableCell>{formatDate(u.created_at)}</TableCell>
                  <TableCell><Switch checked={u.is_active} onChange={() => toggleActive(u)} disabled={u.id === me?.id} inputProps={{ "aria-label": `Toggle ${u.email} active` }} /></TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit"><IconButton aria-label="Edit user" onClick={() => openEdit(u)}><EditIcon /></IconButton></Tooltip>
                    <Tooltip title={u.id === me?.id ? "You cannot delete yourself" : "Delete"}><span><IconButton aria-label="Delete user" color="error" disabled={u.id === me?.id} onClick={() => setToDelete(u)}><DeleteIcon /></IconButton></span></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!loading && !data?.items.length && <EmptyState icon={<GroupIcon />} title="No users found" />}
        <TablePagination component="div" count={data?.total ?? 0} page={page - 1} rowsPerPage={pageSize} rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p + 1)} onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} />
      </Card>

      <Dialog open={!!editing} onClose={() => !saving && setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>{editing === "new" ? "Add user" : "Edit user"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" spacing={1.5}>
              <TextField label="First name" value={form.first_name} onChange={set("first_name")} required />
              <TextField label="Last name" value={form.last_name} onChange={set("last_name")} required />
            </Stack>
            <TextField label="Email" type="email" value={form.email} onChange={set("email")} required />
            {editing === "new" && <TextField label="Password" type="password" value={form.password} onChange={set("password")} helperText="At least 8 characters" required />}
            <TextField select label="Role" value={form.role_id} onChange={set("role_id")} disabled={editing !== "new" && (editing as User)?.id === me?.id} helperText={editing !== "new" && (editing as User)?.id === me?.id ? "You cannot change your own role" : undefined}>
              {ROLES.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)}>
        <DialogTitle>Delete this user?</DialogTitle>
        <DialogContent><DialogContentText>{toDelete?.first_name} {toDelete?.last_name} ({toDelete?.email}) will lose access. This cannot be undone.</DialogContentText></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button color="inherit" onClick={() => setToDelete(null)}>Cancel</Button><Button color="error" variant="contained" onClick={confirmDelete}>Delete user</Button></DialogActions>
      </Dialog>
    </>
  );
}
