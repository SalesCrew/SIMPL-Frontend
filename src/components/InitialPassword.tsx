import { useState, type FormEvent } from "react";
import { changeInitialPassword } from "../data";

export function validateInitialPassword(password: string, repeated: string): string {
  if (password.length < 12 || password.length > 128)
    return "Dein neues Passwort braucht 12 bis 128 Zeichen.";
  if (password !== repeated) return "Die Passwörter stimmen nicht überein.";
  return "";
}

export function InitialPassword({ email, complete }: { email: string; complete: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const validation = validateInitialPassword(password, repeated);
    setError(validation);
    if (validation) return;
    setSaving(true);
    try {
      await changeInitialPassword(email, password, repeated);
      setPassword("");
      setRepeated("");
      await complete();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Bitte versuche es erneut.");
    } finally { setSaving(false); }
  }
  return (
    <main className="password-gate">
      <form className="password-gate-form" onSubmit={submit} aria-busy={saving}>
        <h1>Neues Passwort festlegen</h1>
        <label className="field">
          Neues Passwort
          <input type="password" autoComplete="new-password" autoFocus required
            minLength={12} maxLength={128} value={password} disabled={saving}
            onChange={event => setPassword(event.target.value)} aria-describedby="password-requirements" />
        </label>
        <label className="field">
          Passwort wiederholen
          <input type="password" autoComplete="new-password" required
            minLength={12} maxLength={128} value={repeated} disabled={saving}
            onChange={event => setRepeated(event.target.value)} />
        </label>
        <p id="password-requirements" className="password-gate-hint">Mindestens 12 Zeichen. Nur beim ersten Anmelden nötig.</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={saving}>
          {saving ? "Wird gespeichert …" : "Passwort speichern"}
        </button>
      </form>
    </main>
  );
}
