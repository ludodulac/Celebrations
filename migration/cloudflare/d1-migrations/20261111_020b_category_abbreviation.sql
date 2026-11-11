-- Additive; apply with the release, never automatically to official data.
ALTER TABLE celebrations_directory_member_types ADD COLUMN abbreviation TEXT CHECK(abbreviation IS NULL OR length(abbreviation) BETWEEN 1 AND 16);
