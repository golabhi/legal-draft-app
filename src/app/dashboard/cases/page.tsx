'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import Link from 'next/link'
import { format } from 'date-fns'

interface Case {
  id: string
  title: string
  case_type: string | null
  status: string
  notes: string | null
  created_at: string
  client_id: string | null
  clients?: { name: string }
}

interface Client {
  id: string
  name: string
}

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Case | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState({ title: '', case_type: '', status: 'Drafting', notes: '', client_id: '' })

  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: cData }, { data: clientData }] = await Promise.all([
      supabase.from('cases').select('*, clients(name)').eq('lawyer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').eq('lawyer_id', user.id).order('name'),
    ])
    setCases(cData || [])
    setClients(clientData || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', case_type: '', status: 'Drafting', notes: '', client_id: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (c: Case) => {
    setEditing(c)
    setForm({ title: c.title, case_type: c.case_type || '', status: c.status, notes: c.notes || '', client_id: c.client_id || '' })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      title: form.title,
      case_type: form.case_type || null,
      status: form.status,
      notes: form.notes || null,
      client_id: form.client_id || null,
    }

    if (editing) {
      const { error } = await supabase.from('cases').update(payload).eq('id', editing.id)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('cases').insert({ ...payload, lawyer_id: user.id })
      if (error) { setError(error.message); setSaving(false); return }
    }

    await fetchData()
    setModalOpen(false)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this case?')) return
    await supabase.from('cases').delete().eq('id', id)
    await fetchData()
  }

  const filtered = cases.filter((c) => statusFilter === 'all' || c.status === statusFilter)

  const statusOptions = ['Drafting', 'Active', 'Pending', 'Closed']
  const caseTypes = ['Civil', 'Criminal', 'Property', 'Family', 'Corporate', 'Consumer', 'Labour', 'Tax', 'Other']

  const statusColors: Record<string, string> = {
    Drafting: 'bg-yellow-100 text-yellow-700',
    Active: 'bg-green-100 text-green-700',
    Pending: 'bg-blue-100 text-blue-700',
    Closed: 'bg-gray-100 text-gray-600',
  }

  return (
    <div>
      <Header
        title="Cases"
        subtitle="Manage your legal cases"
        actions={
          <div className="flex items-center gap-3">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500">
              <option value="all">All Status</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={openCreate} className="flex items-center gap-2 bg-navy-800 hover:bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Case
            </button>
          </div>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-500 font-medium">No cases found</p>
            {statusFilter === 'all' && <button onClick={openCreate} className="mt-2 text-sm text-navy-700 hover:underline">Create your first case</button>}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Case</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/cases/${c.id}`} className="font-medium text-navy-700 hover:underline">{c.title}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.clients?.name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{c.case_type || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/dashboard/cases/${c.id}`} className="px-3 py-1 text-xs bg-navy-50 hover:bg-navy-100 text-navy-700 rounded-lg">Open</Link>
                        <button onClick={() => openEdit(c)} className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">Edit</button>
                        <button onClick={() => handleDelete(c.id)} className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Case' : 'New Case'}>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Case Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500" placeholder="e.g., Smith vs. Jones - Property Dispute" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500">
              <option value="">No Client Assigned</option>
              {clients.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
              <select value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500">
                <option value="">Select type...</option>
                {caseTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500">
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500" placeholder="Case notes..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-navy-800 hover:bg-navy-900 rounded-lg disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update Case' : 'Create Case'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
