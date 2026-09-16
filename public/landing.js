const languageToggle=document.getElementById('language-toggle');
let landingLanguage='sr';
try{landingLanguage=localStorage.getItem('kotva.language')==='en'?'en':'sr'}catch{}
function applyLandingLanguage(){document.documentElement.lang=landingLanguage;document.querySelectorAll('[data-sr][data-en]').forEach(element=>{const emphasis=element.querySelector('em');if(emphasis&&element.querySelector('br')){const parts=element.dataset[landingLanguage].split('. ');element.firstChild.textContent=`${parts[0]}.`;emphasis.textContent=parts.slice(1).join('. ');return}element.textContent=element.dataset[landingLanguage]});languageToggle.textContent=landingLanguage==='sr'?'EN':'SR';languageToggle.setAttribute('aria-label',landingLanguage==='sr'?'Switch to English':'Prebaci na srpski');document.title=landingLanguage==='sr'?'Kotva — osiguranje pod kontrolom':'Kotva — insurance in control'}
languageToggle.addEventListener('click',()=>{landingLanguage=landingLanguage==='sr'?'en':'sr';try{localStorage.setItem('kotva.language',landingLanguage)}catch{}applyLandingLanguage()});
applyLandingLanguage();
