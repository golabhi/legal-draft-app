import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [
    { count: clientCount },
    { count: caseCount },
    { count: docCount },
    { data: recentCases },
    { data: profile },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('lawyer_id', user.id),
    supabase.from('cases').select('*', { count: 'exact', head: true }).eq('lawyer_id', user.id),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('lawyer_id', user.id),
    supabase.from('cases').select('*, clients(name)').eq('lawyer_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const stats = [
    { label: 'Total Clients', value: clientCount ?? 0, href: '/dashboard/clients', color: 'bg-blue-50', textColor: 'text-blue-600',
      icon: <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { label: 'Active Cases', value: caseCount ?? 0, href: '/dashboard/cases', color: 'bg-orange-50', textColor: 'text-orange-600',
      icon: <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
    { label: 'Documents Generated', value: docCount ?? 0, href: '/dashboard/documents', color: 'bg-green-50', textColor: 'text-green-600',
      icon: <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> },
  ]

  return (
    <div>
      <Header title={`${greeting()}, ${profile?.full_name?.split(' ')[0] || 'Advocate'}`} subtitle="Here's your practice overview" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 ${stat.color} rounded-lg flex items-center justify-center`}>
                  {stat.icon}
                </div>
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Cases */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Recent Cases</h2>
              <Link href="/dashboard/cases" className="text-sm text-navy-700 hover:underline">View all</Link>
            </div>
            {recentCases && recentCases.length > 0 ? (
              <div className="space-y-3">
                {recentCases.map((c: any) => (
                  <Link key={c.id} href={`/dashboard/cases/${c.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                      <p className="text-xs text-gray-500">{c.clients?.name || 'No client'} • {c.case_type || 'General'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      c.status === 'Closed' ? 'bg-gray-100 text-gray-600' :
                      c.status === 'Active' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No cases yet</p>
                <Link href="/dashboard/cases" className="mt-2 inline-block text-sm text-navy-700 hover:underline">Create your first case</Link>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { href: '/dashboard/clients', label: 'Add New Client', color: 'bg-blue-600 hover:bg-blue-700' },
                { href: '/dashboard/cases', label: 'Create New Case', color: 'bg-orange-600 hover:bg-orange-700' },
                { href: '/dashboard/templates', label: 'Browse Templates', color: 'bg-purple-600 hover:bg-purple-700' },
                { href: '/dashboard/documents', label: 'View Documents', color: 'bg-green-600 hover:bg-green-700' },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex items-center justify-between w-full px-4 py-3 ${action.color} text-white rounded-lg text-sm font-medium transition-colors`}
                >
                  {action.label}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
