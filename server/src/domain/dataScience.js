/**
 * SLAWatch Data Science & Statistical Analytics Engine
 * Provides descriptive statistics, percentile distributions, category risk cross-tabulation,
 * time-series velocity, stage bottleneck diagnostics, and composite service health indexing.
 */

/**
 * Computes exact percentile using linear interpolation between closest ranks.
 * @param {number[]} sorted Sorted array of numbers (ascending).
 * @param {number} p Percentile between 0 and 1 (e.g. 0.5 for median, 0.9 for P90).
 */
export function percentileRank(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 10) / 10;
}

/**
 * Computes comprehensive descriptive statistics and distribution shape metrics.
 * @param {number[]} values Array of durations in hours.
 */
export function calculatePercentiles(values = []) {
  const filtered = values.filter(v => typeof v === 'number' && !Number.isNaN(v) && v >= 0);
  if (!filtered.length) {
    return {
      count: 0, min: null, max: null, mean: null, median: null,
      p25: null, p75: null, p90: null, p95: null, iqr: null,
      stdDev: null, skewness: 'symmetric', skewRatio: 1
    };
  }

  const sorted = [...filtered].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = Math.round((sum / count) * 10) / 10;
  const min = Math.round(sorted[0] * 10) / 10;
  const max = Math.round(sorted[count - 1] * 10) / 10;

  const median = percentileRank(sorted, 0.5);
  const p25 = percentileRank(sorted, 0.25);
  const p75 = percentileRank(sorted, 0.75);
  const p90 = percentileRank(sorted, 0.90);
  const p95 = percentileRank(sorted, 0.95);
  const iqr = (p75 != null && p25 != null) ? Math.round((p75 - p25) * 10) / 10 : null;

  // Sample standard deviation
  const variance = count > 1
    ? sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (count - 1)
    : 0;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  // Skewness indication (mean vs median)
  const skewRatio = median && median > 0 ? Math.round((mean / median) * 100) / 100 : 1;
  let skewness = 'symmetric';
  if (skewRatio >= 1.25) skewness = 'right_skewed'; // long-tail outliers delay resolution
  else if (skewRatio <= 0.8) skewness = 'left_skewed';

  return {
    count, min, max, mean, median,
    p25, p75, p90, p95, iqr, stdDev,
    skewness, skewRatio
  };
}

/**
 * Enriches monthly arrivals with net flow velocity, moving averages, and 1-month predictive forecast.
 * @param {Array<{month: string, opened: number, resolved: number}>} monthly
 */
export function enrichMonthlySeries(monthly = []) {
  let cumulativeBacklog = 0;
  const enriched = monthly.map((row, idx, arr) => {
    const netFlow = row.opened - row.resolved;
    cumulativeBacklog += netFlow;
    const efficiency = row.opened > 0 ? Math.round((row.resolved / row.opened) * 1000) / 10 : 0;

    // 3-month Simple Moving Average (SMA)
    const windowStart = Math.max(0, idx - 2);
    const windowSlice = arr.slice(windowStart, idx + 1);
    const smaOpened = Math.round((windowSlice.reduce((s, r) => s + r.opened, 0) / windowSlice.length) * 10) / 10;

    return {
      ...row,
      netFlow,
      cumulativeBacklog,
      efficiency,
      movingAvg: smaOpened
    };
  });

  // Predictive 1-month forecast based on trend and recent velocity
  let forecast = null;
  if (monthly.length >= 2) {
    const n = monthly.length;
    const recent = monthly.slice(-3);
    const avgRecentOpened = recent.reduce((s, r) => s + r.opened, 0) / recent.length;
    const delta = (monthly[n - 1].opened - monthly[0].opened) / Math.max(1, n - 1);
    const projectedOpened = Math.max(0, Math.round(avgRecentOpened + delta * 0.5));

    // Next month string (UTC)
    const lastMonth = monthly[n - 1].month;
    const [year, month] = lastMonth.split('-').map(Number);
    const nextDate = new Date(Date.UTC(year, month, 1));
    const nextMonth = nextDate.toISOString().slice(0, 7);

    forecast = {
      month: nextMonth,
      projectedOpened,
      confidenceInterval: [Math.max(0, projectedOpened - 3), projectedOpened + 3],
      trend: delta > 0.5 ? 'increasing' : delta < -0.5 ? 'decreasing' : 'stable'
    };
  }

  return { monthly: enriched, forecast };
}

