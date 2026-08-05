# TraceLens

TraceLens er en nettleserbasert verktøykasse for teknisk analyse og lokal dokumentasjon.

## Verktøy

- **URL Inspector** – analyserer lenkestruktur, kodede tegn, avvik og risikosignaler uten å åpne nettstedet.
- **Domain Intel** – henter DNS-poster og vurderer SPF, DMARC og CAA.
- **IP Intel** – viser ASN, nettverkseier, omtrentlig plassering og tilgjengelige infrastruktursignaler.
- **File Intel** – kontrollerer filsignatur, filendelse, entropi, hashes, bilde-EXIF, GPS og enkel PDF-metadata lokalt.
- **Hash Lab** – genererer SHA-256, SHA-384 og SHA-1 og kan kontrollere mot et forventet fingeravtrykk.
- **Saker** – samler funn og notater lokalt med eksport til JSON og en utskriftsvennlig HTML-rapport.

## Personvern

Filer og tekst behandles lokalt i nettleseren. Domain Intel bruker Google Public DNS, og IP Intel bruker ipwho.is når brukeren starter et oppslag. Saker og historikk lagres i nettleserens lokale lagring.

## Lokal kjøring

```bash
python3 -m http.server 8080
```

Åpne `http://localhost:8080`.

## Begrensninger

TraceLens er et analyse- og dokumentasjonsverktøy, ikke en antivirusskanner eller en garanti for at et nettsted eller en fil er trygg. Geografisk IP-informasjon er omtrentlig.
