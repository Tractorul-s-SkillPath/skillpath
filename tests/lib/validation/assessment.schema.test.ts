import { describe, it, expect } from 'vitest';
import { submitSchema } from '../../../lib/validation/assessment.schema';

describe('Assessment Validation', () => {
  it('acceptă un payload valid conținând doar assessmentId (SP-055)', () => {
    const validSubmit = { assessmentId: 1234 };
    expect(submitSchema.safeParse(validSubmit).success).toBe(true);
  });

  it('ignoră/elimină un scor falsificat din payload', () => {
    const forgedSubmit = {
      assessmentId: 1234,
      total_score: 100
    };

    const result = submitSchema.safeParse(forgedSubmit);
    expect(result.success).toBe(true);
    expect((result.data as any).total_score).toBeUndefined();
  });
});