function publicLinkLabel(l){
  const t=String(l?.label||'').toLowerCase();
  if(t.includes('vidéo')||t.includes('video'))return 'Voir la vidéo';
  if(t.includes('audio'))return 'Écouter l’audio';
  if(t.includes('pdf'))return 'Voir le PDF';
  if(t.includes('image'))return 'Voir l’image';
  return 'Voir le lien';
}
function publicSoundCloudPlayer(l){
  const url=String(l?.url||'');
  if(url!=='https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2401945824&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true')return '';
  return `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay; encrypted-media" src="${esc(url)}" title="Lecteur audio SoundCloud — Les secrets de la ménora essénienne" style="display:block;border:0;border-radius:12px"></iframe>`;
}
const baseEventHtml=eventHtml;
eventHtml=function(e){
  let html=baseEventHtml(e);
  if(String(e?.title||'').trim()==='Temple'){
    const templeNote='<div class="temple-note" style="margin-top:10px">Le psaume sera ajouté ici après avoir été donné dans le Temple au Québec. Dès sa publication, vous pourrez le lire dans votre Temple à l’heure qui vous convient.</div>';
    html=html.replace('</div></article>',`${templeNote}</div></article>`);
  }
  const links=(e.links||[]).filter(l=>l&&l.url);
  if(!links.length)return html;
  const extra=`<div class="resources" style="margin-top:10px">${links.map(l=>publicSoundCloudPlayer(l)||`<a class="resource-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(publicLinkLabel(l))}</a>`).join('')}</div>`;
  return html.replace('</div></article>',`${extra}</div></article>`);
};
renderProgram();
