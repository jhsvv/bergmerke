# Bergmerke

Mobiltilpassa fotoannotering for inspeksjon av bergskjering. Rein HTML, CSS og JavaScript utan avhengigheiter. Bilete blir behandla lokalt i nettlesaren.

## Bruk

Opne `index.html`, vel eit bilete og vel verktøy. Trykk for å plassere punkt eller hjørne. Linjer treng minst to hjørne, polygon minst tre. Trykk Fullfør figur. Skriv tekst i merknadsfeltet før du plasserer tekst. Angre fjernar siste hjørne eller siste objekt. Ved zoom kan du rulle i biletet. Symbolstorleiken gjeld nye objekt.

Lagre PNG eksporterer foto med alle fullførte markeringar. Ein reserveførehandsvising kan lagrast med langt trykk på mobil. Legg det eksporterte biletet ved rett objekt i Field Maps. Ingen direkte ArcGIS-integrasjon er inkludert.

## GitHub Pages

1. Opprett eit repository på GitHub, til dømes `bergmerke`.
2. Last opp `index.html`, `style.css`, `app.js` og `.nojekyll` til rota av `main`.
3. Opne **Settings → Pages → Build and deployment**.
4. Vel **Deploy from a branch**, **main** og **/ (root)**. Trykk **Save**.
5. Når publiseringa er ferdig, opne adressa GitHub viser, vanlegvis `https://BRUKARNAMN.github.io/bergmerke/`.

Dette prosjektet krev ingen byggjesteg. Bruk relative filstiar slik at sida fungerer under repository-namnet. GitHub-kontoen og repository-typen må støtte Pages.

## Avgrensingar i første versjon

- Teikningane finst berre i minnet fram til eksport. Ikkje lukk eller last sida på nytt før biletet er lagra. Originalfila blir ikkje endra.
- Ingen offline-cache, automatisk lagring, flytting av eksisterande objekt eller gjenopning av redigerbare prosjekt enno.
- Markeringane er biletkoordinatar, ikkje geografiske GIS-objekt.
- Store bilete blir skalerte til maksimalt 4096 pikslar på lengste side. PNG-eksport tek ikkje vare på EXIF/GPS-metadata.
- Bruk bileteformat nettlesaren kan lese. HEIC-støtte varierer.
- Prøv kamera, orientering, zoom, nedlasting og vedlegg i Field Maps på dei faktiske iOS-/Android-einingane før feltbruk.
- Ei publisert nettside krev nett ved første lasting; ho er ikkje ei offline-PWA.

## Zoom, flytting og komprimering

Klyp med to fingrar i biletflata for zoom (1–6 gonger). Dra på bakgrunnen for å panorere. Vel «Vel / flytt» og dra eit punkt, ein tekst, ei linje eller eit polygon. Treff kanten eller innsida for polygon. Angre reverserer også flytting. Zoommenyen er framleis tilgjengeleg.

Standard eksport er JPEG med kvalitet 82 % og halv breidd/høgd av arbeidsbiletet. Det gir ein firedel av pikslane, men ikkje nødvendigvis halv filstorleik. Arbeidsbiletet har framleis maksimalt 4096 pikslar på lengste side. Vel full storleik eller PNG ved behov. Eksporten viser mål og filstorleik. Originalfila blir ikkje endra.

Dette erstattar dei tidlegare avgrensingane om manglande objektflytting og berre PNG-eksport. Test klypezoom på fysisk mobil før feltbruk.

Flytt / rediger er no plassert rett over teikneområdet. I denne modusen er klypezoom, zoommenyen og panorering låst. Dra objekt med éin finger. To fingrar avbryt ei pågåande flytting. Trykk knappen igjen (eller vel eit teikneverktøy) for å låse opp zoom og panorering.

Musehjul over biletflata zoomar rundt musepeikaren: opp for inn, ned for ut (1–6 gonger). Zoom er framleis låst i Flytt / rediger.

## Registreringsmodus og teiknforklaring

Vel Enkel eller Avansert over verktøya. Avansert brukar symbol frå geologimalen, inkludert 21 boltvariantar med lengd og diameter. Dei innebygde biletsymbola er henta ut frå Word; dei andre formene blir teikna med canvas. Avgrensingane blir plasserte som to endemerke: vel start og slutt, så Fullfør figur. Endemerka og boreretningssymbolet har fast retning frå malen. Faktisk staglengd kan skrivast som tekstmerknad.

Malen har eit avvik: teksten for 2,4 m Ø32 seier lilla, medan symbolet er gult. Appen brukar det gule symbolet.

Modusbyte beheld eksisterande objekt, men avbryt ei ufullført figur. Kryss av Teiknforklaring på biletet for å få eit kvitt felt under fotoet med berre brukte symboltypar, utan duplikat. Tekstmerknader har inga eiga rad. Valet fungerer med JPEG og PNG.

Ved oppdatering av GitHub Pages: last opp index.html, app.js, style.css, advanced-symbols.js og heile symbols/-mappa. Word-fila, reference-media/, testar og førehandsvisingar skal ikkje publiserast.

## Lokal lagring, panorering og plassering av teiknforklaring

Avanserte biletsymbol er no innebygde som data-URL-ar i advanced-symbols.js. Dette unngår at separate file://-bilete gjer canvas utilgjengeleg for eksport. Ha index.html, style.css, app.js og advanced-symbols.js i same mappe, og opne index.html på nytt etter oppdatering. symbols/-mappa er ikkje lenger nødvendig for køyring.

Panorer er standard ved oppstart og ligg rett over teikneområdet. Trykk i denne modusen legg ikkje til markeringar. Dra for panorering; klyp eller bruk musehjul for zoom.

Plasser teiknforklaring blir tilgjengeleg når minst ein symboltype er brukt. Trykk knappen og så der øvre venstre hjørne skal vere. Panelet blir halde innanfor biletet og er synleg før eksport. Trykk knappen på nytt for ny plassering. Fjern teiknforklaring tek det bort; Angre reverserer plassering og fjerning. Panelet oppdaterer seg med brukte symbol. Det tidlegare avkryssingsvalet og feltet under fotoet er erstatta av dette.

Eksporten inneheld same teiknforklaring som førehandsvisinga. Om automatisk nedlasting blir blokkert, bruk den synlege nedlastingslenkja eller lagre førehandsvisingsbiletet. Eksportfeil blir viste i statusfeltet.

Musepeikaren viser valt symbol i teiknemodus, open/lukka hand ved panorering, flyttepeikar ved redigering og plasseringspeikar for teiknforklaring. Symbolpeikaren har treffpunkt midt i symbolet. Dersom eigendefinert peikar ikkje blir støtta, blir eit trådkross brukt. Dette gjeld mus/peikeflate; berøringsskjerm viser normalt ingen peikar.

Teiknforklaringa kan også dragast etter plassering: vel Flytt / rediger og dra panelet. Det blir halde innanfor biletet. Angre reverserer flyttinga, og avbroten berøring eller to fingrar avbryt flyttinga.
