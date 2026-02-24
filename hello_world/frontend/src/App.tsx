import { useState, useEffect, useRef } from "react";
import {
  User,
  LogEntry,
  DbInfo,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getLogs,
  getDbInfo,
} from "./api";

const emptyForm = { name: "", age: "", city: "" };

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const refreshAll = async () => {
    const [u, l, d] = await Promise.all([getUsers(), getLogs(), getDbInfo()]);
    setUsers(u);
    setLogs(l);
    setDbInfo(d);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.age || !form.city) return;
    await createUser({ name: form.name, age: Number(form.age), city: form.city });
    setForm(emptyForm);
    refreshAll();
  };

  const handleUpdate = async () => {
    if (!editId || !editForm.name || !editForm.age || !editForm.city) return;
    await updateUser(editId, {
      name: editForm.name,
      age: Number(editForm.age),
      city: editForm.city,
    });
    setEditId(null);
    setEditForm(emptyForm);
    refreshAll();
  };

  const handleDelete = async (id: string) => {
    await deleteUser(id);
    refreshAll();
  };

  const startEdit = (u: User) => {
    setEditId(u._id);
    setEditForm({ name: u.name, age: String(u.age), city: u.city });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleUpdate();
    if (e.key === "Escape") setEditId(null);
  };

  const opClass = (op: string) => op.toLowerCase();

  return (
    <div className="app">
      <h1 className="title">MongoDB CRUD</h1>

      <div className="form-card">
        <h2>Add User</h2>
        <div className="form-row">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onKeyDown={handleKeyDown}
          />
          <input
            placeholder="Age"
            type="number"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            onKeyDown={handleKeyDown}
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            onKeyDown={handleKeyDown}
          />
          <button className="btn btn-add" onClick={handleCreate}>
            Add
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>City</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <span>:(</span>
                    No users yet
                  </div>
                </td>
              </tr>
            )}
            {users.map((u) =>
              editId === u._id ? (
                <tr key={u._id}>
                  <td>
                    <input
                      className="edit-input"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      onKeyDown={handleEditKeyDown}
                    />
                  </td>
                  <td>
                    <input
                      className="edit-input"
                      type="number"
                      value={editForm.age}
                      onChange={(e) =>
                        setEditForm({ ...editForm, age: e.target.value })
                      }
                      onKeyDown={handleEditKeyDown}
                    />
                  </td>
                  <td>
                    <input
                      className="edit-input"
                      value={editForm.city}
                      onChange={(e) =>
                        setEditForm({ ...editForm, city: e.target.value })
                      }
                      onKeyDown={handleEditKeyDown}
                    />
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-save" onClick={handleUpdate}>
                        Save
                      </button>
                      <button
                        className="btn btn-cancel"
                        onClick={() => setEditId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.age}</td>
                  <td>{u.city}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn-edit"
                        onClick={() => startEdit(u)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-delete"
                        onClick={() => handleDelete(u._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {users.length > 0 && (
        <p className="status-bar">{users.length} user(s) in database</p>
      )}

      <div className="mongo-panel">
        <div className="mongo-panel-header" onClick={() => setPanelOpen(!panelOpen)}>
          <h3>MongoDB Operations Log</h3>
          <span className="toggle">{panelOpen ? "Hide" : "Show"}</span>
        </div>
        {panelOpen && (
          <>
            {dbInfo && (
              <div className="db-info">
                <span className="db-info-item">
                  <strong>Server:</strong> {dbInfo.server}
                </span>
                <span className="db-info-item">
                  <strong>Host:</strong> {dbInfo.host}:{dbInfo.port}
                </span>
                <span className="db-info-item">
                  <strong>DB:</strong> {dbInfo.database}
                </span>
                <span className="db-info-item">
                  <strong>Collection:</strong> {dbInfo.collection}
                </span>
                <span className="db-info-item">
                  <strong>Docs:</strong> {dbInfo.documents}
                </span>
              </div>
            )}
            <div className="log-list">
              {logs.length === 0 && (
                <div className="log-empty">No operations yet</div>
              )}
              {logs.map((log, i) => (
                <div className="log-entry" key={i}>
                  <span className="log-time">{log.time}</span>
                  <span className={`log-op ${opClass(log.op)}`}>{log.op}</span>
                  <span className="log-detail">{log.detail}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
