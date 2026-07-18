const hasRevision = (job) => (
  job
  && typeof job.id === 'string'
  && job.id.length > 0
  && job.updated_at !== null
  && job.updated_at !== undefined
);

export const arePipelineJobsEqual = (currentJob, nextJob) => (
  currentJob === nextJob
  || (
    hasRevision(currentJob)
    && hasRevision(nextJob)
    && currentJob.id === nextJob.id
    && currentJob.updated_at === nextJob.updated_at
  )
);

export const reusePipelineJob = (currentJob, nextJob) => (
  arePipelineJobsEqual(currentJob, nextJob) ? currentJob : nextJob
);

export const arePipelineJobListsEqual = (currentJobs, nextJobs) => {
  if (currentJobs === nextJobs) return true;
  if (!Array.isArray(currentJobs) || !Array.isArray(nextJobs)) return false;
  if (currentJobs.length !== nextJobs.length) return false;
  for (let index = 0; index < currentJobs.length; index += 1) {
    if (!arePipelineJobsEqual(currentJobs[index], nextJobs[index])) return false;
  }
  return true;
};

export const reusePipelineJobList = (currentJobs, nextJobs) => (
  arePipelineJobListsEqual(currentJobs, nextJobs) ? currentJobs : nextJobs
);
