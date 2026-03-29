import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id: userId } = await params

  const [
    { data: profile },
    { data: documents },
    { data: purchases },
    { count: casesCount },
    { count: clientsCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase
      .from('documents')
      .select('*, templates(name), cases(title)')
      .eq('lawyer_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('purchases')
      .select('*, templates(name), template_groups(name)')
      .eq('lawyer_id', userId)
      .order('purchase_date', { ascending: false }),
    supabase.from('cases').select('*', { count: 'exact', head: true }).eq('lawyer_id', userId),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('lawyer_id', userId),
  ])

  if (!profile) {
    return (
      <div className="p-6">
        <p className="text-gray-600 mb-4">User not found.</p>
        <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Users
        </Link>
      </div>
    )
  }

  // Compute template usage stats from documents
  const templateUsageMap: Record<string, { templateName: string; count: number; lastUsed: string }> = {}
  for (const doc of documents ?? []) {
    const tid = doc.template_id
    if (!tid) continue
    const name = (doc as any).templates?.name ?? 'Unknown Template'
    if (!templateUsageMap[tid]) {
      templateUsageMap[tid] = { templateName: name, count: 0, lastUsed: doc.created_at ?? '' }
    }
    templateUsageMap[tid].count++
    if (doc.created_at && doc.created_at > templateUsageMap[tid].lastUsed) {
      templateUsageMap[tid].lastUsed = doc.created_at
    }
  }
  const templateUsage = Object.values(templateUsageMap).sort((a, b) => b.count - a.count)
  const maxUsageCount = templateUsage[0]?.count ?? 1

  // Compute total spent
  const totalSpent = (purchases ?? []).reduce((sum: number, p: any) => sum + (p.amount_paid ?? 0), 0)

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : (profile.email?.charAt(0) ?? 'U').toUpperCase()

  return (
    <div>
      <Header
        title={profile.full_name || profile.email || 'User Detail'}
        subtitle="User activity and profile"
        actions={
          <Link
            href="/admin/users"
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Users
          </Link>
        }
      />

      <div className="p-6 space-y-6">

        {/* Row 1: Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{documents?.length ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Documents Generated</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{casesCount ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Cases Created</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{clientsCount ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Clients Added</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">₹{totalSpent.toLocaleString('en-IN')}</p>
            <p className="text-sm text-gray-500 mt-1">Total Spent</p>
          </div>
        </div>

        {/* Row 2: Profile Card + Template Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Profile Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Profile Information</h2>
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xl font-bold"
                style={{ backgroundColor: '#1e3a5f' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{profile.full_name || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">{profile.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    profile.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {profile.role}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-100 space-y-1">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Joined: </span>
                    {profile.created_at ? format(new Date(profile.created_at), 'MMMM d, yyyy') : '—'}
                  </p>
                  <p className="text-xs text-gray-400 font-mono break-all">ID: {profile.id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Template Usage */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Template Usage</h2>
            {templateUsage.length > 0 ? (
              <div className="space-y-3">
                {templateUsage.map((t, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate max-w-[60%]">{t.templateName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {t.lastUsed ? format(new Date(t.lastUsed), 'MMM d, yyyy') : '—'}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{t.count}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(t.count / maxUsageCount) * 100}%`,
                          backgroundColor: '#1e3a5f',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-10 h-10 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-400">No documents generated yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Documents Table + Purchase History Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Documents Generated */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Documents Generated</h2>
            </div>
            {documents && documents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Template</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Case</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {documents.map((doc: any) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[140px] truncate">
                          {doc.file_name || 'Untitled'}
                        </td>
                        <td className="px-4 py-3">
                          {doc.templates?.name ? (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {doc.templates.name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">
                          {(doc as any).cases?.title || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {doc.created_at ? format(new Date(doc.created_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No documents generated</p>
            )}
          </div>

          {/* Purchase History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Purchase History</h2>
            </div>
            {purchases && purchases.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Purchased</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchases.map((p: any) => {
                      const isGroup = !!p.template_groups?.name
                      const itemName = p.templates?.name || p.template_groups?.name || 'Unknown'
                      const isRevoked = p.status === 'revoked' || p.revoked === true
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 max-w-[140px] truncate">
                            {itemName}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isGroup
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}>
                              {isGroup ? 'Group' : 'Template'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            ₹{(p.amount_paid ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {p.purchase_date ? format(new Date(p.purchase_date), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {p.expires_at ? format(new Date(p.expires_at), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isRevoked
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {isRevoked ? 'Revoked' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No purchases found</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
