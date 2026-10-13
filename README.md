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
