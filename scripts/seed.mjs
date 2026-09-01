/**
 * Seeds a demo-ready database.
 *
 * Story: SP-102
 *
 *   npm run seed
 *
 * Creates, in order: the demo accounts (via seed-users.mjs), the sentinel
 * baseline category plus four real ones, their question banks with answers,
 * and assessment history for the three students.
 *
 * Idempotent. Every step matches on a natural key — email, category name,
 * question text — and inserts only what is missing, so re-running is safe and
 * never duplicates a bank.
 *
 * TWO THINGS HERE ARE LOAD-BEARING AND LOOK ARBITRARY:
 *
 * 1. The baseline category is id 0 (GENERAL_KNOWLEDGE_CATEGORY_ID). Every
 *    baseline run reads `questions where category_id = 0`, so the sentinel row
 *    is inserted with an explicit key rather than a generated one.
 *
 * 2. The baseline bank is inserted in difficulty order. The paper is taken in
 *    seed order and deliberately not shuffled — everyone sits the same paper,
 *    and it is meant to ramp. tests/lib/services/assessment.service.test.ts
 *    pins that ("keeps the seed order — the paper ramps up"), so inserting
 *    these out of order would make the product wrong while the tests stay green.
 */

import { loadEnv, client, must, log, fail } from './lib.mjs';
import { seedUsers } from './seed-users.mjs';

/**
 * Mirrors GENERAL_KNOWLEDGE_CATEGORY_ID and BASELINE_QUESTION_COUNT in
 * lib/domain/constants.ts.
 *
 * Copied rather than imported: constants.ts is TypeScript inside the Next
 * build, and these scripts run under bare `node`. That makes this the same kind
 * of duplication SP-118 tracks for the SQL — if the paper size changes, it
 * changes here too.
 */
const BASELINE_CATEGORY_ID = 0;
const BASELINE_QUESTION_COUNT = 20;

// -----------------------------------------------------------------------------
// Content
//
// q(text, difficulty, correct, [wrong, wrong, wrong], topic, advice)
// -----------------------------------------------------------------------------

const q = (text, difficulty, correct, wrong, topic = null, advice = null) => ({
    text,
    difficulty,
    correct,
    wrong,
    topic_title: topic,
    study_advice: advice,
});

