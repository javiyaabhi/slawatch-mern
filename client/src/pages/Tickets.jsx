import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, ArrowRight, Plus, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Empty, ErrorNotice, Loading, PageHeading, Priority, shortDate, StatusBadge, slaState } from '../components/UI';

const initialFilters = { status: '', priority: '', category: '', q: '' };
const priorities = ['critical', 'high', 'medium', 'low'];
const categories = ['hardware', 'software', 'network', 'access', 'other'];

export default function Tickets() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const archived = user?.role === 'manager' && searchParams.get('archived') === '1';
  const [filters, setFilters] = useState(() => ({
    status: '', priority: '', category: '', approval: searchParams.get('approval') || '', q: ''
  }));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const urlApproval = searchParams.get('approval');
    if (urlApproval && filters.approval !== urlApproval) {
      setFilters(f => ({ ...f, approval: urlApproval }));
    }
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setData(null);
    const params = new URLSearchParams({ page: String(page), archived: archived ? '1' : '0' });
    Object.entries(filters).filter(([, v]) => v).forEach(([key, value]) => params.set(key, value));
    api(`/tickets?${params}`, { signal: controller.signal })
      .then(setData)
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [filters, page, archived]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters(current => ({ ...current, [key]: value }));
  }
  function toggleArchive() {
    setPage(1);
    setSearchParams(archived ? {} : { archived: '1' });
  }
  function clearFilters() {
    setFilters(initialFilters);
    setSearch('');
    setPage(1);
  }

  return <>
    <PageHeading eyebrow={archived ? 'HISTORICAL RECORDS' : 'SERVICE REGISTER'}
      title={archived ? 'Ticket archive' : 'Tickets'}
      description={archived ? 'Resolved records retained for audit. Archived tickets are excluded from active analytics.' : 'A clear record of every service request, owner and deadline.'}
      action={<div className="heading-action-row">
        {user?.role === 'manager' && <button type="button" className="btn btn-secondary" onClick={toggleArchive}><Archive size={16}/>{archived ? 'Active tickets' : 'View archive'}</button>}
        {!archived && <Link to="/tickets/new" className="btn btn-primary"><Plus size={17}/> New ticket</Link>}
      </div>}/>
    <div className="panel filter-panel">
      <form className="search-form" onSubmit={e => { e.preventDefault(); updateFilter('q', search); }}>
        <Search size={18}/>
        <input aria-label="Search by title or reference" placeholder="Search ticket title or reference…" value={search} onChange={e => setSearch(e.target.value)}/>
        <button className="btn btn-small btn-secondary" type="submit">Search</button>
      </form>
      <div className="filters">
        <label>Status
          <select value={filters.status} onChange={e => updateFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option>
          </select>
        </label>
        <label>Priority
          <select value={filters.priority} onChange={e => updateFilter('priority', e.target.value)}>
            <option value="">All priorities</option>{priorities.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>Category
          <select value={filters.category} onChange={e => updateFilter('category', e.target.value)}>
            <option value="">All categories</option>{categories.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>Approval
          <select value={filters.approval} onChange={e => updateFilter('approval', e.target.value)}>
            <option value="">All approvals</option>
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <button type="button" className="filter-reset" onClick={clearFilters}>Clear filters</button>
      </div>
    </div>
    <ErrorNotice error={error}/>
    {!data ? (!error && <Loading/>) : <section className="panel table-panel">
      <div className="table-toolbar"><div><strong>{archived ? 'Archived tickets' : 'Ticket register'}</strong><span>{data.total} record{data.total !== 1 ? 's' : ''}</span></div><small>Newest first</small></div>
      {!data.tickets.length ? <Empty title={archived ? 'No archived tickets' : 'No matching tickets'} description={archived ? 'Resolved tickets archived by a manager will appear here.' : 'Try a different filter or create your first service request.'} action={archived ? undefined : {to:'/tickets/new',text:'Create ticket'}}/> :
        <div className="table-scroll"><table><thead><tr><th>Reference / Ticket</th><th>Priority</th><th>Status</th><th>SLA</th><th>Assigned to</th><th>{archived ? 'Archived' : 'Created'}</th><th><span className="sr-only">Open</span></th></tr></thead>
          <tbody>{data.tickets.map(t => <tr key={t._id}>
            <td><Link className="table-title" to={`/tickets/${t._id}`}>{t.title}</Link><div className="ticket-code">{t.code}</div></td>
            <td><Priority level={t.priority}/></td>
            <td>
              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                <StatusBadge status={archived ? 'archived' : t.status}/>
                {t.approvalStatus === 'pending' && <StatusBadge status="pending"/>}
                {t.approvalStatus === 'rejected' && <StatusBadge status="rejected"/>}
              </div>
            </td>
            <td><StatusBadge status={slaState(t)}/></td>
            <td>{t.assignedTo?.name || '—'}</td>
            <td className="muted-cell">{shortDate(archived ? t.archivedAt : t.createdAt)}</td>
            <td><Link className="row-arrow" aria-label={`View ${t.title}`} to={`/tickets/${t._id}`}><ArrowRight size={17}/></Link></td>
          </tr>)}</tbody></table></div>}
      <div className="table-footer"><span>Page {data.page} of {Math.max(1, data.pages)}</span><div className="pagination"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
    </section>}
  </>;
}
