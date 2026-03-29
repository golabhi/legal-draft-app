import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export const runtime = 'edge'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar role="lawyer" userEmail={user.email} userName={profile?.full_name} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
