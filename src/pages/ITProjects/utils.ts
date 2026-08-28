import { ITProject, ProjectHealth } from './types';
import { differenceInDays } from 'date-fns';

export function calculateProjectMetrics(project: ITProject) {
  let totalTasks = 0;
  let completedTasks = 0;

  if (project.phases) {
    project.phases.forEach(phase => {
      if (phase.tasks) {
        phase.tasks.forEach(task => {
          totalTasks++;
          if (task.status === 'completed') {
            completedTasks++;
          }
        });
      }
    });
  }

  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (project.progressPercent || 0);

  const targetEnd = new Date(project.targetEndDate);
  const now = new Date();
  const daysUntilEnd = differenceInDays(targetEnd, now);
  const isOverdue = daysUntilEnd < 0 && progressPercent < 100;
  const overdueDays = isOverdue ? Math.abs(daysUntilEnd) : 0;

  const openRisks = (project.risks || []).filter(r => r.status === 'Open');
  const highOpenRisks = openRisks.filter(r => r.impact === 'High').length;
  const mediumOpenRisks = openRisks.filter(r => r.impact === 'Medium').length;

  const openIssues = (project.issues || []).filter(i => i.status === 'Open');
  const criticalOpenIssues = openIssues.filter(i => i.severity === 'Critical').length;
  const highOpenIssues = openIssues.filter(i => i.severity === 'High').length;
  const mediumOpenIssues = openIssues.filter(i => i.severity === 'Medium').length;

  // Milestones variance analysis
  const milestones = project.milestones || [];
  let delayedMilestonesCount = 0;
  let maxMilestoneDelayDays = 0;

  milestones.forEach(m => {
    if (m.status !== 'completed') {
      const planned = new Date(m.plannedDate);
      const forecast = new Date(m.forecastDate);
      const variance = differenceInDays(forecast, planned);
      if (variance > 0) {
        delayedMilestonesCount++;
        if (variance > maxMilestoneDelayDays) {
          maxMilestoneDelayDays = variance;
        }
      }
    }
  });

  // Change Requests analysis
  const changeRequests = project.changeRequests || [];
  const pendingCRs = changeRequests.filter(cr => cr.status === 'Requested' || cr.status === 'Under Review');
  const approvedCRs = changeRequests.filter(cr => cr.status === 'Approved' || cr.status === 'Implemented');
  const totalApprovedBudgetImpact = approvedCRs.reduce((acc, cr) => acc + (cr.budgetImpact || 0), 0);
  const totalApprovedTimelineImpactDays = approvedCRs.reduce((acc, cr) => acc + (cr.timelineImpactDays || 0), 0);

  let health: ProjectHealth = 'green';
  const insights: string[] = [];

  // Rules for RED
  if (criticalOpenIssues > 0) {
    health = 'red';
    insights.push(`${criticalOpenIssues} critical issue(s) open`);
  }
  if (isOverdue) {
    health = 'red';
    insights.push(`Project is overdue by ${overdueDays} day(s)`);
  }
  if (maxMilestoneDelayDays > 14) {
    health = 'red';
    insights.push(`Critical milestone schedule slippage (+${maxMilestoneDelayDays} days forecast delay)`);
  }
  if (highOpenRisks > 2) {
    health = 'red';
    insights.push(`Too many high-impact risks (${highOpenRisks})`);
  }

  // Rules for AMBER (if not already RED)
  if (health !== 'red') {
    if (highOpenIssues > 0) {
      health = 'amber';
      insights.push(`${highOpenIssues} high severity issue(s) open`);
    } else if (maxMilestoneDelayDays > 0) {
      health = 'amber';
      insights.push(`${delayedMilestonesCount} milestone(s) forecasted with delay (+${maxMilestoneDelayDays}d max)`);
    } else if (highOpenRisks > 0) {
      health = 'amber';
      insights.push(`${highOpenRisks} high impact risk(s) open`);
    } else if (daysUntilEnd <= 7 && daysUntilEnd >= 0 && progressPercent < 80) {
      health = 'amber';
      insights.push(`Target end in ${daysUntilEnd} days but progress is only ${progressPercent}%`);
    } else if (pendingCRs.length > 2) {
      health = 'amber';
      insights.push(`${pendingCRs.length} pending scope change request(s) awaiting approval`);
    } else if (mediumOpenIssues > 3 || mediumOpenRisks > 3) {
      health = 'amber';
      insights.push(`High volume of medium-priority risks/issues`);
    }
  }

  // Default to GREEN if no warnings
  if (health === 'green') {
    insights.push('Schedule and milestones are on track');
    insights.push('No blocking issues or critical risks');
  }

  return { 
    health, 
    progressPercent, 
    overdueDays,
    daysUntilEnd,
    isOverdue,
    insights,
    metrics: {
      totalTasks,
      completedTasks,
      openRisks: openRisks.length,
      openIssues: openIssues.length,
      delayedMilestonesCount,
      maxMilestoneDelayDays,
      pendingCRsCount: pendingCRs.length,
      approvedCRsCount: approvedCRs.length,
      totalApprovedBudgetImpact,
      totalApprovedTimelineImpactDays
    }
  };
}

