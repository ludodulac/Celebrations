# CELEBRATIONS-PUBLIC-006 — Arbitrage ciblé

**RESULT : PARTIAL — audit conservateur, sans suppression.** Base de travail : les 46 fichiers et 58 contenus UNCERTAIN du rapport PUBLIC-005 uniquement. La seule célébration réelle est **Michaël 2026 (ID 101)**. Les IDs 102, 103 et 104 sont des idées, sans valeur de conservation; ils restent intacts. Catégorie FUTURE interdite.

## Règles et preuves

1. **KEEP / committee** : la fonction déployée `celebrations-committee-public` (Supabase Edge Function) accepte sans authentification `GET ?slug=<slug>` ou `?id=<id>`, cherche dans `celebrations_committee_letters` et télécharge le `storage_path` du bucket. `index.html` redirige `?lettre=<slug>` vers cette fonction. Les 9 documents ont une ligne SQL réelle. Chemin public direct démontré, même si aucune carte de navigation n'est affichée.
2. **DELETE_CANDIDATE / tests** : 7 objets sous `tests/seed-2026-09-06/`, sans référence dans `celebrations_contents`, sans association événement, sans correspondance dans les mécanismes de galerie, accueil ou comité identifiés. Ce sont des objets de test et non des contenus de la célébration 101. **Attention :** une URL Storage directement partagée hors du site ne peut pas être exclue par cet audit; la décision porte uniquement sur les parcours du site.
3. **UNCERTAIN / autres médias** : aucune route publique de l'application identifiée dans PUBLIC-005, mais il reste impossible d'exclure toutes les URL directes externes, chemins historiques ou références dynamiques. Aucune suppression proposée.
4. **UNCERTAIN / contenus SQL** : 58 entrées non associées aux mécanismes publics déjà vérifiés. La preuve négative exhaustive (tous scripts, routes et états conditionnels) n'est pas acquise; aucune entrée n'est classée supprimable.

## Synthèse du périmètre

| Catégorie | Fichiers (sur 46) | Contenus SQL (sur 58) |
|---|---:|---:|
| KEEP | 9 | 0 |
| DELETE_CANDIDATE | 7 | 0 |
| UNCERTAIN | 30 | 58 |

**Économie potentielle des seuls DELETE_CANDIDATE : 0.005350 Mo (5350 octets). Économie certifiée sans risque de lien externe : non établie.**

## Liste nominative des 46 fichiers

