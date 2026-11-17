import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Command, CreditCard, LayoutDashboard, LogOut, Menu, MessageSquare,
  MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Users, X, PhoneCall
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const API = '/api';
const chartData = [
  { day: 'Mon', value: 18 }, { day: 'Tue', value: 27 }, { day: 'Wed', value: 22 },
  { day: 'Thu', value: 39 }, { day: 'Fri', value: 31 }, { day: 'Sat', value: 48 }, { day: 'Sun', value: 43 }
];
async function request(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const initialStats = [{ label: 'Total contacts', value: '1,284', change: '+12.8%', icon: Users, tone: 'violet' }, { label: 'Opted-in contacts', value: '1,092', change: '+8.2%', icon: ShieldCheck, tone: 'mint' }, { label: 'Notifications logged', value: '8,549', change: '+18.4%', icon: MessageSquare, tone: 'blue' }, { label: 'Avg. response rate', value: '68.4%', change: '+4.6%', icon: Activity, tone: 'amber' }];

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request(`/auth/${mode}`, null, { method: 'POST', body: JSON.stringify(form) });
      onAuth(data);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="auth-shell"><div className="auth-glow glow-a"/><div className="auth-glow glow-b"/>
    <div className="auth-card glass"><div className="brand"><div className="brand-mark"><Command size={21}/></div><span>glass<span className="brand-light">connect</span></span></div>
      <div className="auth-kicker"><Sparkles size={14}/> YOUR COMMUNICATION WORKSPACE</div>
      <h1>{mode === 'login' ? 'Welcome back.' : 'Create your space.'}</h1><p className="muted">A calmer way to manage consent-based communication.</p>
      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && <label>Full name<input name="name" placeholder="Your name" value={form.name} onChange={update} required/></label>}
        <label>Email address<input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={update} required/></label>
        <label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength="8" value={form.password} onChange={update} required/></label>
        {error && <div className="error-msg">{error}</div>}
        <button className="primary-btn full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowUpRight size={17}/></button>
      </form>
      <div className="auth-switch">{mode === 'login' ? 'New to GlassConnect?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></div>
      <div className="auth-foot"><ShieldCheck size={14}/> Your workspace is private and protected</div>
    </div><div className="auth-side-note">DESIGNED FOR THOUGHTFUL COMMUNICATION <span>·</span> BUILT WITH CARE</div>
  </div>;
}

