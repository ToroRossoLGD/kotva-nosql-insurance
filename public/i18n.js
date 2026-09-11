/* UI translations. Business data and API enum values remain unchanged. */
const translations = Object.fromEntries(`
Kotva — kontrolni centar|Kotva — control center
Bezbedan pristup|Secure access
Prijava u Kotvu|Sign in to Kotva
Unesite podatke svog poslovnog naloga.|Enter your business account credentials.
Korisničko ime|Username
Lozinka|Password
Prijavi se|Sign in
Osiguranje|Insurance
Pregled|Overview
Obaveštenja|Notifications
Štete|Claims
Uplate|Payments
Dokumenti|Documents
Analitika|Analytics
Novi korisnik|New client
Korisnici|Clients
Bezbednost|Security
Odjava|Sign out
Povezivanje…|Connecting…
Baza podataka|Database
Kontrolni centar|Control center
Dobro došli u Kotvu.|Welcome to Kotva.
Sve police i najvažniji pokazatelji na jednom mestu.|All policies and key metrics in one place.
+ Novi korisnik|+ New client
Obaveštenja i podsetnici|Notifications and reminders
Nova evidencija|New record
Unos podataka|Data entry
Dodaj korisnika i polisu|Add client and policy
Podaci o osiguraniku, pokriću i plaćanju|Policyholder, coverage and payment details
Ime|First name
Prezime|Last name
Godine|Age
Tip osiguranja|Insurance type
Osiguravajuća kuća|Insurer
Datum prodaje|Sale date
Početak važenja|Coverage start
Datum isteka|Expiry date
Premija|Premium
Valuta|Currency
Status polise|Policy status
Način plaćanja|Payment method
Status plaćanja|Payment status
Predmet osiguranja|Insured subject
Referenca dokumenta|Document reference
Broj pasoša|Passport number
Destinacija|Destination
Marka vozila|Vehicle make
Kubikaža (cm³)|Engine capacity (cm³)
Vrsta vozila|Vehicle type
Karoserija|Body type
Sačuvaj korisnika i polisu|Save client and policy
Nova osiguravajuća kuća|New insurer
Odmah će se pojaviti u izboru|Available in the list immediately
Naziv kuće|Insurer name
Dodaj kuću|Add insurer
Prijava i obrada šteta|Claims registration and processing
Nova prijava štete|New claim
Šteta se vezuje za postojeću polisu i njen period važenja|Claims are linked to an existing policy and its coverage period
Polisa|Policy
Datum nastanka|Incident date
Procenjeni iznos|Estimated amount
Opis štete|Claim description
Prijavi štetu|Register claim
Broj štete|Claim number
Polisa / korisnik|Policy / client
Događaj|Incident
Prijavio|Reported by
Akcija|Action
Naplata premija|Premium collection
Evidentiraj uplatu|Record payment
Status plaćanja polise ažurira se automatski prema ukupno uplaćenom iznosu|Policy payment status updates automatically based on the total amount paid
Datum uplate|Payment date
Iznos|Amount
Referenca uplate|Payment reference
Potvrda|Receipt
Datum|Date
Način|Method
Referenca|Reference
Evidentirao|Recorded by
Dokumenti polise|Policy documents
Dodaj dokument|Add document
Zaštićen upload PDF, JPG ili PNG dokumenta do 5 MB|Secure PDF, JPG or PNG upload up to 5 MB
Fajl|File
Dokument|Document
Tip|Type
Veličina|Size
Dodao|Added by
Preuzimanje|Download
ETL studio i CSV dataseti|ETL studio and CSV datasets
Anonimizovani podaci|Anonymized data
Filtriraj operativne podatke, pokreni proveru kvaliteta i preuzmi dataset spreman za Excel, Power BI, Tableau ili Python.|Filter operational data, check quality and download a dataset ready for Excel, Power BI, Tableau or Python.
Od datuma|From date
Do datuma|To date
Svi tipovi|All types
Sve kuće|All insurers
Svi statusi|All statuses
Pokreni ETL|Run ETL
Analitički dataset|Analytics dataset
Police CSV|Policies CSV
Uplate CSV|Payments CSV
Štete CSV|Claims CSV
Završeno|Completed
Pokrenuo|Started by
Izvučeno|Extracted
Transformisano|Transformed
Problemi|Issues
Trajanje|Duration
Raspodela problema|Issue distribution
Aktuelni problemi prema pravilu kvaliteta|Current issues by quality rule
Trend kvaliteta|Quality trend
Overall score po ETL izvršavanju|Overall score per ETL run
Ozbiljnost|Severity
Pravilo|Rule
Entitet|Entity
Opis|Description
Analitika portfolija|Portfolio analytics
Ažurira se uživo|Updates live
Preuzmi Excel|Download Excel
Trend premije i naplate|Premium and collection trend
Mesečni written premium naspram naplaćene premije|Monthly written premium versus collected premium
Performanse osiguravača|Insurer performance
Collection rate i estimated loss ratio po kući|Collection rate and estimated loss ratio by insurer
Metodologija:|Methodology:
Estimated loss ratio koristi procenjenu vrednost šteta / written premium i nije računovodstveni incurred loss ratio. Sve novčane metrike su odvojene po valuti.|Estimated loss ratio uses estimated claim value / written premium and is not the accounting incurred loss ratio. All monetary metrics are separated by currency.
Pregled prodaje|Sales overview
Prodaja putnog osiguranja|Travel insurance sales
Broj prodatih polisa po mesecima|Policies sold by month
Osiguravajuće kuće|Insurers
Udeo po broju osiguranika|Share by number of policyholders
Prosečne godine|Average age
Starost prema tipu osiguranja|Age by insurance type
Putna osiguranja tokom jula|Travel insurance in July
Broj kupljenih polisa po danima u mesecu|Policies purchased by day of month
Starost i broj zaključenih polisa|Age and number of policies
X osa prikazuje godine korisnika, a Y osa broj polisa|The X axis shows client age and the Y axis shows policy count
Vrste osiguranja|Insurance types
Struktura kompletnog portfolija|Full portfolio breakdown
Evidencija|Records
Pretraga korisnika|Client search
Pretraži po imenu ili prezimenu|Search by first or last name
Korisnik|Client
Kuća|Insurer
Detalji osiguranja|Insurance details
Stanje aplikacije|Application health
Samo administrator|Administrators only
Audit prijava|Login audit
Poslednji pokušaji prijave|Recent login attempts
Vreme|Time
Rezultat|Result
IP adresa|IP address
Istorija poslovnih promena|Business change history
Append-only evidencija|Append-only records
Korisnik / uloga|User / role
Kotva · NoSQL projekat · ArangoDB|Kotva · NoSQL project · ArangoDB
npr. Milica|e.g. Milica
npr. Petrović|e.g. Petrović
npr. 12500|e.g. 12500
Osoba, vozilo ili imovina|Person, vehicle or property
Opciono: naziv ili URL dokumenta|Optional: document name or URL
13 cifara|13 digits
npr. 012345678|e.g. 012345678
npr. Grčka|e.g. Greece
npr. Toyota|e.g. Toyota
npr. 1598|e.g. 1598
npr. Triglav|e.g. Triglav
Opišite događaj i nastalu štetu|Describe the incident and resulting damage
Opciono: poziv na broj|Optional: payment reference
npr. Markovic ili Petrović|e.g. Markovic or Petrović
Zahtev nije uspeo.|Request failed.
Ukupno aktivnih polisa|Total active policies
Prosečna starost|Average age
godina|years
Vodeća kuća|Leading insurer
osiguranika|policyholders
Najjači mesec|Busiest month
putnih polisa|travel policies
Putno osiguranje|Travel insurance
ukupnog portfolija|of total portfolio
Putne polise|Travel policies
polisa|policies
polise|policies
Broj polisa po starosti|Policy count by age
Starost korisnika (godine)|Client age (years)
Broj zaključenih polisa|Number of policies
evidentirana naplata|recorded collections
preostalo za naplatu|remaining balance
naplaćeno / ugovoreno|collected / written
šteta|claims
procenjene štete / premija|estimated claims / premium
polise sa štetom|policies with claims
prosečna procenjena šteta|average estimated claim
prosek po polisi|average per policy
otkazane police|cancelled policies
nema perioda|no period
Procenat (%)|Percentage (%)
korisnika|clients
Pasoš:|Passport:
Legacy polisa|Legacy policy
Preuzmi PDF|Download PDF
Potvrđeno|Confirmed
Potvrdi broker|Confirm as broker
Na čekanju|Pending
Nema dostupnih polisa|No policies available
prijavljenih šteta|reported claims
Sačuvaj|Save
Nema prijavljenih šteta.|No claims reported.
evidentiranih uplata|recorded payments
Nema evidentiranih uplata.|No payments recorded.
aktivnih|active
Označi kao pročitano|Mark as read
Pročitano|Read
Nema aktivnih obaveštenja.|No active notifications.
dokumenata|documents
Preuzmi|Download
Nema dodatih dokumenata.|No documents added.
ETL još nije pokretan.|ETL has not run yet.
izvornih slogova|source records
analitičkih redova|analytics rows
Problemi kvaliteta|Quality issues
zahteva proveru|review required
dataset je čist|dataset is clean
ETL izvršavanje|ETL execution
nije pokrenut|not run
dana|days
Nema pronađenih problema kvaliteta.|No data quality issues found.
ArangoDB aktivan|ArangoDB active
Demo režim|Demo mode
Podaci u memoriji|In-memory data
Broker je potvrdio podatke vozila.|The broker confirmed the vehicle details.
Status štete je ažuriran.|Claim status updated.
Priprema...|Preparing...
Sesija je istekla.|Your session has expired.
Excel izvoz nije uspeo.|Excel export failed.
CSV izvoz nije uspeo.|CSV export failed.
ETL je uspešno završen.|ETL completed successfully.
Korisnik je uspešno sačuvan.|Client saved successfully.
Kuća je dodata.|Insurer added.
Šteta je uspešno prijavljena.|Claim registered successfully.
Dokument je bezbedno dodat polisi.|Document securely added to the policy.
Zahtevi|Requests
od pokretanja|since startup
Prosek|Average
vreme odgovora|response time
Greške|Errors
serverske greške|server errors
Memorija|Memory
RSS procesa|process RSS
Uspešno|Successful
Neuspešno|Failed
Nema evidentiranih pokušaja.|No login attempts recorded.
Nema poslovnih promena.|No business changes.
Učitaj tenant podatke iz ArangoDB-a u dimenzije i fact tabele spremne za Power BI.|Load tenant data from ArangoDB into dimension and fact tables ready for Power BI.
Provera...|Checking...
Učitaj warehouse|Load warehouse
POVEZAN|CONNECTED
NIJE KONFIGURISAN|NOT CONFIGURED
Police|Policies
Poslednje učitavanje|Last load
Putno|Travel
Životno|Life
Auto|Auto
Privatna svojina|Property
DZO|Private health
Nacrt|Draft
Aktivna|Active
Istekla|Expired
Otkazana|Cancelled
Gotovina|Cash
Kartica|Card
Bankovni transfer|Bank transfer
Rate|Installments
Neplaćeno|Unpaid
Delimično plaćeno|Partially paid
Plaćeno|Paid
Prijavljena|Reported
U obradi|In review
Odobrena|Approved
Odbijena|Rejected
Isplaćena|Paid out
Putničko|Passenger car
Teretno|Truck
Motor|Motorcycle
Limuzina|Sedan
Karavan|Estate
Maj|May
Avg|Aug
Okt|Oct
Jezik|Language
`.trim().split('\n').map(line => line.split('|')));