const CATEGORIES = [
    {
        name: 'SQL & Databases',
        description: 'Relational modelling, querying and the guarantees a database gives you.',
        questions: [
            q('Which SQL clause filters rows before any grouping happens?', 'beginner', 'WHERE', ['HAVING', 'ORDER BY', 'LIMIT'], 'Filtering', 'WHERE runs before GROUP BY; HAVING runs after. Practise reading a query in execution order, not written order.'),
            q('What does a PRIMARY KEY guarantee about a column?', 'beginner', 'It is unique and never null', ['It is indexed but may repeat', 'It is the first column', 'It is automatically a foreign key'], 'Keys', 'Read up on entity integrity and the difference between PRIMARY KEY and UNIQUE.'),
            q('Which join keeps every row from the left table?', 'beginner', 'LEFT JOIN', ['INNER JOIN', 'CROSS JOIN', 'SEMI JOIN'], 'Joins', 'Draw the Venn diagram for each join type once — it sticks better than memorising names.'),
            q('What does the "A" in ACID stand for?', 'beginner', 'Atomicity', ['Availability', 'Adaptability', 'Alignment'], 'Transactions', 'Learn all four ACID properties and what breaks when each is dropped.'),
            q('Which statement removes all rows but keeps the table structure?', 'intermediate', 'TRUNCATE', ['DROP', 'DELETE COLUMN', 'ALTER'], 'DDL vs DML', 'Compare DELETE, TRUNCATE and DROP on speed, rollback behaviour and triggers.'),
            q('An index on a column primarily improves which operation?', 'intermediate', 'Reads that filter on that column', ['Every insert', 'Disk space usage', 'Backup speed'], 'Indexing', 'Study the read/write trade-off: an index speeds lookups and slows writes.'),
            q('What problem does a foreign key constraint prevent?', 'intermediate', 'Rows referencing records that do not exist', ['Duplicate primary keys', 'Slow queries', 'Null values'], 'Referential integrity', 'Try deleting a parent row with and without ON DELETE CASCADE.'),
            q('In a normalised schema, what does 3NF chiefly remove?', 'advanced', 'Transitive dependencies on non-key columns', ['All duplicate data', 'The need for joins', 'Null values'], 'Normalisation', 'Work through 1NF to 3NF on one messy table; the progression is the lesson.'),
            q('Which isolation level allows a non-repeatable read?', 'advanced', 'READ COMMITTED', ['SERIALIZABLE', 'REPEATABLE READ', 'SNAPSHOT'], 'Isolation levels', 'Map each anomaly (dirty, non-repeatable, phantom) to the level that permits it.'),
            q('What does a window function do that GROUP BY cannot?', 'advanced', 'Return an aggregate alongside each individual row', ['Filter rows', 'Join two tables', 'Create an index'], 'Window functions', 'Rewrite one GROUP BY query using OVER() and compare the output shapes.'),
        ],
    },
    {
        name: 'JavaScript',
        description: 'The language itself: types, scope, asynchrony and the runtime model.',
        questions: [
            q('Which keyword declares a variable that cannot be reassigned?', 'beginner', 'const', ['let', 'var', 'static'], 'Declarations', 'Note that const blocks reassignment, not mutation — a const object can still change.'),
            q('What does typeof null return?', 'beginner', "'object'", ["'null'", "'undefined'", "'number'"], 'Types', 'This is a well-known historical bug. Learn the full typeof table.'),
            q('Which method adds an element to the end of an array?', 'beginner', 'push()', ['shift()', 'unshift()', 'concat()'], 'Arrays', 'Practise the four mutating methods: push, pop, shift, unshift.'),
            q('What does === compare that == does not?', 'beginner', 'The type as well as the value', ['Only the value', 'Object identity only', 'String length'], 'Equality', 'Read the coercion table for ==; then default to === always.'),
            q('What does an async function always return?', 'intermediate', 'A Promise', ['The resolved value', 'undefined', 'A callback'], 'Async', 'Write an async function returning 1 and inspect what the caller receives.'),
            q('What is a closure?', 'intermediate', 'A function that retains access to its defining scope', ['A function with no arguments', 'A self-invoking function', 'A sealed object'], 'Scope', 'Build a counter with a closure — it is the clearest single example.'),
            q('Which array method returns a new array of the same length?', 'intermediate', 'map()', ['filter()', 'reduce()', 'forEach()'], 'Array methods', 'Compare map, filter and reduce by their return types.'),
            q('In the event loop, which runs first after the current task?', 'advanced', 'Microtasks, such as promise callbacks', ['Timers set with setTimeout', 'Rendering', 'I/O callbacks'], 'Event loop', 'Log inside setTimeout and Promise.resolve().then() and predict the order first.'),
            q('What does Object.freeze() prevent?', 'advanced', 'Adding, removing or changing own properties', ['Reading properties', 'Nested mutation', 'Prototype lookups'], 'Immutability', 'Test that freeze is shallow — nested objects stay mutable.'),
            q('Why can a `this` binding be lost when passing a method as a callback?', 'advanced', 'A plain function call does not carry the receiver', ['Methods are private', 'Callbacks run in strict mode', 'The method is copied'], 'this binding', 'Fix the same bug three ways: bind, an arrow function, and a wrapper.'),
        ],
    },
    {
        name: 'Web Fundamentals',
        description: 'HTTP, the browser, semantics and accessibility.',
        questions: [
            q('Which HTTP status code means "created"?', 'beginner', '201', ['200', '204', '301'], 'HTTP status codes', 'Learn the 2xx family first, then 4xx — those two cover most real work.'),
            q('Which HTML element gives a page its main heading?', 'beginner', '<h1>', ['<title>', '<header>', '<strong>'], 'Semantic HTML', 'Read about heading order and why skipping levels hurts screen reader users.'),
            q('What does CSS "flex-direction: column" do?', 'beginner', 'Stacks items vertically', ['Centres items', 'Wraps items', 'Reverses the order'], 'Flexbox', 'Work through a flexbox playground — the main axis is the concept to nail.'),
            q('Which HTTP method should be idempotent?', 'beginner', 'PUT', ['POST', 'PATCH', 'CONNECT'], 'HTTP methods', 'Compare safe, idempotent and cacheable — they are three different properties.'),
            q('What is the purpose of the alt attribute on an image?', 'intermediate', 'To describe the image to users who cannot see it', ['To caption the image', 'To set a tooltip', 'To improve loading speed'], 'Accessibility', 'Learn when alt should be empty — decorative images take alt="".'),
            q('What does CORS control?', 'intermediate', 'Which origins may read a cross-origin response', ['Cookie encryption', 'TLS versions', 'DNS resolution'], 'CORS', 'Trace one preflight request in the network tab end to end.'),
            q('Which cookie flag stops JavaScript from reading a cookie?', 'intermediate', 'HttpOnly', ['Secure', 'SameSite', 'Path'], 'Cookie security', 'Map each flag to the attack it mitigates: HttpOnly to XSS, SameSite to CSRF.'),
            q('What does a Content Security Policy chiefly mitigate?', 'advanced', 'Cross-site scripting', ['SQL injection', 'Brute force logins', 'Slow queries'], 'CSP', 'Write a minimal CSP for a static page and watch what it blocks.'),
            q('Why does SameSite=Lax block most CSRF attacks?', 'advanced', 'Cookies are withheld from cross-site POST requests', ['Cookies are encrypted', 'Cookies expire faster', 'Cookies become HttpOnly'], 'CSRF', 'Compare Lax, Strict and None with a concrete cross-site form.'),
            q('What is the main benefit of server-side rendering?', 'advanced', 'Meaningful content in the first response', ['Smaller bundles always', 'No JavaScript needed ever', 'Faster database queries'], 'Rendering strategies', 'Compare SSR, SSG and CSR against first paint and time to interactive.'),
        ],
    },
    {
        name: 'Testing',
        description: 'What to test, at which level, and what makes a test worth keeping.',
        questions: [
            q('What does a unit test primarily isolate?', 'beginner', 'One unit of behaviour, with its collaborators substituted', ['The whole application', 'The database', 'The browser'], 'Test levels', 'Read the test pyramid and place three real tests from this project on it.'),
            q('What is a test fixture?', 'beginner', 'Known data a test starts from', ['A failing test', 'A test runner', 'A code coverage report'], 'Fixtures', 'Look at tests/helpers/builders.ts for the builder style of fixture.'),
            q('Which assertion style checks an exact value?', 'beginner', 'toEqual', ['toBeDefined', 'toBeTruthy', 'toContain'], 'Assertions', 'Prefer the most specific assertion that still describes the behaviour.'),
            q('What does "arrange, act, assert" describe?', 'beginner', 'The three phases of a well-structured test', ['A refactoring technique', 'A branching strategy', 'A deployment pipeline'], 'Test structure', 'Rewrite one tangled test into three clear blocks.'),
            q('Why is 100% coverage not the same as good tests?', 'intermediate', 'Code can execute without any behaviour being asserted', ['Coverage tools are inaccurate', 'It is too slow to reach', 'It only measures branches'], 'Coverage', 'Write a test that runs a function and asserts nothing — coverage still rises.'),
            q('What is a flaky test?', 'intermediate', 'One that passes or fails without the code changing', ['A slow test', 'A skipped test', 'A test with no assertions'], 'Flakiness', 'Common causes: real clocks, shared state, and ordering assumptions.'),
            q('Why key a mock on its arguments rather than call order?', 'intermediate', 'Reordering calls changes nothing a caller observes', ['It is faster', 'Mocks cannot count calls', 'It improves coverage'], 'Test doubles', 'See attemptsBy() in the assessment service tests for this exact pattern.'),
            q('What does an end-to-end test verify that a unit test cannot?', 'advanced', 'That the real layers work when wired together', ['That a function is pure', 'That types are correct', 'That code is formatted'], 'E2E testing', 'List the layers an E2E test crosses that a service test replaces with fakes.'),
            q('What is the risk of asserting on implementation details?', 'advanced', 'A behaviour-preserving refactor turns the suite red', ['Tests run slower', 'Coverage drops', 'Mocks stop working'], 'Test design', 'Try renaming a private helper and see which tests break.'),
            q('When should a test be deleted?', 'advanced', 'When removing it would not let a bug through', ['When it is slow', 'When it fails', 'When coverage is already high'], 'Test maintenance', 'This is the SP-100 rule in tests/README.md — apply it to your own suite.'),
        ],
    },
];

