-- M030 / Mission 05 — activation différée APRÈS le nettoyage officiel.
-- Ne jamais appliquer directement pendant M05 : Michaël 2026 est actuellement
-- présent 3 fois (101,105,106). Cette migration est MANUELLE et n'est pas dans
-- d1-migrations/ (aucun déploiement automatique).
-- Exécuter uniquement après sauvegarde récente vérifiée, reprise du nettoyage
-- M04 sur les données actuelles, protection de 101 et contrôle:
-- SELECT archangel,year,COUNT(*) n FROM celebrations_celebrations
-- GROUP BY archangel,year HAVING COUNT(*)>1;
-- et seulement après obtention de zéro ligne.
-- L'index garantit que 2 créations simultanées ne pourront pas dupliquer
-- le même cycle. Les 56 slots et le contrôle des 4 archanges sont assurés
-- par le domaine unique celebration-cycle-registry.mjs (côté serveur).
CREATE UNIQUE INDEX IF NOT EXISTS idx_celebrations_archangel_year_unique
  ON celebrations_celebrations(lower(trim(archangel)),trim(year));