function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gc_auth') || 'null'); } catch { return null; }
  });
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [page, setPage] = useState('Overview');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', consent: false });
  const [noticeForm, setNoticeForm] = useState({ contactId: '', channel: 'SMS', message: '' });
  const token = auth?.token;
  const notify = msg => { setToast(msg); setTimeout(() => setToast(''), 3200); };
  async function refresh() {
    if (!token) return;
    try {
      const [me, c, a] = await Promise.all([request('/me', token), request('/contacts', token), request('/activity', token)]);
      setUser(me); setContacts(c); setActivity(a);
    } catch { logout(); }
  }
  useEffect(() => { if (token) refresh(); }, [token]);
  function onAuth(data) { localStorage.setItem('gc_auth', JSON.stringify(data)); setAuth(data); }
  function logout() { localStorage.removeItem('gc_auth'); setAuth(null); setUser(null); }
  async function addContact(e) {
    e.preventDefault();
    try { await request('/contacts', token, { method: 'POST', body: JSON.stringify(contactForm) }); setContactForm({ name: '', phone: '', consent: false }); setModal(''); await refresh(); notify('Contact added'); }
    catch (e) { notify(e.message); }
  }
  async function toggleConsent(contact) {
    try { await request(`/contacts/${contact.id}/consent`, token, { method: 'PATCH', body: JSON.stringify({ consent: !contact.consent }) }); await refresh(); }
    catch (e) { notify(e.message); }
  }
  async function createPreview(e) {
    e.preventDefault();
    try { const result = await request('/notifications/preview', token, { method: 'POST', body: JSON.stringify(noticeForm) }); setModal(''); setNoticeForm({ contactId: '', channel: 'SMS', message: '' }); await refresh(); notify(result.note); }
    catch (e) { notify(e.message); }
  }
  async function callContact(contact) {
    if (!contact.consent) return notify('This contact has not opted in to calls.');
    const confirmed = window.confirm(`Call ${contact.name} (${contact.phone})? Confirm that this person explicitly agreed to receive this call. Exotel will ring your verified phone first, then connect the contact.`);
    if (!confirmed) return;
    try { const result = await request('/calls', token, { method: 'POST', body: JSON.stringify({ contactId: contact.id, confirmConsent: true }) }); await refresh(); notify(result.message); }
    catch (e) { notify(e.message); }
  }
  const filteredContacts = useMemo(() => contacts.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase())), [contacts, query]);
  if (!auth?.token) return <AuthScreen onAuth={onAuth}/>;
  const nav = [{ label: 'WORKSPACE', items: [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Contacts', icon: Users }, { name: 'Activity log', icon: Activity }] }, { label: 'PREFERENCES', items: [{ name: 'Settings', icon: Settings }, { name: 'Help center', icon: CircleHelp }] }];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand sidebar-brand"><div className="brand-mark"><Command size={20}/></div><span>glass<span className="brand-light">connect</span></span><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">GC</div><div><b>Personal workspace</b><small>Free plan</small></div><ChevronDown size={15}/></div>
      {nav.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => <button key={item.name} className={`nav-item ${page === item.name ? 'active' : ''}`} onClick={() => { setPage(item.name); setMobileNav(false); }}><item.icon size={18}/>{item.name}{item.name === 'Activity log' && <span className="nav-count">{activity.length}</span>}</button>)}</div>)}
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16}/></div><b>Make more of your workspace</b><p>Explore tools to keep your team in sync.</p><button onClick={() => notify('You are already on the latest demo workspace.')}>Explore features <ArrowUpRight size={14}/></button></div><div className="profile-row"><div className="profile-avatar">{(user?.name || 'U').slice(0,1).toUpperCase()}</div><div className="profile-meta"><b>{user?.name || 'User'}</b><small>{user?.email || ''}</small></div><button className="icon-btn" title="Sign out" onClick={logout}><LogOut size={17}/></button></div></div>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)}/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-btn" onClick={() => setMobileNav(true)}><Menu/></button><div className="breadcrumb">Workspace <span>/</span> <b>{page}</b></div></div><div className="topbar-right"><div className="search-box"><Search size={16}/><input placeholder="Search anything..." value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="icon-btn notification-btn" onClick={() => notify('You’re all caught up.')}><Bell size={18}/><i/></button><div className="top-avatar">{(user?.name || 'U').slice(0,1).toUpperCase()}</div></div></header>
      <div className="content">
        {page === 'Overview' && <><div className="welcome-row"><div><div className="eyebrow">TUESDAY, NOVEMBER 17, 2026 <span className="live-dot"/> ALL SYSTEMS NORMAL</div><h1>Good to see you, {user?.name?.split(' ')[0] || 'there'} <span className="wave">✦</span></h1><p className="muted">Here’s what’s happening across your workspace today.</p></div><button className="primary-btn" onClick={() => setModal('notification')}><Plus size={17}/> Create notification</button></div>
          <div className="stats-grid">{initialStats.map((s, i) => <div className="stat-card glass" key={s.label}><div className="stat-top"><span>{s.label}</span><div className={`stat-icon ${s.tone}`}><s.icon size={18}/></div></div><div className="stat-value">{s.value}</div><div className="stat-bottom"><span className="positive"><ArrowUpRight size={14}/>{s.change}</span><span>vs. last month</span></div></div>)}</div>
          <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-head"><div><h3>Engagement overview</h3><p className="muted">Notification activity over the last 7 days</p></div><button className="select-chip">This week <ChevronDown size={14}/></button></div><div className="chart-legend"><span><i/> Notifications logged</span><b>248 <small className="positive">+16.8%</small></b></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 5, left: -22, bottom: 0 }}><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9b8cff" stopOpacity={0.28}/><stop offset="100%" stopColor="#9b8cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff" strokeOpacity={0.07} vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#858ba4', fontSize: 11 }}/><Tooltip contentStyle={{ background: '#171d33', border: '1px solid #343b57', borderRadius: 12, color: '#fff' }} /><Area type="monotone" dataKey="value" stroke="#a99aff" strokeWidth={2.5} fill="url(#areaFill)" /></AreaChart></ResponsiveContainer></div></section>
          <section className="panel consent-panel"><div className="panel-head"><div><h3>Consent health</h3><p className="muted">Your audience preferences</p></div><ShieldCheck size={19} className="soft-icon"/></div><div className="consent-ring"><div className="ring-inner"><strong>{contacts.length ? Math.round(contacts.filter(c => c.consent).length / contacts.length * 100) : 0}%</strong><small>opted in</small></div></div><div className="consent-legend"><div><span><i className="mint-dot"/> Opted in</span><b>{contacts.filter(c => c.consent).length}</b></div><div><span><i className="gray-dot"/> Not opted in</span><b>{contacts.filter(c => !c.consent).length}</b></div></div><div className="compliance-note"><ShieldCheck size={15}/> Only contact people who have given permission.</div></section></div>
          <section className="panel activity-panel"><div className="panel-head"><div><h3>Recent activity</h3><p className="muted">A quick look at your latest events</p></div><button className="text-btn" onClick={() => setPage('Activity log')}>View all <ArrowUpRight size={14}/></button></div><ActivityTable items={activity.slice(0,4)}/></section>
        </>}
        {page === 'Contacts' && <><div className="page-heading"><div><div className="eyebrow">AUDIENCE</div><h1>Your contacts</h1><p className="muted">Manage people and their communication preferences.</p></div><button className="primary-btn" onClick={() => setModal('contact')}><Plus size={17}/> Add contact</button></div><section className="panel"><div className="panel-head"><div><h3>All contacts <span className="count-pill">{filteredContacts.length}</span></h3><p className="muted">Only call people with documented opt-in. Click-to-call connects one contact at a time.</p></div></div><div className="table-scroll"><table><thead><tr><th>CONTACT</th><th>PHONE</th><th>CONSENT</th><th>LAST CHANNEL</th><th>CALL</th><th/></tr></thead><tbody>{filteredContacts.map(c => <tr key={c.id}><td><div className="contact-cell"><div className="contact-avatar">{c.name.slice(0,1)}</div><b>{c.name}</b></div></td><td>{c.phone}</td><td><button className={`consent-toggle ${c.consent ? 'yes' : ''}`} onClick={() => toggleConsent(c)}><span/>{c.consent ? 'Opted in' : 'Not opted in'}</button></td><td>{c.channel}</td><td><button className="select-chip" disabled={!c.consent} onClick={() => callContact(c)}><PhoneCall size={13}/> Call</button></td><td><button className="icon-btn" onClick={async () => { await request(`/contacts/${c.id}`, token, { method: 'DELETE' }); refresh(); notify('Contact removed'); }}><MoreHorizontal size={18}/></button></td></tr>)}</tbody></table>{!filteredContacts.length && <div className="empty-state">No contacts found. Try another search or add a contact.</div>}</div></section></>}
        {page === 'Activity log' && <><div className="page-heading"><div><div className="eyebrow">WORKSPACE HISTORY</div><h1>Activity log</h1><p className="muted">Every preview and event recorded in your workspace.</p></div><button className="select-chip"><Clock3 size={15}/> All time <ChevronDown size={14}/></button></div><section className="panel activity-panel"><ActivityTable items={activity}/></section></>}
        {page === 'Settings' && <div className="page-heading"><div><div className="eyebrow">PREFERENCES</div><h1>Settings</h1><p className="muted">Your account and workspace preferences.</p></div></div>}
        {page === 'Settings' && <section className="panel settings-panel"><div className="settings-line"><div><b>Profile information</b><p className="muted">Your signed-in account details.</p></div><div className="settings-value">{user?.name}<small>{user?.email}</small></div></div><div className="settings-line"><div><b>Security</b><p className="muted">Your session is protected with a signed token.</p></div><span className="status-pill"><CheckCircle2 size={14}/> Active</span></div><div className="settings-line"><div><b>Communication policy</b><p className="muted">Only create notification previews for opted-in contacts.</p></div><span className="status-pill"><ShieldCheck size={14}/> Consent-first</span></div></section>}
        {page === 'Help center' && <><div className="page-heading"><div><div className="eyebrow">WE’RE HERE TO HELP</div><h1>Help center</h1><p className="muted">A few notes to help you get started.</p></div></div><section className="panel help-panel"><h3>Getting started with GlassConnect</h3><p>Use Contacts to add people and record whether they have opted in to receive communications. The notification composer creates a local preview. Real click-to-call is available only after Exotel is configured, and only for opted-in contacts. The system calls your verified agent phone first, then bridges the selected contact.</p><p>For a production deployment, connect a legitimate communications provider, verify consent records, publish opt-out instructions, and comply with the laws that apply in your region.</p></section></>}
        <footer className="footer-note"><span>© 2026 GlassConnect</span><span><span className="live-dot"/> All systems operational</span><span>Made for better conversations <span className="heart">✦</span></span></footer>
      </div>
    </main>
    {modal === 'contact' && <Modal title="Add a contact" subtitle="Add someone to your workspace audience." onClose={() => setModal('')}><form onSubmit={addContact} className="modal-form"><label>Full name<input value={contactForm.name} onChange={e => setContactForm({...contactForm, name:e.target.value})} placeholder="e.g. Alex Morgan" required/></label><label>Phone number<input value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone:e.target.value})} placeholder="+91 98765 43210" required/></label><label className="check-label"><input type="checkbox" checked={contactForm.consent} onChange={e => setContactForm({...contactForm, consent:e.target.checked})}/> This person has explicitly opted in to receive communications.</label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setModal('')}>Cancel</button><button className="primary-btn">Add contact</button></div></form></Modal>}
    {modal === 'notification' && <Modal title="Create notification preview" subtitle="This saves a preview to your activity log. Nothing is sent." onClose={() => setModal('')}><form onSubmit={createPreview} className="modal-form"><label>Choose opted-in contact<select value={noticeForm.contactId} onChange={e => setNoticeForm({...noticeForm, contactId:e.target.value})} required><option value="">Select a contact</option>{contacts.filter(c => c.consent).map(c => <option value={c.id} key={c.id}>{c.name} · {c.phone}</option>)}</select></label><label>Preview type<select value={noticeForm.channel} onChange={e => setNoticeForm({...noticeForm, channel:e.target.value})}><option>SMS</option><option>Call</option></select></label><label>Message<textarea rows="4" maxLength="500" value={noticeForm.message} onChange={e => setNoticeForm({...noticeForm, message:e.target.value})} placeholder="Write a short message preview…" required/></label><div className="preview-warning"><ShieldCheck size={16}/> Only opted-in contacts are available. This is a preview, not a live send.</div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setModal('')}>Cancel</button><button className="primary-btn">Save preview</button></div></form></Modal>}
    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}
function ActivityTable({ items }) {
  if (!items.length) return <div className="empty-state">No activity yet. Create a notification preview to see it here.</div>;
  return <div className="table-scroll"><table><thead><tr><th>EVENT</th><th>CONTACT</th><th>STATUS</th><th>DATE</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><div className="event-cell"><span className="event-icon">{item.type.toLowerCase().includes('call') ? <PhoneCall size={16}/> : <MessageSquare size={16}/>}</span><b>{item.type}</b></div></td><td>{item.target}</td><td><span className={`status-pill ${item.status === 'Preview only' ? 'preview' : ''}`}><CheckCircle2 size={14}/>{item.status}</span></td><td className="date-cell">{new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>)}</tbody></table></div>;
}
function Modal({ title, subtitle, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal glass"><div className="modal-head"><div><h2>{title}</h2><p className="muted">{subtitle}</p></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>{children}</div></div>;
}
export default App;