/**
 * The baseline paper: 20 questions, mixed subjects, ordered beginner ->
 * advanced. See the header — the order is the product behaviour.
 */
const BASELINE_QUESTIONS = [
    ...CATEGORIES.flatMap((c) => c.questions.filter((x) => x.difficulty === 'beginner').slice(0, 2)),
    ...CATEGORIES.flatMap((c) => c.questions.filter((x) => x.difficulty === 'intermediate').slice(0, 2)),
    ...CATEGORIES.flatMap((c) => c.questions.filter((x) => x.difficulty === 'advanced').slice(0, 1)),
].slice(0, 20);

// -----------------------------------------------------------------------------
// Steps
// -----------------------------------------------------------------------------

async function seedCategory(db, { name, description }, explicitId) {
    const found = must(
        `Reading category "${name}"`,
        await db.from('skill_categories').select('category_id').eq('name', name).maybeSingle(),
    );

    if (found) return found.category_id;

    const row = { name, description, status: 'active' };
    if (explicitId !== undefined) row.category_id = explicitId;

    const created = must(
        `Creating category "${name}"`,
        await db.from('skill_categories').insert(row).select('category_id').single(),
    );

    return created.category_id;
}

/** Inserts one question and its four options, one question at a time so the
 *  generated ids stay in the declared order. The baseline depends on it. */
