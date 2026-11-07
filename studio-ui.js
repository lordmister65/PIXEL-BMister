/* PIXEL-BMister — Studio UI helpers. Visual navigation only. */
'use strict';
(()=>{
  const nav=document.querySelector('.inspector-tabs');
  const aside=document.querySelector('.inspector');
  if(!nav||!aside)return;
  const links=[...nav.querySelectorAll('a[href^="#"]')];
  const activate=link=>{
    links.forEach(a=>{
      const selected=a===link;
      a.classList.toggle('active',selected);
      if(selected)a.setAttribute('aria-current','true');
      else a.removeAttribute('aria-current');
    });
  };
  links.forEach(link=>{
    link.addEventListener('click',event=>{
      const id=link.getAttribute('href').slice(1);
      const section=document.getElementById(id);
      if(!section)return;
      event.preventDefault();
      activate(link);
      // Scroll only the inspector; keep focus and drawing viewport stable.
      const destination=section.getBoundingClientRect().top-aside.getBoundingClientRect().top+aside.scrollTop-53;
      aside.scrollTo({top:Math.max(0,destination),behavior:'smooth'});
    });
  });
  if(links[0])activate(links[0]);
})();