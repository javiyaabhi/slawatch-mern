/**
 * Human-readable aggregate export, NEVER raw ticket descriptions or credentials.
 * Spreadsheet formula injection prevention is applied to every user-controlled text field.
 */
export function csvCell(value) {
  const original = value ?? '';
  let valueString = String(original);
  // Excel and similar viewers can interpret formula prefixes even inside quoted CSV cells.
  if (typeof original === 'string' && /^[\s]*[=+@\-]/.test(valueString)) valueString = "'" + valueString;
  return '"' + valueString.replaceAll('"', '""') + '"';
}

export function createReportCsv(report) {
  const rows = [['Section', 'Dimension', 'Metric', 'Value']];
  const push = (section, dimension, metric, value) => rows.push([section, dimension, metric, value]);
  push('Report', 'Period', 'Start (UTC)', report.period.from);
  push('Report', 'Period', 'Through (UTC)', report.period.through);
  for (const item of report.monthly) {
    push('Monthly cohort', item.month, 'Tickets opened', item.opened);
    push('Monthly cohort', item.month, 'Now resolved', item.resolved);
  }
  for (const item of report.slaBreakdown) push('SLA outcome', item.label, 'Tickets', item.count);
  for (const item of report.categories) push('Category', item._id, 'Tickets', item.count);
  for (const item of report.priorities) push('Priority', item._id, 'Tickets', item.count);
  for (const item of report.priorityCompliance) {
    push('Priority SLA', item.priority, 'Resolved on time', item.onTime);
    push('Priority SLA', item.priority, 'Total resolved', item.resolved);
    push('Priority SLA', item.priority, 'On-time rate (%)', item.rate ?? 'N/A');
  }
  for (const item of report.aging) push('Open age', item.label, 'Tickets', item.count);
  for (const item of report.slowStages) {
    push('Stage duration', item._id, 'Completed transitions', item.count);
    push('Stage duration', item._id, 'Mean hours', item.avgHours);
  }
  // Team rows appear only in manager-authorized report data.
  for (const item of report.agents) {
    push('Team workload', item.name, 'Active', item.active);
    push('Team workload', item.name, 'Resolved', item.resolved);
    push('Team workload', item.name, 'Mean resolution hours', item.avgResolutionHours ?? 'N/A');
  }
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
