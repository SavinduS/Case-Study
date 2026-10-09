// Runs before the test files (and therefore before dotenv loads backend/.env).
// The dev .env sets ALLOW_OUTSIDE_AREA=true so the app can be tested from
// anywhere, but the suite must still prove E2 (area policy -> 422), so pin it
// off here. dotenv never overwrites variables that already exist.
process.env.ALLOW_OUTSIDE_AREA = 'false';
