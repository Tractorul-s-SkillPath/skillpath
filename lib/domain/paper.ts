/**
 * Drawing a paper from a question bank — pure, randomness injected.
 *
 * Story: SP-041
 *
 * The baseline never draws: its twenty are fixed in seed order by team
 * decision. Category assessments DO draw, so two attempts at the same category
 * are not the same paper — that is the feature, and it is why retakes are
 * allowed there and not on the baseline.
 *
 * `random` is a parameter so a test can pass a deterministic sequence; only
 * the service passes Math.random.
 */

/**
 * Up to `size` question ids, drawn without replacement, in shuffled order.
 *
 * Fisher–Yates on a copy — the input array is never touched. When the bank is
 * smaller than the paper, the whole bank comes back (still shuffled): the
 * caller decides the minimum a paper may hold, this only draws.
 */
export function drawPaper(
    questionIds: readonly number[],
    size: number,
    random: () => number = Math.random,
): number[] {
    const drawn = [...questionIds];

    for (let i = drawn.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [drawn[i], drawn[j]] = [drawn[j], drawn[i]];
    }

    return drawn.slice(0, Math.max(0, size));
}
