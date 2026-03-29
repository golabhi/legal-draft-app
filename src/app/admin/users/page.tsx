import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import UsersTable from './UsersTable'

export default async function UsersPage() {
  const supabase = await createClient()

  const [
    { data: profiles },
    { data: documents },
    { data: purchases },
    { data: cases },
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('documents').select('lawyer_id'),
    supabase.from('purchases').select('lawyer_id'),
    supabase.from('cases').select('lawyer_id'),
  ])

  // Attach counts to each profile
  const users = (profiles || []).map((p) => ({
    id:            p.id,
    email:         p.email,
    full_name:     p.full_name,
    role:          p.role,
    created_at:    p.created_at,
    docCount:      (documents || []).filter((d) => d.lawyer_id === p.id).length,
    purchaseCount: (purchases  || []).filter((pu) => pu.lawyer_id === p.id).length,
    caseCount:     (cases      || []).filter((c) => c.lawyer_id === p.id).length,
  }))

  return (
    <div>
      <Header title="User Management" subtitle="Manage registered lawyers and admins" />
      <UsersTable initialUsers={users} />
    </div>
  )
}
