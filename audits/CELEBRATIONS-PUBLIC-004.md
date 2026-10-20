# CELEBRATIONS-PUBLIC-004 — Audit conservateur des usages publics

**Statut : PARTIAL. AUCUNE SUPPRESSION AUTORISÉE.** Lecture seule Supabase, code public examiné. Ce document est un instantané des données; les écrans conditionnels et les liens externes n'ont pas été certifiés par navigation réelle.

## Méthode
- `KEEP` : objet dont le chemin est associé à un contenu lié à un événement, donc potentiellement affiché sur une page publique. C'est une classification de préservation, **pas une preuve de chargement réseau**.
- `UNCERTAIN` : aucune association événement directe; la bibliothèque d'images, l'accueil, les documents du comité, les routes conditionnelles, les URLs codées en dur et les anciens liens peuvent néanmoins l'utiliser.
- `DELETE_CANDIDATE` : **aucun**; l'absence d'usage public n'a pas été démontrée exhaustivement.

## Résultats
- Bucket: **158 objets**, 830.31 MB.
- KEEP 97; DELETE_CANDIDATE 0; UNCERTAIN 61.
- Base: 211 contenus; KEEP 108; DELETE_CANDIDATE 0; UNCERTAIN 103.
- Liens: 23 entrées; toutes UNCERTAIN quant à leur visibilité effective.
- Économie certifiée: **0 MB**. Aucune liste de suppression nominative certifiée.

## Obstacles
La visibilité dépend de la célébration active et de `celebrations-visibility`; `public-library-simple.js` filtre les contenus audio/vidéo/PDF par associations événement, mais possède une galerie d'images distincte. `public-celebration-shell.js` peut charger l'image shin.png hors de ces associations. Les documents du comité et les liens directs peuvent être exposés par d'autres chemins. Il faut certifier ces mécanismes et les anciennes URL externes avant de conclure à une absence d'usage. Les contenus sans association ne sont **pas** automatiquement supprimables.

## Inventaire exhaustif des objets (158)

