CREATE TABLE IF NOT EXISTS academic_terms (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES academic_sessions(id), number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 3), title TEXT NOT NULL, UNIQUE(session_id,number));
CREATE TABLE IF NOT EXISTS score_history (id TEXT PRIMARY KEY, score_id TEXT NOT NULL REFERENCES scores(id), teacher_id TEXT NOT NULL REFERENCES users(id), content TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS discussion_replies (id TEXT PRIMARY KEY, discussion_id TEXT NOT NULL REFERENCES discussions(id), author_id TEXT REFERENCES users(id), position INTEGER NOT NULL, content TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS reply_thread ON discussion_replies(discussion_id,position);
