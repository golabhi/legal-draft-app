'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { format } from 'date-fns'

interface UserRow {
  id: string
  email: string | null
  full_name: string | null
  role: string
  created_at: string
  docCount: number
  purchaseCount: number
  caseCount: number
}

export default function UsersTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers]     = useState<UserRow[]>(initialUsers)
  const [search, setSearch]   = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [toast, setToast]     = useState('')

  const supabase = createClient()

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const changeRole = async (userId: string, newRole: string) => {
    setUpdating(userId)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (!error) {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
      showToast(`Role changed to ${newRole}`)
    }
    setUpdating(null)
  }

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)
  })

  const lawyers = filtered.filter((u) => u.role === 'lawyer').length
  const admins  = filtered.filter((u) => u.role === 'admin').length

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy-800 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users',  value: users.length,  color: 'bg-navy-800',   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            { label: 'Lawyers',      value: users.filter((u) => u.role === 'lawyer').length, color: 'bg-blue-600', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
            { label: 'Admins',       value: users.filter((u) => u.role === 'admin').length,  color: 'bg-purple-600', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
            { label: 'Total Docs',   value: users.reduce((s, u) => s + u.docCount, 0), color: 'bg-emerald-600', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`${c.color} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto text-xs text-gray-400">
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">{lawyers} lawyers</span>
              <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg font-medium">{admins} admins</span>
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2fr_2fr_100px_80px_80px_80px_140px] gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
            {['User', 'Email', 'Role', 'Docs', 'Cases', 'Joined', 'Actions'].map((h) => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">{search ? 'No users match your search' : 'No users yet'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((user) => {
                const initials = (user.full_name || user.email || 'U').slice(0, 2).toUpperCase()
                const isAdmin  = user.role === 'admin'
                return (
                  <div key={user.id} className="grid grid-cols-[2fr_2fr_100px_80px_80px_80px_140px] gap-3 items-center px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                    {/* User */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-navy-100 text-navy-700'
                      }`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name || '—'}</p>
                        <p className="text-xs text-gray-400 truncate">{user.id.slice(0, 8)}…</p>
                      </div>
                    </div>

                    {/* Email */}
                    <p className="text-sm text-gray-600 truncate">{user.email || '—'}</p>

                    {/* Role */}
                    <div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.role}
                      </span>
                    </div>

                    {/* Docs */}
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-gray-900">{user.docCount}</span>
                      {user.docCount > 0 && <span className="text-xs text-gray-400">docs</span>}
                    </div>

                    {/* Cases */}
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-gray-900">{user.caseCount}</span>
                      {user.caseCount > 0 && <span className="text-xs text-gray-400">cases</span>}
                    </div>

                    {/* Joined */}
                    <p className="text-xs text-gray-400">{format(new Date(user.created_at), 'dd MMM yyyy')}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-navy-50 hover:bg-navy-100 text-navy-700 rounded-lg transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </Link>
                      {isAdmin ? (
                        <button
                          onClick={() => changeRole(user.id, 'lawyer')}
                          disabled={updating === user.id}
                          className="px-2.5 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {updating === user.id ? '…' : 'Demote'}
                        </button>
                      ) : (
                        <button
                          onClick={() => changeRole(user.id, 'admin')}
                          disabled={updating === user.id}
                          className="px-2.5 py-1.5 text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {updating === user.id ? '…' : 'Make Admin'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