const serbianMessages = {
  'Action center':'Centar aktivnosti',
  'Claims management':'Upravljanje štetama',
  'Premium collection':'Naplata premija',
  'Document management':'Upravljanje dokumentima',
  'Data analytics workspace':'Radni prostor za analitiku',
  'Quality report':'Izveštaj o kvalitetu',
  'Data observability':'Praćenje kvaliteta podataka',
  'Data Quality dashboard':'Pregled kvaliteta podataka',
  'Insurance KPI dashboard':'Ključni pokazatelji osiguranja',
  'Portfolio exploration':'Istraživanje portfolija',
  'Runtime monitoring':'Praćenje rada aplikacije',
  'Business audit':'Poslovna revizija',
  'Written premium':'Ugovorena premija',
  'Collected premium':'Naplaćena premija',
  'Outstanding premium':'Preostala premija',
  'Collection rate':'Stopa naplate',
  'Claim exposure':'Izloženost štetama',
  'Estimated loss ratio':'Procenjeni odnos šteta i premije',
  'Claim frequency':'Učestalost šteta',
  'Claim severity':'Prosečna vrednost štete',
  'Average premium':'Prosečna premija',
  'Cancellation rate':'Stopa otkazivanja',
  'MoM growth':'Mesečni rast',
  'YoY growth':'Godišnji rast',
  'Overall score':'Ukupna ocena',
  'Quality score (%)':'Ocena kvaliteta (%)',
  'Completeness':'Potpunost',
  'Validity':'Ispravnost',
  'Uniqueness':'Jedinstvenost',
  'Referential integrity':'Referencijalni integritet',
  'Freshness':'Ažurnost',
  'Uptime':'Vreme rada',
  'Demo credentials are documented in the project README.': 'Demo podaci za prijavu nalaze se u README dokumentu projekta.',
  'Invalid username or password.': 'Korisničko ime ili lozinka nisu ispravni.',
  'Username and password are required.': 'Korisničko ime i lozinka su obavezni.',
  'Too many failed attempts. Try again in 15 minutes.': 'Previše neuspešnih pokušaja. Pokušajte ponovo za 15 minuta.',
  'Too many login attempts from this address. Try again in 15 minutes.': 'Previše pokušaja prijave sa ove adrese. Pokušajte ponovo za 15 minuta.',
  'Authentication is required.': 'Potrebna je prijava.',
  'Your session has expired. Please sign in again.': 'Sesija je istekla. Prijavite se ponovo.',
  'You do not have permission to perform this action.': 'Nemate dozvolu za ovu radnju.',
  'PUBLIC DEMO · Read-only analyst access · Data changes are disabled': 'JAVNI DEMO · Analitički pristup za čitanje · Izmena podataka je onemogućena'
};
Object.assign(translations, {
  'Polisa je istekla':'Policy expired',
  'Polisa uskoro ističe':'Policy expiring soon',
  'Otvoreno dugovanje premije':'Outstanding premium',
  'Šteta čeka obradu':'Claim awaiting processing',
  'Naziv mora imati od 2 do 80 znakova.':'Name must contain 2 to 80 characters.',
  'Ta osiguravajuća kuća već postoji.':'This insurer already exists.',
  'Ime i prezime su obavezni.':'First and last name are required.',
  'Godine moraju biti ceo broj od 0 do 120.':'Age must be a whole number from 0 to 120.',
  'Izaberite važeći tip osiguranja.':'Select a valid insurance type.',
  'Datum prodaje nije ispravan.':'Sale date is invalid.',
  'Datumi početka i isteka polise nisu ispravni.':'Policy start and expiry dates are invalid.',
  'Početak važenja ne može biti pre datuma prodaje.':'Coverage cannot start before the sale date.',
  'Datum isteka mora biti posle početka važenja.':'Expiry must be after the coverage start date.',
  'Premija mora biti pozitivan iznos do 100.000.000.':'Premium must be positive and no greater than 100,000,000.',
  'Izaberite podržanu valutu.':'Select a supported currency.',
  'Izaberite važeći status polise.':'Select a valid policy status.',
  'Izaberite način plaćanja.':'Select a payment method.',
  'Izaberite status plaćanja.':'Select a payment status.',
  'Predmet osiguranja mora imati od 2 do 200 znakova.':'Insured subject must contain 2 to 200 characters.',
  'Referenca dokumenta može imati najviše 300 znakova.':'Document reference cannot exceed 300 characters.',
  'JMBG mora sadržati tačno 13 cifara.':'JMBG must contain exactly 13 digits.',
  'Broj pasoša mora imati 6–15 slova, cifara ili crtica.':'Passport number must contain 6–15 letters, digits or hyphens.',
  'Destinacija mora imati od 2 do 80 znakova.':'Destination must contain 2 to 80 characters.',
  'Korisnik sa tim JMBG-om već postoji u vašoj firmi.':'A client with this JMBG already exists in your company.',
  'Marka vozila mora imati od 2 do 50 znakova.':'Vehicle make must contain 2 to 50 characters.',
  'Kubikaža mora biti ceo broj između 50 i 10000 cm³.':'Engine capacity must be a whole number between 50 and 10000 cm³.',
  'Izaberite važeću vrstu vozila.':'Select a valid vehicle type.',
  'Za putničko vozilo izaberite limuzinu, SUV ili karavan.':'Select sedan, SUV or estate for a passenger car.',
  'Izaberite postojeću osiguravajuću kuću.':'Select an existing insurer.',
  'Identifikator korisnika nije ispravan.':'Client identifier is invalid.',
  'Korisnik nije pronađen.':'Client not found.',
  'Broker potvrda je dostupna samo za auto-osiguranje.':'Broker confirmation is only available for auto insurance.',
  'Izaberite postojeću polisu vaše firme.':'Select an existing policy from your company.',
  'Datum štete nije ispravan ili je u budućnosti.':'Incident date is invalid or in the future.',
  'Datum štete mora biti unutar perioda važenja polise.':'Incident date must fall within the policy coverage period.',
  'Opis štete mora imati od 10 do 1000 znakova.':'Claim description must contain 10 to 1000 characters.',
  'Procenjeni iznos mora biti pozitivan broj do 100.000.000.':'Estimated amount must be positive and no greater than 100,000,000.',
  'Izaberite važeći status štete.':'Select a valid claim status.',
  'Šteta nije pronađena.':'Claim not found.',
  'Datum uplate nije ispravan ili je u budućnosti.':'Payment date is invalid or in the future.',
  'Datum uplate ne može biti pre datuma prodaje polise.':'Payment date cannot precede the policy sale date.',
  'Iznos uplate mora biti pozitivan broj.':'Payment amount must be positive.',
  'Izaberite podržan način plaćanja.':'Select a supported payment method.',
  'Referenca uplate može imati najviše 100 znakova.':'Payment reference cannot exceed 100 characters.',
  'Uplata sa tom referencom već postoji.':'A payment with this reference already exists.',
  'Obaveštenje nije pronađeno ili je već označeno kao pročitano.':'Notification not found or already marked as read.',
  'Polisa nije pronađena.':'Policy not found.',
  'Izaberite dokument za upload.':'Select a document to upload.',
  'Dokument nije pronađen.':'Document not found.',
  'Fajl dokumenta nije pronađen.':'Document file not found.',
  'Greška na serveru.':'Server error.'
});
let language = 'sr';
try { language = localStorage.getItem('kotva.language') === 'en' ? 'en' : 'sr'; } catch {}
const locale = () => language === 'en' ? 'en-GB' : 'sr-RS';
function t(source) {
  const text = String(source ?? '');
  const key = text.trim();
  const translated = language === 'en' ? (translations[key] ?? Object.keys(serbianMessages).find(message => serbianMessages[message] === key)) : serbianMessages[key];
  return translated === undefined ? text : text.replace(key, () => translated);
}

