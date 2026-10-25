-- Per-user UI preferences (table layouts, etc.). Org-wide defaults stay in system_settings.

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id VARCHAR(36) NOT NULL,
    pref_key VARCHAR(100) NOT NULL,
    pref_value JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, pref_key),
    CONSTRAINT fk_user_preferences_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_preferences_key ON user_preferences (pref_key);