| Décision | Chemin exact | Taille (octets) | MIME | Preuve / mécanisme |
|---|---|---:|---|---|
| KEEP | `media/1788883713005/cover-drive-12.-Ange-Subtilite.png` | 591716 | image/png | event_association |
| KEEP | `media/1788883713005/file-drive-12.Travail-preparation-MICHAEL-2026.pdf` | 176086 | application/pdf | event_association |
| KEEP | `media/1789374359623/cover-drive-26.-Olivier-M.jpg` | 12969 | image/jpeg | event_association |
| KEEP | `media/1789374359623/file-1789374361142-26.-2008-09-18-les-7-flammes-de-larchange-michael.mp3` | 49040973 | audio/mpeg | event_association |
| KEEP | `media/1789374573022/cover-drive-33.-flamme.webp` | 14708 | image/webp | event_association |
| KEEP | `media/1789374573022/file-1789374573727-33.-Allume-ta-bougie.mp3` | 5394870 | audio/mpeg | event_association |
| KEEP | `media/1789378707546/cover-drive-34.-Les-4-corps-formations-esseniennes-960x960-1.jpg` | 85739 | image/jpeg | event_association |
| KEEP | `media/1789378707546/file-1789378708136-34.-Lappel-des-Maitres.mp3` | 12046627 | audio/mpeg | event_association |
| KEEP | `media/1789378874624/cover-drive-27.-OLIVIER_MANITARA.jpg` | 69867 | image/jpeg | event_association |
| KEEP | `media/1789378874624/file-1789378875352-27.-2008-10-26-le-secret-des-2-menorahs-1-.mp3` | 24063259 | audio/mpeg | event_association |
| KEEP | `media/1789378944334/cover-drive-35.-BANNIERE-VIERGE-MICHAEL2025-scaled.jpg` | 320522 | image/jpeg | event_association |
| KEEP | `media/1789378944334/file-1789378944912-35.-Om-Amin-essenien.mp3` | 22164715 | audio/mpeg | event_association |
| KEEP | `media/1789504520605/file-1789504522495-Devant-toi-O-Pere.mp3` | 22035888 | audio/mpeg | event_association |
| KEEP | `media/1789504578367/file-1789504580033-Chant-ceremonie-Pardon-offenses-3eme-voix-Enoch.mp3` | 34562551 | audio/mpeg | event_association |
| KEEP | `media/1789508729530/file-1789508731574-Toutes-les-prieres-dAlliance-avec-les-regnes.pdf` | 455834 | application/pdf | event_association |
| KEEP | `media/1789508765429/file-1789508766988-Tous-les-message-des-regnes-de-la-mere-a-lhumanite.pdf` | 334522 | application/pdf | event_association |
| KEEP | `media/1789545298560/file-1789545301973-47.Comment-acquerir-le-pardon-des-offenses.Meditation.Olivier.mp3` | 30870768 | audio/mpeg | event_association |
| KEEP | `media/1789545428732/file-1789545429921-53.Meditation-Le-soleil-de-la-Paix-.mp3.mp3` | 9960593 | audio/mpeg | event_association |
| KEEP | `media/1789568022089/file-1789568023987-399.-cercle-d-entraide.pdf` | 62312 | application/pdf | event_association |
| KEEP | `media/1789570630324/file-1789570631579-Chant-de-la-Joie.mp3` | 3389346 | audio/mpeg | event_association |
| KEEP | `media/1789570691525/file-1789570692765-20.-Recommandations-pour-commencer-la-celebration-a-domicile.pdf` | 728554 | application/pdf | event_association |
| KEEP | `media/1789570778587/file-1789570779702-Textes-Sceaux-Cartouche-pardon-offenses.pdf` | 2745722 | application/pdf | event_association |
| KEEP | `media/1789573963805/file-1789573965685-Chanson-plus-de-guerre.mp3` | 10575496 | audio/mpeg | event_association |
| KEEP | `media/1789646249854/file-1789646250679-Astrologie-Angelique-Cache.pdf` | 163535 | application/pdf | event_association |
| KEEP | `media/1789664131528/file-1789664132139-02_M.102_Michael2026.pdf` | 43938 | application/pdf | event_association |
| KEEP | `media/1789664258461/file-1789664259369-01_M.286_Michael2026.pdf` | 69944 | application/pdf | event_association |
| KEEP | `media/1789709910664/file-1789709912535-AUD-20260918-WA0009.mp3` | 8991440 | audio/mpeg | event_association |
| KEEP | `media/1789710019027/file-1789710020554-Melodie-dinvocation-de-lArchange-Michael-2.mp3` | 23877007 | audio/mpeg | event_association |
| KEEP | `media/1789728956742/file-1789728957285-sceaux-Archanges-grand-formats.pdf` | 3389919 | application/pdf | event_association |
| KEEP | `media/1789736265919/cover-1789736491904-1000036736.jpg` | 385046 | image/jpeg | event_association |
| KEEP | `media/1789736265919/file-1789736267548-04_M.62_2026.pdf` | 50906 | application/pdf | event_association |
| KEEP | `media/1789737752087/file-1789737753888-54.-VERY-LAST-VERSION-Ceremonie-Soleil-de-l-ame---RADOM-MICHAEL-2026.pdf` | 446018 | application/pdf | event_association |
| KEEP | `media/1789740282061/file-1789740283467-2026-09-17_Temple-matin---Michael-Ps-286.mp3` | 24882460 | audio/mpeg | event_association |
| KEEP | `media/1789740506740/file-1789740509412-2026-09-17_Temple-midi---Michael-Ps-102.mp3` | 22386722 | audio/mpeg | event_association |
| KEEP | `media/1789748941014/file-1789748942178-2026-09-17_Temple-soir---Michael-Ps-13.mp3` | 46281873 | audio/mpeg | event_association |
| KEEP | `media/1789751775833/file-1789751777288-05_M.28_2026.pdf` | 39222 | application/pdf | event_association |
| KEEP | `media/1789759552378/file-1789759553733-2026-09-18_Temple-matin---Michael-Ps-62.mp3` | 22068811 | audio/mpeg | event_association |
| KEEP | `media/1789759825105/file-1789759828522-2026-09-18_Temple-midi---Michael-Ps-28.mp3` | 23129122 | audio/mpeg | event_association |
| KEEP | `media/1789770220036/file-1789770221539-2026-09-18_Temple-soir---Michael-Ps-39.mp3` | 46306950 | audio/mpeg | event_association |
| KEEP | `media/1789828826510/file-1789828828042-07_M.154_2026.pdf` | 69062 | application/pdf | event_association |
| KEEP | `media/1789828859982/file-1789828861580-Renouvellement-engagements-eternels-RAU-a-domicile.pdf` | 101174 | application/pdf | event_association |
| KEEP | `media/1789828905376/file-1789828906802-2026-09-19_Temple-matin---Michael-Ps-154.mp3` | 22449938 | audio/mpeg | event_association |
| KEEP | `media/1789847304010/file-1789847305508-08_M.125_2026.pdf` | 92905 | application/pdf | event_association |
| KEEP | `media/1789847400932/file-1789847402049-2026-09-19_Temple-midi---Michael-Ps-125-1-.mp3` | 34236387 | audio/mpeg | event_association |
| KEEP | `media/1789932822895/file-1789932824673-09_M.106_2026.pdf` | 71031 | application/pdf | event_association |
| KEEP | `media/1789932945033/file-1789932946161-2026-09-20_Temple-midi---Michael-Ps-106-1-.mp3` | 21162362 | audio/mpeg | event_association |
| KEEP | `media/1790190249384/file-1790190250941-Conclusion-de-la-Ronde-explication-des-psaumes-et-message-de-Grand-Maitre-Erable.mp3` | 53410264 | audio/mpeg | event_association |
| KEEP | `media/1790190586586/file-1790190587834-Niama-si-lakato---Quebec-2026.mp3` | 12644727 | audio/mpeg | event_association |
| KEEP | `media/audio-1789466593108-0-00kvt/file-1789466594852-48---chant-Erable-Roi.mp3` | 6852871 | audio/mpeg | event_association |
| KEEP | `media/audio-1789466613456-1-6nomf/file-1789466615013-55.-Chant-Ceremonie-Comme-lAnge-du-Pere.mp3` | 753623 | audio/mpeg | event_association |
| KEEP | `media/audio-1789466616527-2-rt4bb/file-1789466617827-64.-Chant-du-Temple-de-la-Mere-du-monde-_-Massalas.mp3` | 4562061 | audio/mpeg | event_association |
| KEEP | `media/audio-1789466627279-3-ftqho/file-1789466629040-65.-Chant---La-Ronde-Des-Archanges.mp3` | 5474736 | audio/mpeg | event_association |
| KEEP | `media/audio-1789466639797-4-usmic/file-1789466641533-69.1-Michael-El-Michael.mp3` | 3505230 | audio/mpeg | event_association |
| KEEP | `media/audio-1789466647245-5-kkosx/file-1789466648891-69.2-Chant-Soleil-Source-de-Lumiere.mp3` | 10679901 | audio/mpeg | event_association |
| KEEP | `media/audio-1789475915608-2-lh190/file-1789475917548-63.-Guidance-audio-ceremonie-Ronde-des-Archanges.mp3` | 49972779 | audio/mpeg | event_association |
| KEEP | `media/audio-1789476017101-0-f6txg/file-1789476018843-67.-Meditation-Celui-qui-sapproche-du-Feu-Sapproche-du-Bonheur-de-la-Vie.mp3` | 15827206 | audio/mpeg | event_association |
| KEEP | `media/audio-1789476040693-1-yslxe/file-1789476042770-68.-Meditation-L-Ange-du-Soleil.mp3` | 5439240 | audio/mpeg | event_association |
| KEEP | `media/audio-1789476102543-0-stc2j/file-1789476105119-69.3-chant---Soyez-comme-les-chevaliers.mp3` | 10322606 | audio/mpeg | event_association |
| KEEP | `media/audio-1789476136488-2-ysdgf/file-1789476138439-70.-chant---Eloha-Michael.mp3` | 4131630 | audio/mpeg | event_association |
| KEEP | `media/audio-1789476144217-3-twwgs/file-1789476145986-71.-chant---Fir-fur-fen.mp3` | 12407155 | audio/mpeg | event_association |
| KEEP | `media/audio-1789476162340-4-1qi8t/file-1789476163908-72.-chant---Lumiere-Diamant.mp3` | 7725077 | audio/mpeg | event_association |
| KEEP | `media/audio-1789476173400-5-0migj/file-1789476175104-73.-chant---Regne-en-nous-Etre-supreme.mp3` | 7379068 | audio/mpeg | event_association |
| KEEP | `media/guide-file-20/cover-drive-20.-Ronde-des-Archanges-web.jpg` | 25879 | image/jpeg | event_association |
| KEEP | `media/guide-file-21/cover-drive-21.-statue-du-recyclage-visage-de-la-Mere-web.jpg` | 15070 | image/jpeg | event_association |
| KEEP | `media/guide-file-21/file-drive-21.-Ceremonie-Les-4-visages-de-la-Mere-indiv-et-collectif.pdf` | 966577 | application/pdf | event_association |
| KEEP | `media/guide-file-22/cover-drive-22.-Statue-du-recyclage-web.jpg` | 19719 | image/jpeg | event_association |
| KEEP | `media/guide-file-22/file-drive-22.-Enseignement-Les-4-visages-de-la-Mere-cours-complet.pdf` | 2538396 | application/pdf | event_association |
| KEEP | `media/guide-file-23/cover-drive-23.-Michael2-web.jpg` | 15366 | image/jpeg | event_association |
| KEEP | `media/guide-file-23/file-drive-23.-Ecole-du-Feu-Alliance-avec-l-Archange-Michael-dans-la-Tradition-Essenienne.pdf` | 322844 | application/pdf | event_association |
| KEEP | `media/guide-file-24/cover-drive-24.Pentagramme-web.jpg` | 29250 | image/jpeg | event_association |
| KEEP | `media/guide-file-24/file-drive-24.-Les-3-grands-rites-de-la-Nation-Essenienne.pdf` | 607802 | application/pdf | event_association |
| KEEP | `media/guide-file-25/file-drive-25.-Devant-toi-Michael-nous-deposons-les-armes.pdf` | 327004 | application/pdf | event_association |
| KEEP | `media/guide-file-28a/cover-drive-28.-bible-essenienne-lever-du-soleil-essenia-web.jpg` | 31052 | image/jpeg | event_association |
| KEEP | `media/guide-file-28a/file-drive-28.-M-273.Entrez-dans-linstantane.pdf` | 71730 | application/pdf | event_association |
| KEEP | `media/guide-file-28b/cover-drive-28.-bible-essenienne-lever-du-soleil-essenia-web.jpg` | 31052 | image/jpeg | event_association |
| KEEP | `media/guide-file-28b/file-drive-28.-M.237.Approchez-vous-de-dieu-par-la-vertu-de-la-tolerance.pdf` | 58207 | application/pdf | event_association |
| KEEP | `media/guide-file-28c/cover-drive-28.-bible-essenienne-lever-du-soleil-essenia-web.jpg` | 31052 | image/jpeg | event_association |
| KEEP | `media/guide-file-28c/file-drive-28.-M.013.Apprendre-a-regarder.pdf` | 37131 | application/pdf | event_association |
| KEEP | `media/guide-file-29/cover-drive-29.-Bible.png` | 105316 | image/png | event_association |
| KEEP | `media/guide-file-29/file-drive-29.-M-273.-Priere-156.pdf` | 22387 | application/pdf | event_association |
| KEEP | `media/guide-file-30/file-1789401249279-30.-Programme-RA-Universelle-Michael-AN23.pdf` | 734904 | application/pdf | event_association |
| KEEP | `media/guide-file-31/cover-drive-31.-bouche-triangle-soleil-web.jpg` | 88998 | image/jpeg | event_association |
| KEEP | `media/guide-file-31/file-drive-31.-Engagement-devant-mon-Pere-Michael-et-devant-la-Mere.pdf` | 923463 | application/pdf | event_association |
| KEEP | `media/guide-file-32-long/cover-drive-32.1.-Pentacle-de-lhermite-web.jpg` | 41362 | image/jpeg | event_association |
| KEEP | `media/guide-file-32-long/file-drive-32.1-AN-23-Consecration-du-temple-massala-individuelle-MICHAEL-version-longue.pdf` | 6724563 | application/pdf | event_association |
| KEEP | `media/guide-file-32-short/cover-drive-32.2-Porte-de-la-vie-web.jpg` | 30997 | image/jpeg | event_association |
| KEEP | `media/guide-file-32-short/file-drive-32.2-AN-23-Rituel-de-consecration-du-temple-de-Michael-version-courte.pdf` | 305684 | application/pdf | event_association |
| KEEP | `media/guide-file-38/cover-drive-38.-sceaudelecole.png` | 2855960 | image/png | event_association |
| KEEP | `media/guide-file-38/file-drive-38.-Med.en.mvt.pour.activer.secrets.menora.pdf` | 1658185 | application/pdf | event_association |
| KEEP | `media/guide-file-3999/cover-drive-3999.-PHOTO-2026-09-08-19-13-16.jpg` | 64447 | image/jpeg | event_association |
| KEEP | `media/guide-file-3999/file-drive-3999.-Texte-de-presentation-d-Essene-Radio.pdf` | 51467 | application/pdf | event_association |
| KEEP | `media/pdf-1790197070071-0-brr5c/file-1790197071256-La-statue-du-recyclage-Fiche-technique.pdf` | 722130 | application/pdf | event_association |
| KEEP | `media/pdf-1790197071492-1-7yfoa/file-1790197072379-Consecration-de-la-statue-du-recyclage.pdf` | 108690 | application/pdf | event_association |
| KEEP | `media/pdf-1790197072141-2-qammn/file-1790197072816-Origine-historique-statue-Bienveillance.pdf` | 742484 | application/pdf | event_association |
| KEEP | `media/video-symbolisme-ronde-archanges/cover-1789509375346-1000036425.jpg` | 111743 | image/jpeg | event_association |
| KEEP | `media/yt-bougie-pratique/cover-drive-37.-ankh.webp` | 30298 | image/webp | event_association |
| KEEP | `media/yt-bougie-theorie/cover-drive-36.-element-feu.jpg` | 137961 | image/jpeg | event_association |
| UNCERTAIN | `committee/13d00304-16e6-45c8-9011-d9c0928592bd/1.-Lettres-de-Gerard-Saintete.pdf` | 115495 | application/pdf | other_database_reference |
| UNCERTAIN | `committee/265c3dba-d8d5-4d47-90df-7e0bebee75e1/5.-Messages-brefs-des-Esseniens.pdf` | 305406 | application/pdf | other_database_reference |
| UNCERTAIN | `committee/3ca14831-489e-4596-a9ad-3cdba01734f2/Lettre-hebdomadaire-20-26.09.pdf` | 1559252 | application/pdf | other_database_reference |
| UNCERTAIN | `committee/56d495c3-e196-4982-b281-ce2091e89c79/01_M.286_Michael2026.pdf` | 60831 | application/pdf | other_database_reference |
| UNCERTAIN | `committee/5dbf4dec-149c-429c-a5cf-3438134c769e/7.-Lettre-comite-11.09.26.pdf` | 157560 | application/pdf | other_database_reference |
| UNCERTAIN | `committee/790fb6b8-fdc1-481b-852d-6293c427cbea/2.-Temoignage-de-Sara-Amour.pdf` | 169489 | application/pdf | other_database_reference |
| UNCERTAIN | `committee/9eb2f14c-26df-4162-85c7-d8a75ee61211/4.-Lettre-collective.pdf` | 26315 | application/pdf | other_database_reference |
| UNCERTAIN | `committee/ee306396-fca3-4d35-8307-0b5dce866688/6.-Messages-longs-des-Esseniens.pdf` | 482030 | application/pdf | other_database_reference |
| UNCERTAIN | `committee/f9f87b41-4fe4-4e88-87e1-7a878854274d/3.-Lettre-de-Raphael-Sacre.pdf` | 76301 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1788783034231/file-1788783035309-Preparation_Michael-2025.pdf` | 1358684 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1788783111698/file-1788783112836-textes-des-7-flammes.pdf` | 148609 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789388671615/file-1789388673309-shin.png` | 872277 | image/png | other_database_reference |
| UNCERTAIN | `media/1789397256834/file-1789397258259-1000036256.jpg` | 20933 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/1789503607933/file-1789503609434-54.-Ceremonie-Soleil-de-l-ame---RADOM-MICHAEL-2026.pdf` | 446072 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/1789508450109/file-1789508451808-1000036425.jpg` | 111743 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/1789508814934/file-1789508816551-Meditation-Ceremonie-Soleil-de-lAme.opus` | 406162 | audio/ogg | no_sql_reference |
| UNCERTAIN | `media/1789541675695/file-1789541677704-Allume-ta-bougie.pdf` | 25144 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789541698067/file-1789541699685-L-appel-des-Maitres.pdf` | 31490 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789541734174/file-1789541736769-Devant-toi-o-Pere.pdf` | 31141 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789541895480/file-1789541897527-L-erable-Roi.pdf` | 38622 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789541933453/file-1789541935364-L-Ange-du-Pere.pdf` | 27102 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789541955010/file-1789541956857-La-Ronde-des-Archanges.pdf` | 32241 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789543339280/file-1789543340143-Pardon-des-offenses-en-massala-individuelle-complet.pdf` | 1597061 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789545637540/file-1789545640591-Meditation-Ceremonie-le-Soleil-de-l-Ame.mp3` | 2683821 | audio/mpeg | other_database_reference |
| UNCERTAIN | `media/1789547654631/file-1789547656336-54.-Ceremonie-Soleil-de-l-ame--Michael-2026.pdf` | 258178 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789570893634/file-1789570894958-Pardon-des-Offenses-version-raccourcie.pdf` | 1189910 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789613673157/file-1789613674287-Loic-web.jpg` | 27300 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/1789613674590/file-1789613674922-Loic-web.jpg` | 27300 | image/jpeg | no_sql_reference |
| UNCERTAIN | `media/1789616786068/file-1789616786959-39.-Loic-web.jpg` | 27300 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/1789646433319/file-1789646433963-cache-astro.jpg` | 55670 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/1789646809251/file-1789646810158-Tenture-du-culte-web.jpg` | 62767 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/1789664859240/file-1789664860141-Arbre-de-la-conscience-du-bien-et-du-mal-II-web.jpg` | 84877 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/1789684357103/file-1789684358948-03_M.13_Michael2026.pdf` | 37721 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789728847061/file-1789728848732-54.-Version-Finale-Ceremonie-Soleil-de-l-ame---RADOM-MICHAEL-2026.pdf` | 445893 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1789770133318/file-1789770135070-06_M.39_2026.pdf` | 39527 | application/pdf | other_database_reference |
| UNCERTAIN | `media/1791723108110/file-1791723109615-1000040461.jpg` | 167220 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/audio-1789475832935-0-anspi/file-1789475835409-47.-Commentacquerirlepardondesoffenses.Meditation.Olivier.wma` | 25973713 | audio/x-ms-wma | no_sql_reference |
| UNCERTAIN | `media/audio-1789475895080-1-grroh/file-1789475896895-53.-Meditation---Le-soleil-de-la-Paix.wma` | 11344936 | audio/x-ms-wma | no_sql_reference |
| UNCERTAIN | `media/audio-1789476123329-1-12bo0/file-1789476124890-69.4-chant---Zoroastre.mp3` | 7738650 | audio/mpeg | other_database_reference |
| UNCERTAIN | `media/guide-file-20/file-drive-20.-Recommandations-pour-commencer-la-celebration-a-domicile.pdf` | 586938 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/guide-file-291/cover-drive-291.-sceau_cercle_entraide-web.jpg` | 19816 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/guide-file-291/file-drive-291.-cercle-d-entraide.pdf` | 69387 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/guide-image-39/file-drive-39.-Loic-web.jpg` | 27300 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/home-reliance-2026/cover-drive-01.archange-Michael-priere-disciple.jpg` | 99247 | image/jpeg | other_database_reference |
| UNCERTAIN | `media/home-reliance-2026/file-drive-01.comprendre-la-reliance-du-champ-de-vie.pdf` | 306208 | application/pdf | other_database_reference |
| UNCERTAIN | `media/pdf-1789543188669-0-aa3c4/file-1789543189979-41.-Voeu-de-larchange-Michael.pdf` | 2450803 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/pdf-1789543198382-1-ydbp6/file-1789543199128-43.-Rituel-pour-la-Paix-Travail-magique-de-preparation-Michael.pdf` | 1068245 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/pdf-1789543203843-2-y6cf0/file-1789543204944-48.-Travail-de-l-automne-a-l-Erable.pdf` | 397484 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/pdf-1789543208207-3-97267/file-1789543208659-51.-Rituel-de-purification-des-7-Flammes.Erable.pdf` | 314689 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/pdf-1789543210789-4-wyfqa/file-1789543211287-60.-Arcana-7-regles-de-Michael.pdf` | 399583 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/pdf-1789543213449-5-ch0m5/file-1789543214488-61.-La-RA-universelle-pour-les-esseniens.pdf` | 2178416 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/pdf-1789543221723-6-hosto/file-1789543222418-62.-La-RA-universelle-Rituel-en-Massala-individuelle.pdf` | 1762773 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/pdf-1789543225987-7-23lgi/file-1789543226354-66.-Priere-a-Michael.pdf` | 108726 | application/pdf | no_sql_reference |
| UNCERTAIN | `media/pdf-1789543227555-8-b1hbq/file-1789543228274-67.-Med.Celui.qui.sapproche.du.feu.sapproche.du.bonheur.pdf` | 175956 | application/pdf | no_sql_reference |
| UNCERTAIN | `tests/seed-2026-09-06/image1.svg` | 491 | image/svg+xml | no_sql_reference |
| UNCERTAIN | `tests/seed-2026-09-06/image2.svg` | 491 | image/svg+xml | no_sql_reference |
| UNCERTAIN | `tests/seed-2026-09-06/image3.svg` | 491 | image/svg+xml | no_sql_reference |
| UNCERTAIN | `tests/seed-2026-09-06/pdf1.pdf` | 590 | application/pdf | no_sql_reference |
| UNCERTAIN | `tests/seed-2026-09-06/pdf2.pdf` | 590 | application/pdf | no_sql_reference |
| UNCERTAIN | `tests/seed-2026-09-06/pdf3.pdf` | 590 | application/pdf | no_sql_reference |
| UNCERTAIN | `tests/seed-2026-09-06/son-test.mp3` | 2107 | audio/mpeg | no_sql_reference |

