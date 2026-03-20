import { ScheduledEvent } from 'aws-lambda';
import { runClusteringPipeline } from '../../shared/clusteringPipeline';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
    console.log('[dailyClustering] Starting daily clustering pipeline');
    const run = await runClusteringPipeline();
    console.log(`[dailyClustering] Complete: ${run.totalPlayers} players, variance=${run.withinClusterVariance}`);
  } catch (err) {
    console.error('[dailyClustering] Failed:', err);
    throw err;
  }
};
