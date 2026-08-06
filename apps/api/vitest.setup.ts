process.env.DATABASE_URL ??= "postgresql://gobid:gobid@localhost:5433/gobid";
process.env.JWT_SECRET ??= "ci-test-secret-at-least-32-characters-long";
process.env.NODE_ENV ??= "test";
