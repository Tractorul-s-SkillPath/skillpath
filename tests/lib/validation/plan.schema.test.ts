import { describe, it, expect } from 'vitest';
import { planStatusSchema } from '../../../lib/validation/plan.schema';

describe('Learning Plan Validation', () => {
  it('acceptă o actualizare validă a statusului', () => {
    const validUpdate = {
      recommendationId: 10,
      status: 'completed'
    };
    expect(planStatusSchema.safeParse(validUpdate).success).toBe(true);
  });

  it('respinge o stare de progres necunoscută', () => {
    const invalidStatus = {
      recommendationId: 10,
      status: 'done_yesterday'
    };
    expect(planStatusSchema.safeParse(invalidStatus).success).toBe(false);
  });
});