import type { Ctx, Role } from '@/lib/family'
import { ROLE_LABEL } from '@/lib/family'
import { inviteMember, setRole, removeMember, cancelInvite } from '@/app/actions/family'

const ROLES = Object.keys(ROLE_LABEL) as Role[]

export default async function MembersPanel({ ctx }: { ctx: Ctx }) {
  const { supabase, user, familyId, role } = ctx
  const isAdmin = role === 'admin'
  const { data: members } = await supabase
    .from('members').select('user_id, email, display_name, role')
    .eq('family_id', familyId).order('created_at')
  const { data: invites } = isAdmin
    ? await supabase.from('invites').select('id, email, role').eq('family_id', familyId)
    : { data: [] }

  return (
    <section className="panel" aria-labelledby="p-fam">
      <h2 id="p-fam">Familia</h2>
      <ul className="items">
        {members?.map((m) => (
          <li key={m.user_id}>
            <span className="t">{m.display_name || m.email}</span>
            {isAdmin && m.user_id !== user.id ? (
              <div className="inline">
                <form action={setRole} className="inline">
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <select name="role" defaultValue={m.role} aria-label={`Rol de ${m.display_name || m.email}`}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button className="btn ghost">Guardar</button>
                </form>
                <form action={removeMember}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button className="btn danger">Quitar</button>
                </form>
              </div>
            ) : (
              <span className="tag">{ROLE_LABEL[m.role as Role]}</span>
            )}
          </li>
        ))}
        {invites?.map((i) => (
          <li key={i.id}>
            <span className="t">{i.email} <span className="muted">· invitación pendiente</span></span>
            <form action={cancelInvite}>
              <input type="hidden" name="id" value={i.id} />
              <button className="btn danger">Cancelar</button>
            </form>
          </li>
        ))}
      </ul>
      {isAdmin && (
        <details>
          <summary>Invitar a alguien</summary>
          <form action={inviteMember} className="stack">
            <div>
              <label htmlFor="inv-email">Correo electrónico</label>
              <input id="inv-email" name="email" type="email" required />
            </div>
            <div>
              <label htmlFor="inv-role">Rol</label>
              <select id="inv-role" name="role" defaultValue="viewer">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div><button className="btn">Invitar</button></div>
            <p className="muted">Esa persona entra con ese correo y verá la familia automáticamente.</p>
          </form>
        </details>
      )}
    </section>
  )
}