async function seedQuestions(db, categoryId, questions, adminId) {
    /*
     * Every question text in the category is fetched and compared in JS rather
     * than filtered with `.in('text', texts)`.
     *
     * `.in()` serialises its values into a PostgREST filter STRING, so a value
     * containing a comma or a double quote does not round-trip: the question
     * `What does "arrange, act, assert" describe?` never matched itself, so it
     * was judged missing and re-inserted on every run. It took two runs against
     * a real database to see it, because with an empty table the bug is
     * invisible — everything is missing on the first pass anyway.
     *
     * This is the same class of bug that lib/repositories/paging.ts `likeTerm`
     * exists to prevent, and the reason its tests are mostly about quoting.
     */
    const existing = must(
        'Reading existing questions',
        await db.from('questions').select('text').eq('category_id', categoryId),
    );

    const have = new Set(existing.map((row) => row.text));
    const missing = questions.filter((x) => !have.has(x.text));

    for (const item of missing) {
        const question = must(
            'Creating question',
            await db
                .from('questions')
                .insert({
                    category_id: categoryId,
                    text: item.text,
                    difficulty: item.difficulty,
                    status: 'active',
                    source: 'manual',
                    created_by: adminId,
                    topic_title: item.topic_title,
                    study_advice: item.study_advice,
                })
                .select('question_id')
                .single(),
        );

        const options = [
            { answer_text: item.correct, is_correct: true },
            ...item.wrong.map((text) => ({ answer_text: text, is_correct: false })),
        ];

        // Shuffled so the correct answer is not always position 0 — a demo
        // where the first option is always right teaches the wrong lesson.
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        must(
            'Creating answers',
            await db.from('answers').insert(
                options.map((option, index) => ({
                    question_id: question.question_id,
                    answer_text: option.answer_text,
                    is_correct: option.is_correct,
                    position: index,
                })),
            ),
        );
    }

    return { created: missing.length, total: questions.length };
}

/**
 * Gives each student a graded history, so the dashboard, plan and admin charts
 * all have something real to draw.
 *
 * Scores differ per student on purpose: one strong, one middling, one weak
 * enough to trip WEAK_AREA_THRESHOLD and produce recommendations.
 */
