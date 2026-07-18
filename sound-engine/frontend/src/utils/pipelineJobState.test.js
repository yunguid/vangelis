import { describe, expect, it } from 'vitest';
import {
  arePipelineJobListsEqual,
  arePipelineJobsEqual,
  reusePipelineJob,
  reusePipelineJobList
} from './pipelineJobState.js';

describe('pipelineJobState', () => {
  it('reuses job identity when id and authoritative revision match', () => {
    const current = { id: 'job-1', updated_at: 10, status: 'running' };
    const next = { id: 'job-1', updated_at: 10, status: 'running' };

    expect(arePipelineJobsEqual(current, next)).toBe(true);
    expect(reusePipelineJob(current, next)).toBe(current);
  });

  it('retains changed or unversioned responses', () => {
    const current = { id: 'job-1', updated_at: 10 };
    const changed = { id: 'job-1', updated_at: 11 };
    const unversioned = { id: 'job-1', status: 'running' };

    expect(reusePipelineJob(current, changed)).toBe(changed);
    expect(arePipelineJobsEqual(unversioned, { ...unversioned })).toBe(false);
  });

  it('reuses lists only when length, order, ids, and revisions match', () => {
    const current = [
      { id: 'job-1', updated_at: 10 },
      { id: 'job-2', updated_at: 20 }
    ];
    const equivalent = current.map((job) => ({ ...job }));
    const reordered = [equivalent[1], equivalent[0]];

    expect(arePipelineJobListsEqual(current, equivalent)).toBe(true);
    expect(reusePipelineJobList(current, equivalent)).toBe(current);
    expect(reusePipelineJobList(current, reordered)).toBe(reordered);
  });
});
