#!/usr/bin/env python3
"""Split an ALREADY-encrypted Github artifact into 2 connector-safe ZIP shards.
Only ciphertext passes here. No Cloudflare, passwords, decryption, or writes.
"""
import hashlib
import json
import pathlib
import shutil
import sys

LIMIT = 490_000_000
EXPECTED_ORIGINAL = 836_862_057  # verified M3 Action #42628200520
READABLE = """SAUVEGARDE CHIFFREE CELEBRATIONS - 9 novembre 2026

Archive A + B : extrayez LES DEUX ZIP dans UN MEME dossier
(sans renommer les fichiers .enc). Le fichier manifest.cbackup est identique
dans les deux archives. Ne partagez pas les archives publiquement.

Mot de passe : CELEBRATIONS_BACKUP_PASSPHRASE, conserve dans les secrets
de l'environnement GitHub celebrations-staging. Ne l'imprimez dans aucun log.
Une sauvegarde chiffree n'est pas utilisable sans cette cle.

Restauration vers un NOUVEAU DOSSIER LOCAL uniquement :
  python scripts/finalisation03_restore_offline.py \\
    --archive-folder /dossier/dezippe \\
    --new-destination /dossier/RESTAURATION_ISOLEE
Le script refuse d'ecraser un dossier existant.

Les sources R2 sont rassemblees dans la restauration sous leurs noms de
bucket, la base D1 est fournie en JSON logique ET en SQLite reconstruit,
et le code Worker Cloudflare actif est conserve en version multipart.

AUCUN deploiement automatique et aucun import vers Cloudflare ne sont inclus.
La lecture D1 est une sauvegarde logique non transactionnelle.
"""
def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk=f.read(4_000_000)
            if not chunk:return h.hexdigest()
            h.update(chunk)
def main():
    src=pathlib.Path(sys.argv[1])
    out=pathlib.Path(sys.argv[2])
    if not src.is_dir() or out.exists():
        raise ValueError("Invalid source or preexisting output")
    parts=sorted(p for p in src.iterdir() if p.name.startswith("part-") and p.suffix==".enc")
    manifest=src/"manifest.cbackup"
    if len(parts)<160 or not manifest.is_file():
        raise ValueError("Missing encrypted backup files")
    original_bytes=sum(x.stat().st_size for x in parts)
    if original_bytes!=EXPECTED_ORIGINAL:
        raise ValueError("Encrypted byte count changed")
    out.mkdir()
    shards=[out/"A",out/"B"]
    for d in shards:d.mkdir()
    size=[0,0];count=[0,0]
    for file in sorted(parts,key=lambda p:p.stat().st_size,reverse=True):
        ix=0 if size[0]<=size[1] else 1
        shutil.copyfile(file,shards[ix]/file.name)
        size[ix]+=file.stat().st_size;count[ix]+=1
        if size[ix]>LIMIT:raise ValueError("Connector shard too large")
    for d in shards:
        shutil.copyfile(manifest,d/manifest.name)
        (d/"README-RECUPERATION.txt").write_text(READABLE,encoding="utf-8")
    if sum(size)!=original_bytes or len({p.name for d in shards for p in d.glob("part-*.enc")})!=len(parts):
        raise ValueError("Incomplete ciphertext partition")
    for file in parts:
        corresponding=(shards[0]/file.name) if (shards[0]/file.name).exists() else (shards[1]/file.name)
        if sha(file)!=sha(corresponding):
            raise ValueError("Encrypted shard SHA changed")
    print("M03_GDRIVE_SAFE_ENCRYPTED_SHARDS_PASS "+json.dumps({
        "encrypted_bytes":original_bytes,"shard_cipher_bytes":size,
        "part_counts":count,"manifest_identical":True,
        "all_cipher_sha256_equal":True,"plaintext_bytes_exposed":0,
        "cloudflare_reads":0,"cloudflare_writes":0}))
if __name__=="__main__":
    try:main()
    except Exception as err:
        print("M03_SPLIT_STOP category="+type(err).__name__,file=sys.stderr)
        sys.exit(1)