async function seedHistory(db, studentIds, categoryIds) {
    const profiles = [
        { scores: [88, 92, 75], level: 'advanced' },
        { scores: [64, 71, 58], level: 'intermediate' },
        { scores: [42, 55, 38], level: 'beginner' },
    ];

    let created = 0;

    for (const [index, userId] of studentIds.entries()) {
        const profile = profiles[index % profiles.length];

        const existing = must(
            'Reading assessment history',
            await db.from('assessments').select('assessment_id').eq('user_id', userId).limit(1),
        );

        if (existing.length > 0) continue;

        for (const [n, score] of profile.scores.entries()) {
            const categoryId = categoryIds[n % categoryIds.length];
            const daysAgo = (profile.scores.length - n) * 3;
            const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

            must(
                'Creating assessment',
                await db.from('assessments').insert({
                    user_id: userId,
                    category_id: categoryId,
                    requested_level: profile.level,
                    status: 'submitted',
                    total_score: score,
                    time_limit_seconds: 600,
                    created_at: at,
                    started_at: at,
                    submitted_at: at,
                }),
            );

            must(
                'Recording category progress',
                await db.from('category_progress').upsert(
                    {
                        user_id: userId,
                        category_id: categoryId,
                        current_level: profile.level,
                        last_score: score,
                        last_assessed_at: at,
                    },
                    { onConflict: 'user_id,category_id' },
                ),
            );

            created++;
        }
    }

    return created;
}

// -----------------------------------------------------------------------------

loadEnv();
const db = client();

console.log('\n  Seeding SkillPath\n');

const { admin, students } = await seedUsers(db);

if (!admin || students.some((id) => !id)) {
    fail('Users were not created.', 'Check the users table and the key in .env.local.');
}

const baselineId = await seedCategory(
    db,
    {
        name: 'General Knowledge',
        description: 'The baseline paper everyone sits once, drawn from every subject.',
    },
    BASELINE_CATEGORY_ID,
);

if (baselineId !== BASELINE_CATEGORY_ID) {
    fail(
        `The baseline category came back as id ${baselineId}, not ${BASELINE_CATEGORY_ID}.`,
        'Every baseline run reads category_id = 0. Delete that row and re-run, or fix GENERAL_KNOWLEDGE_CATEGORY_ID.',
    );
}

/**
 * The baseline bank is seeded only into an EMPTY category 0.
 *
 * Matching on question text makes every other step idempotent, but it is not
 * enough here, because the baseline paper is `the first BASELINE_QUESTION_COUNT
 * active questions by id` — not "the ones this script wrote". Appending twenty
 * more to a category that already has twenty leaves forty in the bank, and
 * which twenty a member actually sits then depends on insertion order rather
 * than on anything anyone chose.
 *
 * So: if a usable bank is already there, leave it completely alone and say so.
 * That is also the honest answer for a database seeded by hand before this
 * script existed.
 */
const { count: activeBaseline, error: countError } = await db
    .from('questions')
    .select('question_id', { count: 'exact', head: true })
    .eq('category_id', BASELINE_CATEGORY_ID)
    .eq('status', 'active');

if (countError) fail(`Counting the baseline bank failed: ${countError.message}`, 'Nothing was written.');

if ((activeBaseline ?? 0) >= BASELINE_QUESTION_COUNT) {
    log(
        `baseline bank: left alone — ${activeBaseline} active questions already in category ` +
            `${BASELINE_CATEGORY_ID}, which is enough for a paper of ${BASELINE_QUESTION_COUNT}`,
    );
} else {
    const baseline = await seedQuestions(db, BASELINE_CATEGORY_ID, BASELINE_QUESTIONS, admin);
    log(`baseline bank: ${baseline.created} created, ${baseline.total} total`);
}

const categoryIds = [];

for (const category of CATEGORIES) {
    const id = await seedCategory(db, category);
    categoryIds.push(id);

    const result = await seedQuestions(db, id, category.questions, admin);
    log(`${category.name}: ${result.created} created, ${result.total} total`);
}

const history = await seedHistory(db, students, categoryIds);
log(`assessment history: ${history} runs created`);

console.log('\n  Done. Sign in as admin@skillpath.test / skillpath123\n');
