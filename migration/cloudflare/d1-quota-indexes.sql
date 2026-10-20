-- Migration to isolated staging D1 only, never production.
-- Cloudflare Insights 2026-10-19: event relation 2,802,989 reads (fixed in Worker).
-- Media lookups 961,857 reads: use two indexed key lookups rather than a table scan.
CREATE INDEX IF NOT EXISTS idx_celebrations_contents_storage_path ON celebrations_contents(storage_path);
CREATE INDEX IF NOT EXISTS idx_celebrations_contents_cover_storage_path ON celebrations_contents(cover_storage_path);
-- Historical statistics 2.32M+ rows: reuse private 15-minute summary cache,
-- and permit SQLite to group/filter on small covering partial indexes.
CREATE INDEX IF NOT EXISTS idx_celebrations_clicks_resource_summary ON celebrations_clicks(target_kind,target_label,clicked_at) WHERE target_kind<>'page-view';
CREATE INDEX IF NOT EXISTS idx_celebrations_clicks_page_summary ON celebrations_clicks(COALESCE(page_path,'/'),visitor_id) WHERE target_kind='page-view';