// Capture only authored static text; never translate client names or user input.
const staticTranslations = [];
function initializeLanguage() {
  document.querySelectorAll('label > select').forEach(select => {
    const label = Array.from(select.parentElement.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim();
    if (label) select.setAttribute('aria-label', label);
  });
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script,style,[data-language-picker]')) continue;
    const key = node.textContent.trim();
    if (translations[key] || serbianMessages[key]) staticTranslations.push({node, source:node.textContent});
  }
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(node => {
    for (const attr of ['placeholder','title','aria-label']) {
      const source = node.getAttribute(attr);
      if (source && (translations[source] || serbianMessages[source])) staticTranslations.push({node, attr, source});
    }
  });
  applyLanguage();
  document.querySelectorAll('[data-language-picker] select').forEach(select => select.addEventListener('change', () => {
    language = select.value === 'en' ? 'en' : 'sr';
    try { localStorage.setItem('kotva.language', language); } catch {}
    applyLanguage();
    document.dispatchEvent(new Event('languagechange'));
  }));
}
function applyLanguage() {
  document.documentElement.lang = language;
  for (const {node, attr, source} of staticTranslations) {
    if (attr) node.setAttribute(attr, t(source)); else node.textContent = t(source);
  }
  document.querySelectorAll('[data-language-picker] select').forEach(select => {
    select.value = language;
    select.setAttribute('aria-label', t('Jezik'));
  });
}
initializeLanguage();
