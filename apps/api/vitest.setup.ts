process.env.DATABASE_URL ??= "postgresql://hero:hero@localhost:5433/hero";
process.env.JWT_SECRET ??= "ci-test-secret-at-least-32-characters-long";
process.env.NODE_ENV ??= "test";
