'use strict';

(() => {
  const html = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const asList = items => items.filter(Boolean).map(item => `<li>${html(item)}</li>`).join('');
  const make = (level, title, summary, meaning, actions, limitations) => ({ level, title, summary, meaning, actions, limitations });
  const reportText = (report, target='') => [
    'TraceLens – enkel rapport', target && `Mål: ${target}`, `Vurdering: ${report.level}`, '', report.summary, '',
    'Hva betyr dette?', ...report.meaning.map(x=>`- ${x}`), '', 'Anbefalt neste steg', ...report.actions.map(x=>`- ${x}`), '',
    'Begrensninger', ...report.limitations.map(x=>`- ${x}`)
  ].filter((line,index)=>line||index>0).join('\n');

  function urlReport(target, data) {
    const level=data.level||'Lav';
    const host=data.host||(()=>{try{return new URL(target).hostname}catch{return target}})();
    const signals=(data.findings||[]).filter(x=>x?.[0]!=='low').map(x=>x?.[1]).filter(Boolean);
    const summary=level==='Høy'
      ?'Lenken har tydelige faresignaler i oppbygningen. Ikke bruk den til innlogging eller betaling før domenet er kontrollert gjennom en kjent kanal.'
      :level==='Middels'
        ?'Lenken har trekk som bør undersøkes nærmere. Den er ikke nødvendigvis farlig, men bør ikke behandles som bekreftet trygg.'
        :'Lenkens oppbygning viser ingen klare faresignaler. Det bekrefter likevel ikke at nettstedets innhold er trygt.';
    return make(level,'Enkel vurdering av lenken',summary,[
      `Nettleseren vil kontakte verten «${host}». Det er denne adressen som er viktigst å kontrollere.`,
      signals.length?`Analysen reagerte på: ${signals.join(', ')}.`:'Det ble ikke funnet uvanlige tegn i selve lenkestrukturen.',
      'Risikoscoren vurderer bare URL-strukturen. Den åpner ikke nettstedet og kontrollerer ikke om andre har rapportert det.'
    ],level==='Lav'?[ 
      'Kontroller at domenet er nøyaktig det du forventer før innlogging eller betaling.',
      'Åpne virksomhetens kjente nettside manuelt dersom lenken kom uventet.'
    ]:[
      'Ikke oppgi passord, kortinformasjon eller personopplysninger via lenken.',
      'Sammenlign domenet med virksomhetens offisielle nettside eller kontakt avsenderen gjennom en kjent kanal.',
      'Lagre funnet i en sak dersom lenken inngår i en mistenkelig melding.'
    ],[
      'TraceLens utfører ikke skadevarekontroll og åpner ikke nettstedet.',
      'En normal lenke kan fortsatt være farlig, og en uvanlig lenke kan være legitim.'
    ]);
  }

  function domainReport(target,data){
    const level=data.level||'Lav';
    const missing=[!data.hasSpf&&'SPF',!data.hasDmarc&&'DMARC',!data.hasCaa&&'CAA'].filter(Boolean);
    const summary=!data.hasSpf&&!data.hasDmarc
      ?'Domenet mangler synlig SPF og DMARC. Det gir mottakere mindre hjelp til å kontrollere e-post som hevder å komme fra domenet.'
      :!data.hasDmarc
        ?'Domenet har noe e-postbeskyttelse, men ingen synlig DMARC-post ble funnet.'
        :'Domenet publiserer grunnleggende e-postbeskyttelse. Det er positivt, men beviser ikke at all e-post eller alle nettsider er trygge.';
    return make(level,'Enkel forklaring av domenet',summary,[
      'DNS er domenets offentlige adressebok. A og AAAA peker mot servere, MX mot e-postservere og NS viser hvem som håndterer DNS.',
      data.hasSpf?'SPF er funnet og beskriver hvilke servere som kan sende e-post for domenet.':'SPF ble ikke funnet, så mottakere får mindre hjelp til å kontrollere avsenderen.',
      data.hasDmarc?'DMARC er funnet og gir regler for e-post som feiler kontrollene.':'DMARC ble ikke funnet, så det finnes ingen synlig felles regel for mislykket e-postkontroll.',
      data.hasCaa?'CAA begrenser hvilke sertifikatutstedere som kan utstede sertifikater.':'CAA ble ikke funnet. Det er vanlig og er ikke alene et sikkerhetsproblem.'
    ],missing.length?[
      `Undersøk de manglende signalene videre: ${missing.join(', ')}.`,
      'Ved mistanke om falsk e-post bør hele avsenderadressen og e-posthodene kontrolleres.',
      'For et domene du eier: vurder korrekt SPF og DMARC før en streng policy aktiveres.'
    ]:[
      'Kontroller at policyene peker til riktige tjenester dersom domenet er ditt.',
      'Vurder alltid sammenhengen rundt e-posten eller lenken; god DNS-konfigurasjon gjør ikke innhold automatisk legitimt.'
    ],[
      'Analysen ser bare på offentlig DNS på analysetidspunktet.',
      'DKIM kan ikke vurderes fullstendig uten riktig selector.',
      'Manglende poster betyr ikke i seg selv at domenet er svindel.'
    ]);
  }

  function ipReport(target,data){
    if(data.public===false)return make('Lav','Enkel forklaring av IP-adressen',
      'Dette er en privat eller lokal IP-adresse. Den brukes inne i et lokalt nettverk og kan ikke knyttes direkte til en offentlig leverandør eller plassering.',[
        `${data.classification||'Privat adresse'} kan brukes på mange forskjellige lokale nettverk samtidig.`,
        'Adressen er bare meningsfull sammen med lokale router-, DHCP- eller brannmurlogger.'
      ],[
        'Finn tidspunktet og enheten adressen var knyttet til i det lokale nettverket.',
        'Ikke bruk offentlige IP-oppslag for å finne eier eller sted for denne adressen.'
      ],['TraceLens kan ikke se enhetene på nettverket ditt.','En privat IP-adresse identifiserer ikke en bestemt person.']);
    const owner=data.org||data.isp||'en ukjent nettverkseier';
    const place=[data.city,data.region,data.country].filter(Boolean).join(', ')||'ukjent område';
    return make('Lav','Enkel forklaring av IP-adressen',
      `IP-adressen er registrert hos ${owner} og omtrent knyttet til ${place}. Dette beskriver nettverket, ikke nødvendigvis personen eller enheten som brukte adressen.`,[
        data.asn?`ASN ${data.asn} identifiserer nettverket som annonserer adressen på internett.`:'Ingen ASN-verdi var tilgjengelig.',
        'Leverandør og organisasjon viser hvem som administrerer adressen eller nettblokken.',
        'By og koordinater kan peke på leverandørens knutepunkt i stedet for brukerens faktiske sted.'
      ],[
        'Sammenlign adressen med tidspunkt, hendelse og forventet leverandør i loggen der du fant den.',
        'Se etter flere signaler før adressen blokkeres eller rapporteres.',
        'Behandle plassering ekstra forsiktig ved VPN, sky-, mobil- eller proxytjenester.'
      ],['Et IP-oppslag identifiserer ikke en bestemt person.','VPN, proxy, skyløsninger og delte adresser kan skjule kilden.','Geografisk IP-informasjon er omtrentlig og kan være utdatert.']);
  }

  function fileReport(target,data){
    const mismatch=data.extensionMatches===false, entropy=Number(data.entropy), high=Number.isFinite(entropy)&&entropy>7.7;
    return make(mismatch?'Høy':high?'Middels':'Lav','Enkel forklaring av filen',mismatch
      ?'Filnavnet og den interne signaturen beskriver ikke samme filtype. Behandle filen som mistenkelig til avviket er forklart.'
      :'Filens interne signatur samsvarer med filendelsen. Det er positivt, men betyr ikke at filinnholdet er trygt.',[
        `Oppdaget filtype er «${data.signature?.type||data.type||'ukjent'}». Signaturen er mer pålitelig enn filnavnet alene.`,
        mismatch?'Filtypeavvik kan skyldes feil navn, men brukes også for å skjule uventede filer.':'Samsvar betyr bare at filen ser ut som filtypen den utgir seg for å være.',
        Number.isFinite(entropy)?(high?`Entropien er høy (${entropy.toFixed(2)} av 8). Filen kan være komprimert, kryptert eller pakket.`:`Entropien er ${entropy.toFixed(2)} av 8 og gir ikke alene et tydelig faresignal.`):'Entropi var ikke tilgjengelig.',
        'SHA-256 er filens digitale fingeravtrykk. Selv en liten innholdsendring gir normalt en helt annen verdi.'
      ],mismatch?[
        'Ikke åpne filen før avsender og forventet filtype er bekreftet.',
        'Sammenlign SHA-256 med en verdi fra en pålitelig kilde når det finnes.',
        'Bruk en oppdatert skadevareskanner dersom filen kom fra en ukjent kilde.'
      ]:[
        'Kontroller avsenderen dersom filen kom uventet.',
        'Lagre SHA-256 dersom du senere vil dokumentere at filen ikke er endret.',
        'Bruk en oppdatert skadevareskanner før åpning når filen ikke er betrodd.'
      ],['TraceLens kjører ikke filen og er ikke en antivirus-skanner.','Metadata kan være fjernet, redigert eller forfalsket.','En korrekt filsignatur beviser ikke at innholdet er ufarlig.']);
  }

  function hashReport(target,data){
    const expected=Boolean(data.expected), match=data.match;
    const summary=!expected?'Det er laget digitale fingeravtrykk som kan brukes til å kontrollere senere om nøyaktig samme innhold er uendret.'
      :match?'Den forventede hashverdien samsvarer. Innholdet er byte-for-byte likt fingeravtrykket, dersom referanseverdien er pålitelig.'
      :'Den forventede hashverdien samsvarer ikke. Innholdet er endret, feil fil er valgt eller referanseverdien er feil.';
    return make(match===false?'Høy':'Lav','Enkel forklaring av fingeravtrykket',summary,[
      'En hash er et digitalt fingeravtrykk, ikke kryptering og ikke en vurdering av om innholdet er trygt.',
      expected?(match?'Den beregnede verdien er identisk med den forventede verdien.':'Ingen av de beregnede hashene var identisk med verdien du limte inn.'):'Uten en forventet verdi finnes det ingenting å sammenligne med.',
      'SHA-256 bør normalt brukes som hovedverdi. SHA-1 vises for eldre systemer.'
    ],match===false?[
      'Ikke anta at dette er riktig fil før avviket er forklart.',
      'Hent forventet hash på nytt fra en pålitelig og uavhengig kilde.',
      'Kontroller at riktig fil og riktig algoritme ble brukt.'
    ]:[
      'Lagre SHA-256 sammen med dato og kilde dersom integritet skal dokumenteres.',
      'Ved programvare: sammenlign med verdien publisert av den offisielle leverandøren.'
    ],['Hashverdien sier ingenting om kvalitet, innhold eller skadevare.','Samsvar er bare meningsfullt når referanseverdien kommer fra en troverdig kilde.']);
  }

  function buildReport(type,target,data={}){
    if(type==='url')return urlReport(target,data);
    if(type==='domain')return domainReport(target,data);
    if(type==='ip')return ipReport(target,data);
    if(type==='file')return fileReport(target,data);
    if(type==='hash')return hashReport(target,data);
    return null;
  }

  window.TraceLensReports=Object.freeze({buildReport,reportText,html,asList});
})();
