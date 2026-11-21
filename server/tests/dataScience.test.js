import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePercentiles,
  percentileRank,
  enrichMonthlySeries,
  buildCategoryRiskMatrix,
  analyzeStageBottlenecks,
  calculateServiceHealthIndex,
  generateDataScienceInsights
} from '../src/domain/dataScience.js';

test('percentileRank calculates median and P90 correctly', () => {
  const sorted = [2, 4, 6, 8, 10];
  assert.equal(percentileRank(sorted, 0.5), 6);
  assert.equal(percentileRank(sorted, 0.9), 9.2);
  assert.equal(percentileRank([5], 0.5), 5);
  assert.equal(percentileRank([], 0.5), null);
});

test('calculatePercentiles handles empty, single, and skewed datasets', () => {
  const empty = calculatePercentiles([]);
  assert.equal(empty.count, 0);
  assert.equal(empty.mean, null);

  const values = [2, 4, 4, 6, 8, 10, 12, 14, 50]; // heavy outlier 50
  const stats = calculatePercentiles(values);
  assert.equal(stats.count, 9);
  assert.equal(stats.min, 2);
  assert.equal(stats.max, 50);
  assert.equal(stats.median, 8);
  assert.ok(stats.mean > stats.median);
  assert.equal(stats.skewness, 'right_skewed');
  assert.ok(stats.stdDev > 0);
  assert.ok(stats.p90 > stats.median);
});

test('enrichMonthlySeries computes net flow, moving averages and forecast', () => {
  const monthly = [
    { month: '2026-01', opened: 10, resolved: 8 },
    { month: '2026-02', opened: 12, resolved: 14 },
    { month: '2026-03', opened: 15, resolved: 11 }
  ];
  const { monthly: enriched, forecast } = enrichMonthlySeries(monthly);
  assert.equal(enriched.length, 3);
  assert.equal(enriched[0].netFlow, 2);
  assert.equal(enriched[1].netFlow, -2);
  assert.equal(enriched[2].netFlow, 4);
  assert.ok(enriched[2].movingAvg > 0);
  assert.ok(forecast !== null);
  assert.equal(forecast.month, '2026-04');
  assert.ok(typeof forecast.projectedOpened === 'number');
});

test('buildCategoryRiskMatrix sorts categories by composite risk score', () => {
  const stats = [
    { category: 'software', total: 10, resolved: 8, onTime: 8, breached: 1, durations: [4, 5, 6] },
    { category: 'network', total: 6, resolved: 3, onTime: 2, breached: 3, durations: [10, 15, 20] } // 50% breach rate
  ];
  const matrix = buildCategoryRiskMatrix(stats);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[0].category, 'network'); // higher risk first
  assert.equal(matrix[0].riskLevel, 'critical');
  assert.ok(matrix[0].riskScore > matrix[1].riskScore);
});

test('analyzeStageBottlenecks identifies dominant stages', () => {
  const stages = [
    { _id: 'open', count: 10, avgHours: 3.5 },
    { _id: 'in_progress', count: 10, avgHours: 18.2 }
  ];
  const analysis = analyzeStageBottlenecks(stages);
  assert.equal(analysis.length, 2);
  assert.equal(analysis[0].stage, 'in_progress');
  assert.equal(analysis[0].isBottleneck, true);
  assert.ok(analysis[0].percentOfCycle > 70);
});

test('calculateServiceHealthIndex computes score and grade', () => {
  const index = calculateServiceHealthIndex({
    onTimeRate: 92,
    priorityCompliance: [
      { priority: 'critical', resolved: 4, onTime: 4, rate: 100 },
      { priority: 'high', resolved: 5, onTime: 4, rate: 80 }
    ],
    aging: [{ key: 'under4', count: 5 }, { key: 'over3days', count: 0 }],
    monthly: [{ opened: 10, resolved: 9 }]
  });
  assert.ok(index.score >= 80);
  assert.ok(['A', 'B'].includes(index.grade));
  assert.ok(index.components.onTimeScore > 0);
});

test('generateDataScienceInsights produces actionable findings', () => {
  const insights = generateDataScienceInsights({
    percentiles: { count: 10, mean: 15, median: 7, p90: 25, skewRatio: 2.14, skewness: 'right_skewed' },
    categoryRisk: [{ category: 'network', breachRate: 35, total: 10, lateOrBreached: 4 }],
    bottlenecks: [{ stage: 'in_progress', percentOfCycle: 75, avgHours: 18, isBottleneck: true }],
    monthly: [{ netFlow: 3 }, { netFlow: 2 }],
    healthIndex: { score: 76, grade: 'C', rating: 'Attention Needed', components: { onTimeScore: 78, urgentScore: 70 } }
  });
  assert.ok(insights.length >= 4);
  assert.ok(insights.some(i => i.title.includes('Highest SLA Breach Risk')));
  assert.ok(insights.some(i => i.title.includes('Outlier Tail Latency')));
  assert.ok(insights.some(i => i.title.includes('Workflow Bottleneck')));
});
