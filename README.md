# Kotva — NoSQL sistem osiguranja

Kotva je demonstraciona full-stack aplikacija za upravljanje osiguranicima,
polisama i osiguravajućim kućama. Projekat koristi ArangoDB kao multi-model
NoSQL bazu i prikazuje poslovnu analitiku kroz interaktivne grafikone.

## Funkcionalnosti

- unos osiguranika, vrste osiguranja, osiguravajuće kuće i datuma prodaje;
- dodavanje novih osiguravajućih kuća;
- automatsko osvežavanje tabele, statistike i grafikona;
- mesečna i dnevna analiza prodaje putnih polisa;
- prosečna starost osiguranika po vrsti osiguranja;
- dinamički prikaz tržišnog udela osiguravajućih kuća;
- pretraga imena bez obzira na velika slova i dijakritike;
- ArangoDB dokumenti, edge kolekcije, named graph, analyzer i indeksi;
- REST API sa validacijom ulaznih podataka.

## Tehnologije

- Node.js i Express
- ArangoDB 3.12 i AQL
- Docker Compose
- HTML, CSS i JavaScript
- Chart.js

## Pokretanje na drugom računaru

Potrebni su [Git](https://git-scm.com/) i
[Docker Desktop](https://www.docker.com/products/docker-desktop/).

```powershell
git clone ADRESA_OVOG_REPOZITORIJUMA
cd kotva
docker compose up --build -d
```

Nakon pokretanja:

- aplikacija: http://localhost:3001
- ArangoDB interfejs: http://localhost:8529
- ArangoDB korisnik: `root`
- demo lozinka: `kotva123`
- baza: `kotva`

Baza, kolekcije, indeksi, graph i demonstracioni podaci kreiraju se automatski
pri prvom pokretanju. Docker volume čuva izmene i nakon gašenja kontejnera.

Status servisa može se proveriti komandama:

```powershell
docker compose ps
docker compose logs -f
```

Zaustavljanje bez brisanja podataka:

```powershell
docker compose down
```

Potpuno brisanje lokalne baze i ponovno kreiranje početnih podataka:

```powershell
docker compose down -v
docker compose up --build -d
```

Ako je port 3001 zauzet, u PowerShell-u se može izabrati drugi port:

```powershell
$env:APP_PORT=3002
docker compose up --build -d
```

## Konfiguracija

Za drugačiju lokalnu lozinku napraviti `.env` na osnovu `.env.example` i
promeniti `ARANGO_PASSWORD`. `.env` je namerno isključen iz Git repozitorijuma.
Demo lozinka iz ovog repozitorijuma namenjena je isključivo lokalnoj prezentaciji.

## REST API

| Metoda | Ruta | Namena |
|---|---|---|
| GET | `/api/health` | Status aplikacije i baze |
| GET | `/api/config` | Dozvoljene vrste osiguranja |
| GET/POST | `/api/clients` | Pregled i unos osiguranika |
| GET/POST | `/api/insurers` | Pregled i unos osiguravajućih kuća |
| GET | `/api/search?q=tekst` | Pretraga osiguranika |
| GET | `/api/analytics` | Podaci za analitički dashboard |

## Model podataka

Document kolekcije su `clients`, `policies` i `insurers`. Edge kolekcije
`owns` i `issued_by` formiraju graph:

```text
clients --owns--> policies --issued_by--> insurers
```

Detaljna tehnička dokumentacija dostupna je u fajlu
[`DOKUMENTACIJA_KOTVA.pdf`](./DOKUMENTACIJA_KOTVA.pdf).

## Napomena

Ovo je portfolio i obrazovni projekat. Pre produkcijske upotrebe potrebno je
uvesti autentifikaciju korisnika, tajne van repozitorijuma, TLS, rate limiting,
backup politiku i stroža pravila pristupa bazi.
