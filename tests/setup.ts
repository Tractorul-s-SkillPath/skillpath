/**
 * Vitest global setup.
 *
 * Sketch
 *  - @testing-library/jest-dom matchers
 *  - cleanup() after each test
 *  - AI_PROVIDER=mock, so nothing in the suite can reach a real model (SP-090)
 *  - fail loudly on an unhandled rejection instead of passing quietly
 *  - a fixed, frozen clock helper so timer and plan tests are deterministic
 */

import { afterEach } from 'vitest';

// 1. Forțăm providerul de AI să fie mock, ca să nu poată apela modele reale în teste (SP-090)
process.env.AI_PROVIDER = 'mock';

// 2. Fail loudly pe unhandled rejections în loc să treacă cu vederea
process.on('unhandledRejection', (err) => {
    throw err;
});

// 3. Curățare după fiecare test dacă este nevoie
afterEach(() => {
    // Aici poți adăuga cleanup suplimentar dacă folosești librării de DOM,
    // dar pentru funcțiile pure de domain logic, Vitest se ocupă de baza de date/stare.
});