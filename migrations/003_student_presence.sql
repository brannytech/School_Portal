CREATE TABLE IF NOT EXISTS student_presence (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 last_seen TEXT NOT NULL
);
