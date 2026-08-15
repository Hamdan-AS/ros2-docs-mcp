import pg from "pg";

// Cloud (Neon) path: one DATABASE_URL with SSL. Local dev keeps the default
// ROS2DOCS_DB_* overrides and plain TCP on 127.0.0.1.
const databaseUrl = process.env.DATABASE_URL ?? process.env.ROS2DOCS_DATABASE_URL;

export const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    })
  : new pg.Pool({
      host: process.env.ROS2DOCS_DB_HOST ?? "127.0.0.1",
      port: Number(process.env.ROS2DOCS_DB_PORT ?? 5432),
      user: process.env.ROS2DOCS_DB_USER ?? "ros2docs",
      password: process.env.ROS2DOCS_DB_PASSWORD ?? "ros2docs",
      database: process.env.ROS2DOCS_DB_NAME ?? "ros2docs",
    });
