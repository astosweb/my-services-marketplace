process.env.DATABASE_URL ??= "postgresql://ci:ci@127.0.0.1:5432/ci";
process.env.JWT_SECRET ??= "ci-test-secret-at-least-32-characters-long";
process.env.NODE_ENV ??= "test";
