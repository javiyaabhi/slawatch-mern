import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { CalendarDays, Info } from 'lucide-react';
import { api } from '../api/client';
import { Empty, ErrorNotice, Loading, PageHeading } from '../components/UI';
import { useAuth } from '../context/AuthContext';

const COLOR = {
  green: '#2c7566', navy: '#587384', slate: '#a4bab2', amber: '#c18b4e', red: '#b96558',
  muted: '#a7b5b0', pale: '#d4e1d9'
};
const SLA_COLORS = { met: COLOR.green, resolvedLate: COLOR.red, onTrack: COLOR.slate, atRisk: COLOR.amber, breached: '#873d38' };
const humanize = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
const monthLabel = value => new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
const numberFormat = value => Number(value).toLocaleString('en-IN');
const tooltipStyle = { border: '1px solid #e0e8e2', boxShadow: '0 12px 34px rgba(24,45,42,.11)', borderRadius: 5, fontSize: 12, padding: '9px 12px' };
const axisStyle = { fill: '#72857d', fontSize: 11 };

function Panel({ title, eyebrow, description, children, className = '' }) {
  return <section className={`panel chart-panel ${className}`} aria-label={title}>
    <div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p className="chart-description">{description}</p>{children}
  </section>;
}
function NoData({ description = 'Records will appear as tickets are created or updated.' }) {
  return <Empty title="No data for this view" description={description}/>;
}
function Metric({ label, value, sub }) {
  return <div className="report-kpi"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
function Monthly({ values }) {
  const hasRecords = values.some(row => row.opened > 0);
  return <Panel eyebrow="01 / ARRIVALS" title="Ticket inflow" description="Opened in each month versus how many of those tickets are resolved now." className="report-wide">
    {hasRecords ? <div className="chart-area chart-area-wide" role="img" aria-label="Monthly ticket inflow and current resolution status"><ResponsiveContainer width="100%" height="100%">
      <AreaChart data={values} margin={{ top: 14, right: 17, bottom: 3, left: -20 }}>
        <defs><linearGradient id="openedGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLOR.green} stopOpacity={0.19}/><stop offset="100%" stopColor={COLOR.green} stopOpacity={0.01}/></linearGradient></defs>
        <CartesianGrid stroke="#e9efea" strokeDasharray="3 5" vertical={false}/>
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisStyle} tickLine={false} axisLine={false}/>
        <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false}/>
        <Tooltip contentStyle={tooltipStyle} labelFormatter={value => new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'})} formatter={(value, name) => [numberFormat(value), name === 'opened' ? 'Opened that month' : 'Now resolved from that month']}/>
        <Legend verticalAlign="top" height={30} formatter={value => value === 'opened' ? 'Opened' : 'Now resolved'} wrapperStyle={{ fontSize: 12 }}/>
        <Area type="monotone" dataKey="opened" stroke={COLOR.green} strokeWidth={2.5} fill="url(#openedGradient)" dot={{r:3}} activeDot={{r:5}}/>
        <Area type="monotone" dataKey="resolved" stroke={COLOR.navy} fill="transparent" strokeWidth={2.2} strokeDasharray="5 4" dot={{r:3}}/>
      </AreaChart>
    </ResponsiveContainer></div> : <NoData description="No tickets were opened in the selected months."/>}
  </Panel>;
}
function SlaDistribution({ values }) {
  const total = values.reduce((sum,row) => sum + row.count, 0);
  const used = values.filter(row => row.count > 0);
  return <Panel eyebrow="02 / RELIABILITY" title="SLA outcomes" description="Every ticket in the reporting period, including still-open requests.">
    {!total ? <NoData/> : <div className="donut-wrap">
      <div className="donut-plot" role="img" aria-label="SLA outcome distribution"><ResponsiveContainer width="100%" height="100%"><PieChart>
        <Pie data={used} nameKey="label" dataKey="count" innerRadius="67%" outerRadius="92%" paddingAngle={used.length > 1 ? 2 : 0} stroke="none">
          {used.map(row => <Cell key={row.key} fill={SLA_COLORS[row.key]}/>)}
        </Pie><Tooltip contentStyle={tooltipStyle} formatter={value => [`${value} ticket${value === 1 ? '' : 's'}`, 'Count']}/>
      </PieChart></ResponsiveContainer><div className="donut-center"><strong>{total}</strong><span>Tickets</span></div></div>
      <div className="donut-legend">{values.map(row => <div key={row.key} className="donut-legend-row"><i style={{background:SLA_COLORS[row.key]}}/><span>{row.label}</span><strong>{row.count}</strong></div>)}</div>
    </div>}
  </Panel>;
}
function DistributionBar({ eyebrow, title, description, data, color = COLOR.green }) {
  return <Panel eyebrow={eyebrow} title={title} description={description}>
    {!data.some(row=>row.count>0) ? <NoData/> : <div className="chart-area" role="img" aria-label={title}><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{top:8,right:24,bottom:0,left:0}} barCategoryGap={14}>
        <CartesianGrid horizontal={false} stroke="#e9efea" strokeDasharray="3 5"/>
        <XAxis type="number" allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false}/>
        <YAxis type="category" dataKey="label" width={80} tick={axisStyle} tickLine={false} axisLine={false}/>
        <Tooltip cursor={{fill:'#f4f7f4'}} contentStyle={tooltipStyle} formatter={value=>[numberFormat(value),'Tickets']}/>
        <Bar dataKey="count" fill={color} radius={[0,3,3,0]} maxBarSize={24}/>
      </BarChart>
    </ResponsiveContainer></div>}
  </Panel>;
}
function StageDuration({ values }) {
  return <Panel eyebrow="05 / PROCESS" title="Time spent in each stage" description="Mean hours spent before a recorded status change; current, unfinished stage time is excluded.">
    {!values.length ? <NoData description="Status transitions are needed before stage-duration averages can be calculated."/> : <div className="chart-area" role="img" aria-label="Mean completed stage duration in hours"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={values} layout="vertical" margin={{top:8,right:30,bottom:0,left:0}} barCategoryGap={22}>
        <CartesianGrid horizontal={false} stroke="#e9efea" strokeDasharray="3 5"/>
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} unit="h"/>
        <YAxis type="category" dataKey="label" tick={axisStyle} width={92} tickLine={false} axisLine={false}/>
        <Tooltip contentStyle={tooltipStyle} cursor={{fill:'#f4f7f4'}} formatter={(value)=>[`${Number(value).toFixed(1)}h`, 'Average duration']}/>
        <Bar dataKey="avgHours" fill={COLOR.navy} radius={[0,3,3,0]} maxBarSize={31}/>
      </BarChart>
    </ResponsiveContainer></div>}
  </Panel>;
}
function TeamWorkload({ rows }) {
  return <Panel eyebrow="07 / CAPACITY" title="Team workload" description="Assigned tickets from the period, split by current open and resolved status." className="report-wide">
    {!rows.length ? <NoData description="No assigned ticket records are available for this period."/> : <div className="chart-area chart-area-wide" role="img" aria-label="Active and resolved ticket workload by team member"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{top:12,right:22,bottom:1,left:-18}} barCategoryGap="34%">
        <CartesianGrid vertical={false} stroke="#e9efea" strokeDasharray="3 5"/>
        <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} interval={0}/>
        <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false}/>
        <Tooltip contentStyle={tooltipStyle} cursor={{fill:'#f4f7f4'}} formatter={(value,name)=>[value,name==='active'?'Active tickets':'Resolved tickets']}/>
        <Legend formatter={value=>value==='active'?'Active':'Resolved'} wrapperStyle={{fontSize:12}}/>
        <Bar dataKey="active" stackId="a" fill={COLOR.amber} maxBarSize={54}/>
        <Bar dataKey="resolved" stackId="a" fill={COLOR.green} radius={[3,3,0,0]} maxBarSize={54}/>
      </BarChart>
    </ResponsiveContainer></div>}
  </Panel>;
}
function PriorityCompliance({ rows }) {
  const used = rows.filter(row => row.resolved > 0);
  const chartRows = used.map(row => ({...row,label:humanize(row.priority)}));
  return <Panel eyebrow="06 / COMPLIANCE" title="On-time resolution by priority" description="Percentage of resolved tickets completed within SLA. Priorities with zero resolutions are omitted.">
    {!used.length ? <NoData description="Resolve tickets to calculate on-time rates by priority."/> : <div className="chart-area" role="img" aria-label="Percentage of resolved tickets meeting SLA by priority"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartRows} layout="vertical" margin={{top:7,right:25,bottom:0,left:0}} barCategoryGap={20}>
        <CartesianGrid horizontal={false} stroke="#e9efea" strokeDasharray="3 5"/>
        <XAxis type="number" domain={[0,100]} tick={axisStyle} tickLine={false} axisLine={false} unit="%"/>
        <YAxis type="category" dataKey="label" width={78} tick={axisStyle} tickLine={false} axisLine={false}/>
        <Tooltip contentStyle={tooltipStyle} cursor={{fill:'#f4f7f4'}} formatter={(value,_name,props)=>[`${value}% (${props.payload.onTime}/${props.payload.resolved} resolved on time)`, 'SLA met']}/>
        <Bar dataKey="rate" fill={COLOR.green} radius={[0,3,3,0]} maxBarSize={25}/>
      </BarChart>
    </ResponsiveContainer></div>}
  </Panel>;
}
export default function Reports() {
  const { user } = useAuth();
  const [months,setMonths]=useState(6);
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller = new AbortController();
    setData(null); setError('');
    api(`/metrics/analytics?months=${months}`,{signal:controller.signal}).then(setData).catch(err=>{if(err.name!=='AbortError')setError(err.message);});
    return ()=>controller.abort();
  },[months]);
  const totals = useMemo(()=>{
    const outcomes = data?.slaBreakdown || [];
    const tally=Object.fromEntries(outcomes.map(row=>[row.key,row.count]));
    const total=outcomes.reduce((sum,row)=>sum+row.count,0);
    const completed=(tally.met || 0)+(tally.resolvedLate || 0);
    return {total, completed, late: (tally.resolvedLate || 0)+(tally.breached || 0), rate:completed?`${(100*(tally.met||0)/completed).toFixed(1)}%`:'—'};
  },[data]);
  const categoryRows=(data?.categories || []).map(row=>({label:humanize(row._id),count:row.count}));
  const priorityMap=new Map((data?.priorities || []).map(row=>[row._id,row.count]));
  const priorityRows=['critical','high','medium','low'].map(key=>({label:humanize(key),count:priorityMap.get(key)||0}));
  const stages=(data?.slowStages || []).map(row=>({label:humanize(row._id),avgHours:row.avgHours,count:row.count})).sort((a,b)=>b.avgHours-a.avgHours);
  const agentRows=data?.agents || [];
  return <>
    <PageHeading eyebrow="MANAGEMENT INFORMATION" title="Service analytics" description="A decision-focused view of demand, SLA reliability, workflow delays and team workload."/>
    <div className="report-toolbar"><div className="report-toolbar-copy"><CalendarDays size={18}/><span>Reporting window <small>Tickets opened during the selected calendar months (UTC)</small></span></div><a className="btn btn-secondary btn-small" href={`/api/metrics/analytics.csv?months=${months}`} download>Export CSV</a><label className="period-select">Period <select aria-label="Report period" value={months} onChange={event=>setMonths(Number(event.target.value))}><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></label></div>
    <ErrorNotice error={error}/>
    {!data ? (!error && <Loading/>) : <>
      <div className="report-kpis" aria-label="Reporting period summary"><Metric label="Tickets opened" value={numberFormat(totals.total)} sub="Current reporting cohort"/><Metric label="Resolved" value={numberFormat(totals.completed)} sub="Of tickets opened in period"/><Metric label="On-time resolution" value={totals.rate} sub="Among resolved tickets only"/><Metric label="Late or overdue" value={numberFormat(totals.late)} sub="Resolved late + open overdue"/></div>
      <div className="report-grid"><Monthly values={data.monthly}/><SlaDistribution values={data.slaBreakdown}/><DistributionBar eyebrow="03 / CASE MIX" title="Ticket categories" description="Which types of issues contribute most to support demand?" data={categoryRows}/><DistributionBar eyebrow="04 / URGENCY" title="Priority mix" description="Counts of new tickets across the four configured priority levels." data={priorityRows} color={COLOR.amber}/><StageDuration values={stages}/><PriorityCompliance rows={data.priorityCompliance}/><DistributionBar eyebrow="08 / BACKLOG" title="Age of open tickets" description="Current age of unresolved tickets, regardless of their SLA target." data={(data.aging || []).map(row=>({label:row.label,count:row.count}))} color={COLOR.navy}/>{user?.role === 'manager' && <TeamWorkload rows={agentRows}/>}</div>
      {user?.role === 'manager' && agentRows.length > 0 && <section className="panel table-panel" aria-label="Team details"><div className="panel-heading table-heading"><div><div className="eyebrow">SUPPORT CAPACITY</div><h2>Team resolution detail</h2></div></div><div className="table-scroll"><table><thead><tr><th>Team member</th><th>Assigned</th><th>Active</th><th>Resolved</th><th>Mean resolution</th></tr></thead><tbody>{agentRows.map(row=><tr key={row._id}><td><strong>{row.name}</strong></td><td>{row.total}</td><td>{row.active}</td><td>{row.resolved}</td><td>{row.avgResolutionHours==null?'—':`${row.avgResolutionHours}h`}</td></tr>)}</tbody></table></div></section>}
      <div className="report-disclosure"><Info size={18}/><div><strong>How to read this report</strong><p>All charts use tickets created in the selected calendar-month window, excluding archived records. “Now resolved” counts tickets from each creation month that have subsequently been completed—it is not the number of resolutions performed that month. SLA calculations use 24/7 elapsed time, including weekends. A ticket's SLA deadline is set when it is created and may be recalculated if its priority changes. Stage-time averages include only completed status transitions. Reports show records your account is permitted to access, and exclude future-created tickets. These are historical analytics, not AI predictions.</p></div></div>
    </>}
  </>;
}