| Décision | Chemin exact | Octets | Preuve et réserve |
|---|---|---:|---|
| KEEP | `committee/13d00304-16e6-45c8-9011-d9c0928592bd/1.-Lettres-de-Gerard-Saintete.pdf` | 115495 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| KEEP | `committee/265c3dba-d8d5-4d47-90df-7e0bebee75e1/5.-Messages-brefs-des-Esseniens.pdf` | 305406 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| KEEP | `committee/3ca14831-489e-4596-a9ad-3cdba01734f2/Lettre-hebdomadaire-20-26.09.pdf` | 1559252 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| KEEP | `committee/56d495c3-e196-4982-b281-ce2091e89c79/01_M.286_Michael2026.pdf` | 60831 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| KEEP | `committee/5dbf4dec-149c-429c-a5cf-3438134c769e/7.-Lettre-comite-11.09.26.pdf` | 157560 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| KEEP | `committee/790fb6b8-fdc1-481b-852d-6293c427cbea/2.-Temoignage-de-Sara-Amour.pdf` | 169489 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| KEEP | `committee/9eb2f14c-26df-4162-85c7-d8a75ee61211/4.-Lettre-collective.pdf` | 26315 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| KEEP | `committee/ee306396-fca3-4d35-8307-0b5dce866688/6.-Messages-longs-des-Esseniens.pdf` | 482030 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| KEEP | `committee/f9f87b41-4fe4-4e88-87e1-7a878854274d/3.-Lettre-de-Raphael-Sacre.pdf` | 76301 | Entrée celebrations_committee_letters et route publique GET celebrations-committee-public?id/slug |
| DELETE_CANDIDATE | `tests/seed-2026-09-06/image1.svg` | 491 | Objet seed de test; aucune association aux mécanismes publics connus; URL directe externe non vérifiable |
| DELETE_CANDIDATE | `tests/seed-2026-09-06/image2.svg` | 491 | Objet seed de test; aucune association aux mécanismes publics connus; URL directe externe non vérifiable |
| DELETE_CANDIDATE | `tests/seed-2026-09-06/image3.svg` | 491 | Objet seed de test; aucune association aux mécanismes publics connus; URL directe externe non vérifiable |
| DELETE_CANDIDATE | `tests/seed-2026-09-06/pdf1.pdf` | 590 | Objet seed de test; aucune association aux mécanismes publics connus; URL directe externe non vérifiable |
| DELETE_CANDIDATE | `tests/seed-2026-09-06/pdf2.pdf` | 590 | Objet seed de test; aucune association aux mécanismes publics connus; URL directe externe non vérifiable |
| DELETE_CANDIDATE | `tests/seed-2026-09-06/pdf3.pdf` | 590 | Objet seed de test; aucune association aux mécanismes publics connus; URL directe externe non vérifiable |
| DELETE_CANDIDATE | `tests/seed-2026-09-06/son-test.mp3` | 2107 | Objet seed de test; aucune association aux mécanismes publics connus; URL directe externe non vérifiable |
| UNCERTAIN | `media/1788783034231/file-1788783035309-Preparation_Michael-2025.pdf` | 1358684 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1788783111698/file-1788783112836-textes-des-7-flammes.pdf` | 148609 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789503607933/file-1789503609434-54.-Ceremonie-Soleil-de-l-ame---RADOM-MICHAEL-2026.pdf` | 446072 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789508814934/file-1789508816551-Meditation-Ceremonie-Soleil-de-lAme.opus` | 406162 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789541675695/file-1789541677704-Allume-ta-bougie.pdf` | 25144 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789541698067/file-1789541699685-L-appel-des-Maitres.pdf` | 31490 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789541734174/file-1789541736769-Devant-toi-o-Pere.pdf` | 31141 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789541895480/file-1789541897527-L-erable-Roi.pdf` | 38622 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789541933453/file-1789541935364-L-Ange-du-Pere.pdf` | 27102 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789541955010/file-1789541956857-La-Ronde-des-Archanges.pdf` | 32241 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789543339280/file-1789543340143-Pardon-des-offenses-en-massala-individuelle-complet.pdf` | 1597061 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789545637540/file-1789545640591-Meditation-Ceremonie-le-Soleil-de-l-Ame.mp3` | 2683821 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789547654631/file-1789547656336-54.-Ceremonie-Soleil-de-l-ame--Michael-2026.pdf` | 258178 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789570893634/file-1789570894958-Pardon-des-Offenses-version-raccourcie.pdf` | 1189910 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789613674590/file-1789613674922-Loic-web.jpg` | 27300 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/1789728847061/file-1789728848732-54.-Version-Finale-Ceremonie-Soleil-de-l-ame---RADOM-MICHAEL-2026.pdf` | 445893 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/audio-1789475832935-0-anspi/file-1789475835409-47.-Commentacquerirlepardondesoffenses.Meditation.Olivier.wma` | 25973713 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/audio-1789475895080-1-grroh/file-1789475896895-53.-Meditation---Le-soleil-de-la-Paix.wma` | 11344936 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/audio-1789476123329-1-12bo0/file-1789476124890-69.4-chant---Zoroastre.mp3` | 7738650 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/guide-file-20/file-drive-20.-Recommandations-pour-commencer-la-celebration-a-domicile.pdf` | 586938 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/guide-file-291/file-drive-291.-cercle-d-entraide.pdf` | 69387 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543188669-0-aa3c4/file-1789543189979-41.-Voeu-de-larchange-Michael.pdf` | 2450803 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543198382-1-ydbp6/file-1789543199128-43.-Rituel-pour-la-Paix-Travail-magique-de-preparation-Michael.pdf` | 1068245 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543203843-2-y6cf0/file-1789543204944-48.-Travail-de-l-automne-a-l-Erable.pdf` | 397484 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543208207-3-97267/file-1789543208659-51.-Rituel-de-purification-des-7-Flammes.Erable.pdf` | 314689 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543210789-4-wyfqa/file-1789543211287-60.-Arcana-7-regles-de-Michael.pdf` | 399583 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543213449-5-ch0m5/file-1789543214488-61.-La-RA-universelle-pour-les-esseniens.pdf` | 2178416 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543221723-6-hosto/file-1789543222418-62.-La-RA-universelle-Rituel-en-Massala-individuelle.pdf` | 1762773 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543225987-7-23lgi/file-1789543226354-66.-Priere-a-Michael.pdf` | 108726 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |
| UNCERTAIN | `media/pdf-1789543227555-8-b1hbq/file-1789543228274-67.-Med.Celui.qui.sapproche.du.feu.sapproche.du.bonheur.pdf` | 175956 | Aucune route publique identifiée dans PUBLIC-005; recherche négative exhaustive non prouvée |

