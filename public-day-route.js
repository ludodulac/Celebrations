(function(){
  const slug=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'').toLowerCase();
  if(!slug)return;
  let tries=0;
  function openDay(){
    tries++;
    if(typeof window.dayList==='function'&&typeof window.publicDaySlug==='function'&&typeof window.showTab==='function'){
      const day=window.dayList().find(d=>window.publicDaySlug(d)===slug);
      if(day){
        activeDay=day.key;
        window.showTab('program');
        return;
      }
    }
    if(tries<80)setTimeout(openDay,100);
  }
  openDay();
})();
