if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Automated tests must use a dedicated *_test database (set TEST_DATABASE_URL)');
}
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)) {
  throw new Error('Refusing to run automated tests against a non-local database');
}