## Liste nominative des 58 contenus SQL — UNCERTAIN

| ID | Nom | Type | Chemin | Motif |
|---|---|---|---|---|
| `1788783034231` | Préparation Michael | PDF | `media/1788783034231/file-1788783035309-Preparation_Michael-2025.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1788783111698` | Textes des 7 flammes | PDF | `media/1788783111698/file-1788783112836-textes-des-7-flammes.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789541675695` | Allume ta bougie | PDF | `media/1789541675695/file-1789541677704-Allume-ta-bougie.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789541698067` | L’appel des Maîtres | PDF | `media/1789541698067/file-1789541699685-L-appel-des-Maitres.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789541734174` | Devant toi, ô Père | PDF | `media/1789541734174/file-1789541736769-Devant-toi-o-Pere.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789541895480` | L’Érable Roi | PDF | `media/1789541895480/file-1789541897527-L-erable-Roi.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789541933453` | L’Ange du Père | PDF | `media/1789541933453/file-1789541935364-L-Ange-du-Pere.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789541955010` | La Ronde des Archanges | PDF | `media/1789541955010/file-1789541956857-La-Ronde-des-Archanges.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789543339280` | Pardon-des-offenses-en-massala-individuelle-complet.pdf | PDF | `media/1789543339280/file-1789543340143-Pardon-des-offenses-en-massala-individuelle-complet.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789545637540` | Méditation — Cérémonie Le Soleil de l’âme | Audio | `media/1789545637540/file-1789545640591-Meditation-Ceremonie-le-Soleil-de-l-Ame.mp3` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789547654631` | Cérémonie Le Soleil de l’âme — Michaël 2026 | PDF | `media/1789547654631/file-1789547656336-54.-Ceremonie-Soleil-de-l-ame--Michael-2026.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789570893634` | Pardon-des-Offenses-version-raccourcie.pdf | PDF | `media/1789570893634/file-1789570894958-Pardon-des-Offenses-version-raccourcie.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `1789728847061` | Cérémonie Soleil de l'Âme à domicile | PDF | `media/1789728847061/file-1789728848732-54.-Version-Finale-Ceremonie-Soleil-de-l-ame---RADOM-MICHAEL-2026.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `audio-1789476123329-1-12bo0` | Chant — « Zoroastre » | Audio | `media/audio-1789476123329-1-12bo0/file-1789476124890-69.4-chant---Zoroastre.mp3` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-41` | Sceau du travail | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-43` | Mandala Soleil Nation | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-45` | Aigle messager — Sceau du Pardon des offenses | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-46` | Arbre de la conscience du bien et du mal II | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-47` | Olivier Manitara — sépia claire | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-48` | Michaël — automne | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-48-feuille` | Feuille d’Érable | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-51` | Aigle Telesma | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-52` | Ange du Sacré | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-53` | Ange Soleil — Lettres | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-54` | Ménorah | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-55` | Lumière du Soleil | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-60` | Mandala du Travail | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-61` | Ronde des Archanges | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-62` | Tapis de prière | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-63` | Tenture du culte | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-64` | Sceau du travail | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-65` | Monde des conscients | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-66` | Michaël | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-67` | Mandala du Feu | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-68` | Christ | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-69-1` | Feu A | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-69-2` | Feu B | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-69-3` | Feu C | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-69-4` | Zoroastre — sépia | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-70` | Sol 1 | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-71` | Sol 2 | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-72` | Sol 3 | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-image-73` | Sol 4 | Image | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `guide-video-temple-mere-monde` | Temple de la Mère du monde | Vidéo | `` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466801418-0-7fyln` | Les 4 sceaux du Pardon des offenses | PDF | `media/pdf-1789466801418-0-7fyln/file-1789466803207-4-sceaux-du-Pardon-des-offenses.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466846000-11-r03oi` | 3999. Texte de présentation d'Essene Radio.pdf | PDF | `media/pdf-1789466846000-11-r03oi/file-1789466847327-3999.-Texte-de-presentation-d-Essene-Radio.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466847537-12-ohik4` | Cartouche-Maison-de-dieu-couleur.pdf | PDF | `media/pdf-1789466847537-12-ohik4/file-1789466848856-Cartouche-Maison-de-dieu-couleur.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466862592-16-5e6cv` | Lignee-maitres-PdO.pdf | PDF | `media/pdf-1789466862592-16-5e6cv/file-1789466864103-Lignee-maitres-PdO.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466865353-17-pef4g` | Message-des-animaux-a-lhumanite-2009.pdf | PDF | `media/pdf-1789466865353-17-pef4g/file-1789466866702-Message-des-animaux-a-lhumanite-2009.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466866798-18-hrejv` | Message-des-Maitres-a-lhumanite-2009.pdf | PDF | `media/pdf-1789466866798-18-hrejv/file-1789466868111-Message-des-Maitres-a-lhumanite-2009.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466868119-19-l4b7z` | Message-des-pierres-a-lhumanite-2009.pdf | PDF | `media/pdf-1789466868119-19-l4b7z/file-1789466869700-Message-des-pierres-a-lhumanite-2009.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466869961-20-5tlnk` | Message-des-vegetaux-a-lhumanite-2009.pdf | PDF | `media/pdf-1789466869961-20-5tlnk/file-1789466871216-Message-des-vegetaux-a-lhumanite-2009.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466870869-21-mfdhf` | Pardon-des-offenses-en-massala-individuelle-complet.pdf | PDF | `media/pdf-1789466870869-21-mfdhf/file-1789466872134-Pardon-des-offenses-en-massala-individuelle-complet.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466884096-23-ud8wm` | Prière d'alliance avec la Tradition des Maîtres.pdf | PDF | `media/pdf-1789466884096-23-ud8wm/file-1789466885772-Priere-d-alliance-avec-la-Tradition-des-Maitres.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466886555-24-ruu1h` | Prière d'alliance avec les animaux.pdf | PDF | `media/pdf-1789466886555-24-ruu1h/file-1789466887878-Priere-d-alliance-avec-les-animaux.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466889743-25-j7ak1` | Prière d'alliance avec les mineraux.pdf | PDF | `media/pdf-1789466889743-25-j7ak1/file-1789466891908-Priere-d-alliance-avec-les-mineraux.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466894755-26-q30vr` | Prière d'alliance avec les végétaux.pdf | PDF | `media/pdf-1789466894755-26-q30vr/file-1789466896161-Priere-d-alliance-avec-les-vegetaux.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |
| `pdf-1789466897779-27-xlbzi` | Textes du Pardon des offenses — sceaux | PDF | `media/pdf-1789466897779-27-xlbzi/file-1789466899164-Textes-pardon-offenses-sceaux.pdf` | Aucun chemin via événement 101, accueil, galerie identifié; autres routes ou URL historiques non exclues |

## Points restant à certifier

- Inspection exhaustive des autres scripts publics et routes secondaires, y compris leurs paramètres, données conditionnelles et fallback.
- Correspondance des 58 contenus avec d'éventuels liens enregistrés dans les 23 entrées de `celebrations_links` ou liens HTML directs, y compris URL complètes.
- Vérification d'éventuels partages directs des fichiers Storage hors site : impossible à démontrer à partir des seules tables applicatives.
- Vérification de la disponibilité effective des 9 PDF du comité (le chemin HTTP public est prouvé par le code serveur, pas le résultat réseau de chaque téléchargement).

**Aucune modification de production, aucun fichier supprimé, aucune fusion.**
