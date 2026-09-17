const languageToggle=document.getElementById('language-toggle');
const demoHealth=document.getElementById('demo-health');
const demoHealthLabel=document.getElementById('demo-health-label');
const availabilityText={
  sr:{checking:'Proveravamo dostupnost demoa…',ready:'Demo je dostupan',unavailable:'Demo trenutno nije dostupan'},
  en:{checking:'Checking demo availability…',ready:'Demo is available',unavailable:'Demo is currently unavailable'}
};
let landingLanguage='sr';
let availabilityState='checking';
let lastAvailabilityCheck=0;
try{landingLanguage=localStorage.getItem('kotva.language')==='en'?'en':'sr'}catch{}

function renderAvailability(){
  demoHealth.dataset.state=availabilityState;
  const message=availabilityText[landingLanguage][availabilityState];
  if(demoHealthLabel.textContent!==message)demoHealthLabel.textContent=message;
}

function applyLandingLanguage(){
  document.documentElement.lang=landingLanguage;
  document.querySelectorAll('[data-sr][data-en]').forEach(element=>{
    const emphasis=element.querySelector('em');
    if(emphasis&&element.querySelector('br')){
      const parts=element.dataset[landingLanguage].split('. ');
      element.firstChild.textContent=`${parts[0]}.`;
      emphasis.textContent=parts.slice(1).join('. ');
      return;
    }
    element.textContent=element.dataset[landingLanguage];
  });
  languageToggle.textContent=landingLanguage==='sr'?'EN':'SR';
  languageToggle.setAttribute('aria-label',landingLanguage==='sr'?'Switch to English':'Prebaci na srpski');
  document.title=landingLanguage==='sr'?'Kotva — osiguranje pod kontrolom':'Kotva — insurance in control';
  renderAvailability();
}

async function checkDemoAvailability(){
  lastAvailabilityCheck=Date.now();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch('/api/health/ready',{cache:'no-store',signal:controller.signal});
    availabilityState=response.ok?'ready':'unavailable';
  }catch{
    availabilityState='unavailable';
  }finally{
    clearTimeout(timeout);
    renderAvailability();
  }
}

languageToggle.addEventListener('click',()=>{
  landingLanguage=landingLanguage==='sr'?'en':'sr';
  try{localStorage.setItem('kotva.language',landingLanguage)}catch{}
  applyLandingLanguage();
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&Date.now()-lastAvailabilityCheck>60000)checkDemoAvailability();
});
applyLandingLanguage();
checkDemoAvailability();