/**
 * Cross-tabulates categories with SLA outcomes to surface breach risk hotspots.
 * @param {Array<{category: string, total: number, resolved: number, onTime: number, breached: number, durations: number[]}>} categoryStats
 */
export function buildCategoryRiskMatrix(categoryStats = []) {
  const totalTickets = categoryStats.reduce((sum, c) => sum + c.total, 0);

  return categoryStats.map(cat => {
    const lateOrBreached = cat.breached || 0;
    const breachRate = cat.total > 0 ? Math.round((lateOrBreached / cat.total) * 1000) / 10 : 0;
    const complianceRate = Math.round((100 - breachRate) * 10) / 10;
    const volumeShare = totalTickets > 0 ? Math.round((cat.total / totalTickets) * 1000) / 10 : 0;

    // Composite risk score: weight both breach frequency and volume impact
    // Risk Score (0-100) = (breachRate * 0.65) + (volumeShare * 0.35)
    const riskScore = Math.min(100, Math.round((breachRate * 0.65 + volumeShare * 0.35) * 10) / 10);

    let riskLevel = 'low';
    if (breachRate >= 30 || riskScore >= 35) riskLevel = 'critical';
    else if (breachRate >= 15 || riskScore >= 20) riskLevel = 'moderate';

    const stats = calculatePercentiles(cat.durations || []);

    return {
      category: cat.category,
      total: cat.total,
      active: cat.total - cat.resolved,
      resolved: cat.resolved,
      onTime: cat.onTime,
      lateOrBreached,
      breachRate,
      complianceRate,
      volumeShare,
      riskScore,
      riskLevel,
      meanHours: stats.mean,
      medianHours: stats.median
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Analyzes stage duration bottlenecks and process friction.
 * @param {Array<{_id: string, count: number, avgHours: number}>} slowStages
 */
export function analyzeStageBottlenecks(slowStages = []) {
  if (!slowStages.length) return [];
  const totalCycleHours = slowStages.reduce((sum, s) => sum + (s.avgHours || 0), 0);

  return slowStages.map(stage => {
    const avgHours = stage.avgHours || 0;
    const percentOfCycle = totalCycleHours > 0
      ? Math.round((avgHours / totalCycleHours) * 1000) / 10
      : 0;

    const isBottleneck = percentOfCycle >= 40 || avgHours >= 20;

    return {
      stage: stage._id,
      count: stage.count,
      avgHours,
      percentOfCycle,
      isBottleneck,
      severity: percentOfCycle >= 60 ? 'high' : percentOfCycle >= 35 ? 'medium' : 'low'
    };
  }).sort((a, b) => b.avgHours - a.avgHours);
}

/**
 * Calculates a composite Service Health Index (0-100) combining resolution compliance,
 * priority adherence, backlog aging, and inflow vs clearance ratio.
 */
export function calculateServiceHealthIndex({
  onTimeRate = 100,
  priorityCompliance = [],
  aging = [],
  monthly = [],
  breachedCount = 0,
  totalActive = 0
}) {
  // 1. Overall On-time resolution rate (35% weight)
  const onTimeScore = typeof onTimeRate === 'number' ? Math.min(100, Math.max(0, onTimeRate)) : 80;

  // 2. High & Critical Priority Compliance (25% weight)
  const urgentRows = priorityCompliance.filter(r => ['critical', 'high'].includes(r.priority) && r.resolved > 0);
  const urgentScore = urgentRows.length
    ? urgentRows.reduce((acc, r) => acc + (r.rate ?? 70), 0) / urgentRows.length
    : onTimeScore;

  // 3. Backlog Freshness (20% weight: penalizes tickets older than 3 days)
  const agingMap = new Map(aging.map(a => [a.key, a.count]));
  const totalAging = aging.reduce((s, a) => s + a.count, 0);
  const over3Days = agingMap.get('over3days') || 0;
  const staleRatio = totalAging > 0 ? over3Days / totalAging : 0;
  const backlogFreshnessScore = Math.max(0, 100 - staleRatio * 100);

  // 4. Clearance Ratio (20% weight: resolved vs opened)
  const totalOpened = monthly.reduce((s, m) => s + (m.opened || 0), 0);
  const totalResolved = monthly.reduce((s, m) => s + (m.resolved || 0), 0);
  const clearanceRatio = totalOpened > 0 ? Math.min(1.2, totalResolved / totalOpened) : 1;
  const clearanceScore = Math.min(100, Math.round(clearanceRatio * 85));

  // Weighted composite score (0-100)
  const composite = Math.round(
    onTimeScore * 0.35 +
    urgentScore * 0.25 +
    backlogFreshnessScore * 0.20 +
    clearanceScore * 0.20
  );

  let grade = 'A';
  let rating = 'Optimal';
  if (composite >= 90) { grade = 'A'; rating = 'Excellent'; }
  else if (composite >= 80) { grade = 'B'; rating = 'Good'; }
  else if (composite >= 70) { grade = 'C'; rating = 'Attention Needed'; }
  else if (composite >= 60) { grade = 'D'; rating = 'At Risk'; }
  else { grade = 'F'; rating = 'Critical'; }

  return {
    score: composite,
    grade,
    rating,
    components: {
      onTimeScore: Math.round(onTimeScore),
      urgentScore: Math.round(urgentScore),
      backlogFreshnessScore: Math.round(backlogFreshnessScore),
      clearanceScore: Math.round(clearanceScore)
    }
  };
}

/**
 * Generates automated, actionable natural language observations from computed data science metrics.
 */
export function generateDataScienceInsights({
  percentiles,
  categoryRisk = [],
  bottlenecks = [],
  monthly = [],
  healthIndex
}) {
  const insights = [];

  // 1. Health Index Summary
  if (healthIndex) {
    insights.push({
      type: healthIndex.score >= 80 ? 'positive' : 'warning',
      title: `Service Health: ${healthIndex.rating} (${healthIndex.score}/100 Grade ${healthIndex.grade})`,
      message: healthIndex.score >= 80
        ? `Operations are healthy with strong compliance (${healthIndex.components.onTimeScore}% on-time).`
        : `Service health requires intervention; critical SLA compliance is at ${healthIndex.components.urgentScore}%.`
    });
  }

  // 2. Highest Risk Category
  const topRisk = categoryRisk[0];
  if (topRisk && topRisk.breachRate > 0) {
    insights.push({
      type: topRisk.breachRate >= 25 ? 'critical' : 'warning',
      title: `Highest SLA Breach Risk: ${topRisk.category.toUpperCase()}`,
      message: `${topRisk.category} tickets experience a ${topRisk.breachRate}% breach/late rate (${topRisk.lateOrBreached} of ${topRisk.total} tickets). Median resolution is ${topRisk.medianHours ?? topRisk.meanHours ?? 'N/A'}h.`
    });
  }

  // 3. Distribution Skewness & Tail Latency
  if (percentiles && percentiles.count >= 2) {
    if (percentiles.skewness === 'right_skewed') {
      insights.push({
        type: 'info',
        title: `Outlier Tail Latency (P90: ${percentiles.p90}h vs Median: ${percentiles.median}h)`,
        message: `Mean resolution (${percentiles.mean}h) is skewed by ${Math.round((percentiles.skewRatio - 1) * 100)}% above the median (${percentiles.median}h). 10% of tickets take over ${percentiles.p90}h.`
      });
    } else {
      insights.push({
        type: 'positive',
        title: `Predictable Resolution Consistency (Median: ${percentiles.median}h, IQR: ${percentiles.iqr}h)`,
        message: `Resolution times exhibit symmetric clustering with 50% of tickets resolved within ${percentiles.median}h (IQR: ${percentiles.iqr}h).`
      });
    }
  }

  // 4. Bottleneck Detection
  const primaryBottleneck = bottlenecks.find(b => b.isBottleneck);
  if (primaryBottleneck) {
    const stageName = primaryBottleneck.stage.replace(/_/g, ' ');
    insights.push({
      type: 'warning',
      title: `Workflow Bottleneck in "${stageName}"`,
      message: `Tickets spend ${primaryBottleneck.percentOfCycle}% of total cycle time in ${stageName} (avg ${primaryBottleneck.avgHours}h). Improving handoff speed here will yield the largest SLA gain.`
    });
  }

  // 5. Net Flow / Capacity
  const netSum = monthly.reduce((s, m) => s + (m.netFlow || 0), 0);
  if (monthly.length >= 2) {
    insights.push({
      type: netSum > 0 ? 'warning' : 'positive',
      title: netSum > 0 ? `Net Backlog Accumulation (+${netSum} tickets)` : `Healthy Backlog Burn-Down (${netSum} net tickets)`,
      message: netSum > 0
        ? `Ticket inflow exceeded resolutions by ${netSum} tickets across the reporting cohort. Additional capacity may be needed.`
        : `Team cleared more tickets than arrived during the period, successfully burning down historical backlog.`
    });
  }

  return insights;
}

