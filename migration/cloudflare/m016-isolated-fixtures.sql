-- M016 — ONLY the independently created test D1, never the official D1.
-- Fictional and clearly labeled placeholder data, no historic member/private data.
INSERT INTO celebrations_celebrations(id,archangel,year,status)
VALUES (90000001,'Raphaël','2026','published');
INSERT INTO celebrations_steps(id,celebration_id,step_key,label,body_text,sort_order)
VALUES (90000011,90000001,'preparation-90000001','Préparation','Données fictives de la préproduction M016. Aucun contenu historique.',1);
INSERT INTO celebrations_directory_member_types(id,name,disabled)
VALUES ('member-type:m016','Membre fictif de validation',0);