## Inventaire des contenus SQL (211)

| Décision | ID | Nom | Type | Source |
|---|---|---|---|---|
| UNCERTAIN | `1788783034231` | Préparation Michael | PDF | file |
| UNCERTAIN | `1788783111698` | Textes des 7 flammes | PDF | file |
| KEEP | `1788883713005` | Travail preparation MICHAEL 2026 | PDF | file |
| KEEP | `1789374359623` | Conférence d’Olivier Manitara — Les 7 flammes de l’Archange Michaël | Audio | file |
| KEEP | `1789374573022` | Chant — « Allume ta bougie » | Audio | file |
| KEEP | `1789378707546` | Chant — « L’appel des Maîtres » | Audio | file |
| KEEP | `1789378874624` | Conférence d’Olivier Manitara — Le secret des 2 Ménorah | Audio | file |
| KEEP | `1789378944334` | Chant — « OM & Amin essénien pour les cérémonies et les méditations » | Audio | file |
| UNCERTAIN | `1789388671615` | shin.png | Image | file |
| UNCERTAIN | `1789397256834` | Devant toi Michaël, nous déposons les armes | Image | file |
| KEEP | `1789504520605` | Chant — « Devant toi, ô Père » | Audio | file |
| KEEP | `1789504578367` | Chant — « Cérémonie du Pardon des offenses — 3e voix, Énoch » | Audio | file |
| UNCERTAIN | `1789508450109` | Symbole ronde des archanges | Image | file |
| KEEP | `1789508729530` | Toutes les prières d’Alliance avec les règnes | PDF | file |
| KEEP | `1789508765429` | Tous les messages des règnes de la Mère à l’humanité | PDF | file |
| UNCERTAIN | `1789541675695` | Allume ta bougie | PDF | file |
| UNCERTAIN | `1789541698067` | L’appel des Maîtres | PDF | file |
| UNCERTAIN | `1789541734174` | Devant toi, ô Père | PDF | file |
| UNCERTAIN | `1789541895480` | L’Érable Roi | PDF | file |
| UNCERTAIN | `1789541933453` | L’Ange du Père | PDF | file |
| UNCERTAIN | `1789541955010` | La Ronde des Archanges | PDF | file |
| UNCERTAIN | `1789543339280` | Pardon-des-offenses-en-massala-individuelle-complet.pdf | PDF | file |
| KEEP | `1789545298560` | Méditation — Comment acquérir le pardon des offenses — Olivier | Audio | file |
| KEEP | `1789545428732` | Méditation — Le soleil de la Paix | Audio | file |
| UNCERTAIN | `1789545637540` | Méditation — Cérémonie Le Soleil de l’âme | Audio | file |
| UNCERTAIN | `1789547654631` | Cérémonie Le Soleil de l’âme — Michaël 2026 | PDF | file |
| KEEP | `1789568022089` | Cercle d’Entraide | PDF | file |
| KEEP | `1789570630324` | Chant — « Chant de la Joie » | Audio | file |
| KEEP | `1789570778587` | Textes-Sceaux-Cartouche-pardon-offenses.pdf | PDF | file |
| UNCERTAIN | `1789570893634` | Pardon-des-Offenses-version-raccourcie.pdf | PDF | file |
| KEEP | `1789573963805` | Chant "Plus de guerre" | Audio | file |
| UNCERTAIN | `1789613673157` | Illustration — 2026.09.16 Les secrets de la ménora Essénienne. | Image | file |
| UNCERTAIN | `1789616786068` | Illustration — 2026.09.16 Les secrets de la ménora Essénienne. | Image | file |
| KEEP | `1789616925384` | 2026.09.16 Les secrets de la ménora Essénienne. | Vidéo | url |
| KEEP | `1789617089284` | Les secrets de la ménora essénienne | Lien | url |
| KEEP | `1789646249854` | Astrologie Angélique An 23 | PDF | file |
| UNCERTAIN | `1789646433319` | Illustration — Astrologie Angélique An 23 | Image | file |
| UNCERTAIN | `1789646809251` | Illustration — Renouvellement de l’Engagement des Parents de la Lumière | Image | file |
| KEEP | `1789664131528` | Psaume 102 de l'Archange Michaël - La pensée claire est la garante d’une vie heureuse | PDF | file |
| KEEP | `1789664258461` | M.286_Respecter les lois de dieu | PDF | file |
| UNCERTAIN | `1789664859240` | Illustration — Cérémonie Pardon des Offenses | Image | file |
| UNCERTAIN | `1789684357103` | 03_M.13_Michael2026.pdf | PDF | file |
| KEEP | `1789709910664` | Chant Niama Si lakato | Audio | file |
| KEEP | `1789710019027` | Mélodie d'invocation de l'Archange Michael | Audio | file |
| UNCERTAIN | `1789728847061` | Cérémonie Soleil de l'Âme à domicile | PDF | file |
| KEEP | `1789728956742` | Sceaux des 4 Archanges | PDF | file |
| KEEP | `1789736265919` | Psaume 62 de l'Archange Michaël | PDF | file |
| KEEP | `1789737752087` | Cérémonie le Soleil de l'Àme (version corrigée) | PDF | file |
| KEEP | `1789740282061` | Invocation Temple matin — Psaume 286 de l’Archange Michaël — 17/09/2026 | Audio | file |
| KEEP | `1789740506740` | Invocation Temple midi — Psaume 102 de l’Archange Michaël — 17/09/2026 | Audio | file |
| KEEP | `1789748941014` | Invocation Temple soir — Psaume 13 de l’Archange Michaël — 17/09/2026 | Audio | file |
| KEEP | `1789751775833` | Ps.28 de l'Archange Michaël - Construis en toi la pyramide de lumière avec les 4 éléments magiques. | PDF | file |
| KEEP | `1789759552378` | Invocation Temple matin — Psaume 62 de l’Archange Michaël — 18/09/2026 | Audio | file |
| KEEP | `1789759825105` | Invocation Temple midi — Psaume 28 de l’Archange Michaël — 18/09/2026 | Audio | file |
| UNCERTAIN | `1789770133318` | Psaume 39 de l'Archange Michaël - Tes souhaits t’enferment ou te libèrent, conduis les vers l’éternité | PDF | file |
| KEEP | `1789770220036` | Invocation Temple soir — Psaume 39 de l’Archange Michaël — 18/09/2026 | Audio | file |
| KEEP | `1789828826510` | Psaume 154 de l’Archange Michaël — Le premier pas vers la vérité | PDF | file |
| KEEP | `1789828859982` | Renouvellement des engagements éternels — RAU à domicile | PDF | file |
| KEEP | `1789828905376` | Invocation Temple matin — Psaume 154 de l’Archange Michaël — 19/09/2026 | Audio | file |
| KEEP | `1789847304010` | Psaume 125 de l’Archange Michaël | PDF | file |
| KEEP | `1789847400932` | Invocation Temple midi — Psaume 125 de l’Archange Michaël — 19/09/2026 | Audio | file |
| KEEP | `1789932822895` | Psaume 106 de l’Archange Michaël — Comment discerner le vrai du faux | PDF | file |
| KEEP | `1789932945033` | Invocation Temple midi — Psaume 106 de l’Archange Michaël — 20/09/2026 | Audio | file |
| KEEP | `1790190249384` | Conférence — audio MP3 | Audio | file |
| KEEP | `1790190586586` | Niama Si Lakato — chant | Audio | file |
| UNCERTAIN | `1791723108110` | Images d'accueil | Image | file |
| KEEP | `audio-1789466593108-0-00kvt` | Chant — « Érable roi » | Audio | file |
| KEEP | `audio-1789466613456-1-6nomf` | Chant — « Comme l’Ange du Père » | Audio | file |
| KEEP | `audio-1789466616527-2-rt4bb` | Chant — « Temple de la Mère du monde — Massalas » | Audio | file |
| KEEP | `audio-1789466627279-3-ftqho` | Chant — « La ronde des Archanges » | Audio | file |
| KEEP | `audio-1789466639797-4-usmic` | Chant — « Michaël el Michaël » | Audio | file |
| KEEP | `audio-1789466647245-5-kkosx` | Chant — « Soleil, source de lumière » | Audio | file |
| KEEP | `audio-1789475915608-2-lh190` | Guidance audio — Cérémonie de la Ronde des Archanges | Audio | file |
| KEEP | `audio-1789476017101-0-f6txg` | Méditation — Celui qui s’approche du Feu s’approche du Bonheur de la Vie | Audio | file |
| KEEP | `audio-1789476040693-1-yslxe` | Méditation — L’Ange du Soleil | Audio | file |
| KEEP | `audio-1789476102543-0-stc2j` | Chant — « Soyez comme les chevaliers » | Audio | file |
| UNCERTAIN | `audio-1789476123329-1-12bo0` | Chant — « Zoroastre » | Audio | file |
| KEEP | `audio-1789476136488-2-ysdgf` | Chant — « Eloha Michaël » | Audio | file |
| KEEP | `audio-1789476144217-3-twwgs` | Chant — « Fir fur fen » | Audio | file |
| KEEP | `audio-1789476162340-4-1qi8t` | Chant — « Lumière diamant » | Audio | file |
| KEEP | `audio-1789476173400-5-0migj` | Chant — « Règne en nous, Être suprême » | Audio | file |
| KEEP | `guide-file-20` | Recommandations pour commencer la célébration à domicile | PDF | file |
| KEEP | `guide-file-21` | Cérémonie « Les 4 visages de la Mère » — individuel et collectif | PDF | file |
| KEEP | `guide-file-22` | Enseignement — Les 4 visages de la Mère | PDF | file |
| KEEP | `guide-file-23` | L’Alliance avec l’Archange Michaël dans la Tradition essénienne | PDF | file |
| KEEP | `guide-file-24` | Les 3 grands rites de la Nation essénienne | PDF | file |
| KEEP | `guide-file-25` | Devant toi Michaël, nous déposons les armes | PDF | file |
| KEEP | `guide-file-28a` | Psaume 273 — Entrez dans l’instantané | PDF | file |
| KEEP | `guide-file-28b` | Psaume 237 — Approchez-vous de Dieu par la vertu de la tolérance | PDF | file |
| KEEP | `guide-file-28c` | Psaume 13 — Apprendre à regarder | PDF | file |
| KEEP | `guide-file-29` | Prière 156 | PDF | file |
| KEEP | `guide-file-30` | Programme RA Universelle Michaël AN23 | PDF | file |
| KEEP | `guide-file-31` | Engagement devant mon Père Michaël et devant la Mère | PDF | file |
| KEEP | `guide-file-32-long` | Consécration du temple de Michaël — version longue | PDF | file |
| KEEP | `guide-file-32-short` | Consécration du temple de Michaël — version courte | PDF | file |
| KEEP | `guide-file-38` | Méditation en mouvement pour activer les secrets de la ménora | PDF | file |
| KEEP | `guide-file-3999` | Présentation d’Essene Radio | PDF | file |
| KEEP | `guide-file-41` | Vœu de l’Archange Michaël | PDF | link |
| KEEP | `guide-file-43` | Rituel pour la Paix — Travail magique de préparation Michaël | PDF | link |
| KEEP | `guide-file-45-pardon` | Pardon des offenses en Massala individuelle — complet | PDF | link |
| KEEP | `guide-file-48` | Travail de l’automne à l’Érable | PDF | link |
| KEEP | `guide-file-51` | Rituel de purification des 7 Flammes — Érable | PDF | link |
| KEEP | `guide-file-60` | Arcana — Les 7 règles de Michaël | PDF | link |
| KEEP | `guide-file-61` | La RA universelle pour les esséniens | PDF | link |
| KEEP | `guide-file-62` | La RA universelle — Rituel en Massala individuelle | PDF | link |
| KEEP | `guide-file-66` | Prière à Michaël | PDF | link |
| KEEP | `guide-file-67` | Celui qui s’approche du Feu s’approche du Bonheur de la Vie | PDF | link |
| UNCERTAIN | `guide-image-39` | Loïc Air | Image | file |
| UNCERTAIN | `guide-image-41` | Sceau du travail | Image | link |
| UNCERTAIN | `guide-image-43` | Mandala Soleil Nation | Image | link |
| UNCERTAIN | `guide-image-45` | Aigle messager — Sceau du Pardon des offenses | Image | link |
| UNCERTAIN | `guide-image-46` | Arbre de la conscience du bien et du mal II | Image | link |
| UNCERTAIN | `guide-image-47` | Olivier Manitara — sépia claire | Image | link |
| UNCERTAIN | `guide-image-48` | Michaël — automne | Image | link |
| UNCERTAIN | `guide-image-48-feuille` | Feuille d’Érable | Image | link |
| UNCERTAIN | `guide-image-51` | Aigle Telesma | Image | link |
| UNCERTAIN | `guide-image-52` | Ange du Sacré | Image | link |
| UNCERTAIN | `guide-image-53` | Ange Soleil — Lettres | Image | link |
| UNCERTAIN | `guide-image-54` | Ménorah | Image | link |
| UNCERTAIN | `guide-image-55` | Lumière du Soleil | Image | link |
| UNCERTAIN | `guide-image-60` | Mandala du Travail | Image | link |
| UNCERTAIN | `guide-image-61` | Ronde des Archanges | Image | link |
| UNCERTAIN | `guide-image-62` | Tapis de prière | Image | link |
| UNCERTAIN | `guide-image-63` | Tenture du culte | Image | link |
| UNCERTAIN | `guide-image-64` | Sceau du travail | Image | link |
| UNCERTAIN | `guide-image-65` | Monde des conscients | Image | link |
| UNCERTAIN | `guide-image-66` | Michaël | Image | link |
| UNCERTAIN | `guide-image-67` | Mandala du Feu | Image | link |
| UNCERTAIN | `guide-image-68` | Christ | Image | link |
| UNCERTAIN | `guide-image-69-1` | Feu A | Image | link |
| UNCERTAIN | `guide-image-69-2` | Feu B | Image | link |
| UNCERTAIN | `guide-image-69-3` | Feu C | Image | link |
| UNCERTAIN | `guide-image-69-4` | Zoroastre — sépia | Image | link |
| UNCERTAIN | `guide-image-70` | Sol 1 | Image | link |
| UNCERTAIN | `guide-image-71` | Sol 2 | Image | link |
| UNCERTAIN | `guide-image-72` | Sol 3 | Image | link |
| UNCERTAIN | `guide-image-73` | Sol 4 | Image | link |
| KEEP | `guide-video-46` | Comprendre le travail alchimique du rite du Pardon des Offenses | Vidéo | link |
| KEEP | `guide-video-52` | Arcana du sens de l’Amour | Vidéo | link |
| UNCERTAIN | `guide-video-temple-mere-monde` | Temple de la Mère du monde | Vidéo | link |
| UNCERTAIN | `home-intro-2026` | Bienvenue à la célébration de Michaël | Texte | text |
| UNCERTAIN | `home-reliance-2026` | À propos de la reliance | PDF | file |
| UNCERTAIN | `image-1789467011796-0-bsdon` | 45. Aigle-messager-sceau-du-pardon-des-offenses-web.jpg | Image | file |
| UNCERTAIN | `image-1789467013738-1-f9qac` | 46. Arbre-de-la-conscience-du-bien-et-du-mal-II-web.jpg | Image | file |
| UNCERTAIN | `image-1789467016198-2-9u2c5` | 43. MANDALA SOLEILNATION.png | Image | file |
| UNCERTAIN | `image-1789467037281-3-tsl7k` | 42. bible-essenienne-lever-du-soleil-essenia-web.jpg | Image | file |
| UNCERTAIN | `image-1789467038925-4-lm2oi` | 3999. PHOTO-2026-09-08-19-13-16.jpg | Image | file |
| UNCERTAIN | `image-1789467041991-5-egj4i` | 47. Manitara-sepia-claire.jpg | Image | file |
| UNCERTAIN | `image-1789467043343-6-p1bsh` | 399. sceau_cercle_entraide-web.jpg | Image | file |
| UNCERTAIN | `image-1789467045989-7-znb1c` | 44. Loic-web.jpg | Image | file |
| UNCERTAIN | `image-1789467047325-8-ep9l5` | 41. sceau du travail.jpg | Image | file |
| UNCERTAIN | `image-1789467049059-9-4gvli` | 53. Ange-Soleil-Lettres-web.jpg | Image | file |
| UNCERTAIN | `image-1789467050906-10-zbrxz` | 54. Menora.png | Image | file |
| UNCERTAIN | `image-1789467054282-11-40tjn` | 55. sun-light.png | Image | file |
| UNCERTAIN | `image-1789467057049-12-56u9g` | 52. Ange-du-Sacre-web.jpg | Image | file |
| UNCERTAIN | `image-1789467057661-13-wgmnk` | 51. Aigle-telesma-web.jpg | Image | file |
| UNCERTAIN | `image-1789467059199-14-20giy` | 61. Ronde-des-Archanges-web.jpg | Image | file |
| UNCERTAIN | `image-1789467061346-15-74bmt` | 64. sceau du travail copie.jpg | Image | file |
| UNCERTAIN | `image-1789467062885-16-f166t` | 62. Tapis-de-priere_800x.webp | Image | file |
| UNCERTAIN | `image-1789467065339-17-mkvme` | 65. Monde-des-conscients-web.jpg | Image | file |
| UNCERTAIN | `image-1789467066980-18-cai3c` | 67. Mandala-du-feu-web.jpg | Image | file |
| UNCERTAIN | `image-1789467068110-19-psmvq` | 68.christ¨.jpeg | Image | file |
| UNCERTAIN | `image-1789467069333-20-9dtk2` | 69.2 Feu B.jpg | Image | file |
| UNCERTAIN | `image-1789467070986-21-ye7yf` | 69.3 Feu C.jpg | Image | file |
| UNCERTAIN | `image-1789467072189-22-iqmf2` | 66. Michael2-web.jpg | Image | file |
| UNCERTAIN | `image-1789467073022-23-4izws` | 69.1 Feu A.jpg | Image | file |
| UNCERTAIN | `image-1789467074251-24-tgzlu` | 69.4 Zoroastre-sepia-web.jpg | Image | file |
| UNCERTAIN | `image-1789467076092-25-ei7pt` | 63. Tenture-du-culte-web.jpg | Image | file |
| UNCERTAIN | `image-1789467077016-26-gtbf0` | 60. Mandala-Travail-web.jpg | Image | file |
| UNCERTAIN | `image-1789467077942-27-gjazu` | 71. sol 2.jpg | Image | file |
| UNCERTAIN | `image-1789467078863-28-2md7d` | 73. sol 4.jpg | Image | file |
| UNCERTAIN | `image-1789467079745-29-b4kqi` | 70. sol 1.jpg | Image | file |
| UNCERTAIN | `image-1789467080649-30-nkxdf` | 72. sol 3.jpg | Image | file |
| KEEP | `link-essene-radio-player` | Player Essene Radio | Lien | link |
| KEEP | `link-essene-radio-site` | Essene Radio | Lien | link |
| KEEP | `odysee-olivier-cernunnos-samedi-2026` | 2013.09.20 Cernunnos l’Autre visage de l’Archange Michaël chez les Celtes — vidéo | Vidéo | url |
| UNCERTAIN | `pdf-1789466801418-0-7fyln` | Les 4 sceaux du Pardon des offenses | PDF | file |
| UNCERTAIN | `pdf-1789466846000-11-r03oi` | 3999. Texte de présentation d'Essene Radio.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466847537-12-ohik4` | Cartouche-Maison-de-dieu-couleur.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466862592-16-5e6cv` | Lignee-maitres-PdO.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466865353-17-pef4g` | Message-des-animaux-a-lhumanite-2009.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466866798-18-hrejv` | Message-des-Maitres-a-lhumanite-2009.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466868119-19-l4b7z` | Message-des-pierres-a-lhumanite-2009.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466869961-20-5tlnk` | Message-des-vegetaux-a-lhumanite-2009.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466870869-21-mfdhf` | Pardon-des-offenses-en-massala-individuelle-complet.pdf | PDF | file |
| KEEP | `pdf-1789466878259-22-9vktt` | Pardon des Offenses — version raccourcie | PDF | file |
| UNCERTAIN | `pdf-1789466884096-23-ud8wm` | Prière d'alliance avec la Tradition des Maîtres.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466886555-24-ruu1h` | Prière d'alliance avec les animaux.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466889743-25-j7ak1` | Prière d'alliance avec les mineraux.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466894755-26-q30vr` | Prière d'alliance avec les végétaux.pdf | PDF | file |
| UNCERTAIN | `pdf-1789466897779-27-xlbzi` | Textes du Pardon des offenses — sceaux | PDF | file |
| KEEP | `pdf-1790197070071-0-brr5c` | La statue du recyclage — Fiche technique | PDF | file |
| KEEP | `pdf-1790197071492-1-7yfoa` | Consécration de la statue du recyclage | PDF | file |
| KEEP | `pdf-1790197072141-2-qammn` | Origine historique — statue Bienveillance | PDF | file |
| KEEP | `soundcloud-loic-jeudi-1000-2026` | Conférence de Loïc Air | Lien | url |
| KEEP | `soundcloud-loic-jeudi-1900-2026` | Enseignement de l’Érable sur le soutien mutuel | Lien | url |
| KEEP | `soundcloud-loic-vendredi-1900-2026` | Conférence de Loïc Air | Lien | url |
| KEEP | `soundcloud-olivier-cernunnos-samedi-2026` | Cernunnos, l’Autre visage de l’Archange Michaël chez les Celtes | Lien | url |
| KEEP | `video-symbolisme-ronde-archanges` | Comprendre le symbolisme de la Ronde des Archanges | Vidéo | link |
| KEEP | `vimeo-loic-dimanche-1000-2026` | Vimeo | Vidéo | url |
| KEEP | `youtube-arcanas-7-regles-samedi-2026` | Arcanas des 7 règles de Michaël — présenté par Cindy Équilibre | Vidéo | url |
| KEEP | `youtube-atelier-priere-mere-dimanche-2026` | 2026.09.20 Atelier Prière de la Mère et chants — Terres de l’Érable, Michaël 2026 | Vidéo | url |
| KEEP | `youtube-ceremonie-erable-jeudi-2026` | Cérémonie de l’Érable — vidéo | Vidéo | url |
| KEEP | `youtube-erable-roi-jeudi-soir-2026` | Caroline Allan - L’Érable-Roi - Un arbre noble et plein de sagesse | Vidéo | url |
| KEEP | `youtube-loic-dimanche-1000-2026` | YouTube | Vidéo | url |
| KEEP | `youtube-loic-jeudi-1000-2026` | Conférence de Loïc Air — Terres de l’Érable, Michaël 2026 | Vidéo | url |
| KEEP | `youtube-loic-jeudi-1900-2026` | 2026.09.17 Enseignement de l’Érable sur le soutien mutuel — YouTube | Vidéo | url |
| KEEP | `youtube-loic-vendredi-1900-2026` | Voir la conférence sur YouTube | Vidéo | url |
| KEEP | `youtube-rituel-paix-jeudi-0930-2026` | Rituel pour la Paix pour soutenir et préparer la célébration de Michaël | Vidéo | url |
| KEEP | `yt-bougie-pratique` | Consacrer une bougie et allumer une flamme - pratique | Vidéo | link |
| KEEP | `yt-bougie-theorie` | Allumer une bougie consacrer une flamme - théorie | Vidéo | link |

