# assets

Bilder der Website. Zum Austauschen einfach die Datei unter gleichem
Namen überschreiben — die Seiten referenzieren nur die Pfade.

- `portrait.jpg`            → Foto im Hero der Startseite
- `covers/*`                → ein Cover je Projekt (Hover-Vorschau in der
                              Projektliste + Cover-Bild auf der Projektseite)
- `sustainappility/*`       → Sketches, Screen-Entwicklung, finale Screens
- `reachy-mini/*`           → Roboterfoto, Studien-Setup, Erkennung
- `robotics/*`              → Fotos der Hardware-Builds (KI-freigestellt)
- `plugin/*`                → Plugin-Oberflächen

Bilder mit `data-optional` im HTML blenden ihren Block aus, wenn die
Datei fehlt — Platzhalter erzeugen also keine kaputten Bild-Icons.