## Liens SQL (23) — visibilité non certifiée

| ID | Libellé | URL | Célébration | Étape | Événement |
|---|---|---|---|---|---|
| 1572 | Image d’illustration | `content:1789397256834` | 101 | preparation-101 | guide-prep-25 |
| 1573 | Écouter l’audio — Les secrets de la ménora essénienne | `https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2401945824&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true` | 101 | mercredi-101 | guide-mercredi-39 |
| 1574 | Image d’illustration | `content:1789616786068` | 101 | mercredi-101 | guide-mercredi-39 |
| 1575 | Image d’illustration | `content:image-1789467043343-6-p1bsh` | 101 | mercredi-101 | guide-mercredi-399 |
| 1576 | Image d’illustration | `content:image-1789467043343-6-p1bsh` | 101 | preparation-101 | guide-prep-291 |
| 1577 | Image d’illustration | `content:guide-file-28a` | 101 | jeudi-101 | guide-jeudi-temple-0830 |
| 1578 | Image d’illustration | `content:guide-file-28b` | 101 | jeudi-101 | guide-jeudi-temple-1130 |
| 1579 | Image d’illustration | `content:1789664859240` | 101 | jeudi-101 | guide-jeudi-45 |
| 1580 | Image d’illustration | `content:1789397256834` | 101 | jeudi-101 | guide-jeudi-46-47 |
| 1581 | Image d’illustration | `content:image-1789467043343-6-p1bsh` | 101 | jeudi-101 | guide-jeudi-399 |
| 1582 | Image d’illustration | `content:image-1789467043343-6-p1bsh` | 101 | vendredi-101 | guide-vendredi-399 |
| 1583 | Image d’illustration | `content:guide-file-28a` | 101 | dimanche-101 | guide-dimanche-temple-0830 |
| 1584 | Image d’illustration | `content:guide-file-23` | 101 | mercredi-101 | 1789574151198 |
| 1585 | Image d’illustration | `content:1789646433319` | 101 | jeudi-101 | 1789646435080 |
| 1586 | Image d’illustration | `content:guide-file-32-short` | 101 | vendredi-101 | guide-vendredi-54-55 |
| 1587 | Image d’illustration | `content:guide-file-28a` | 101 | dimanche-101 | guide-dimanche-temple-1130 |
| 1588 | Image d’illustration | `content:guide-file-28a` | 101 | samedi-101 | guide-samedi-temple-1130 |
| 1589 | Image d’illustration | `content:guide-file-28a` | 101 | samedi-101 | guide-samedi-temple-0830 |
| 1590 | Image d’illustration | `content:guide-file-28a` | 101 | jeudi-101 | guide-jeudi-temple-1630 |
| 1591 | Image d’illustration | `content:guide-file-28a` | 101 | vendredi-101 | guide-vendredi-temple-1630 |
| 1592 | Image d’illustration | `content:guide-file-28a` | 101 | vendredi-101 | guide-vendredi-temple-0830 |
| 1593 | Image d’illustration | `content:guide-file-28a` | 101 | vendredi-101 | guide-vendredi-temple-1130 |
| 1594 | Écouter sur SoundCloud | `https://on.soundcloud.com/PuIVNlnUPk4RscJqw3` | 101 | dimanche-101 | guide-dimanche-loic-1000 |

## Suppressions proposées

**Aucune.** Les catégories UNCERTAIN ne peuvent être supprimées. Ne pas supprimer de comptes, sessions, autorisations ou structures techniques.
