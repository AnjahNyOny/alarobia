"""Police du site : Archivo variable (caractères latins) réduite aux graisses et largeurs que le site utilise.

    python3 -m venv /tmp/venv-police && /tmp/venv-police/bin/pip install fonttools brotli
    curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900" \
      | awk '/\/\* latin \*\//{f=1} f&&/src:/{print; exit}' | grep -o 'https://[^)]*' | xargs curl -s -o /tmp/archivo.woff2
    /tmp/venv-police/bin/python scripts/police-archivo.py /tmp/archivo.woff2

La deuxième commande récupère le fichier que next/font téléchargeait : la famille entière, sous-ensemble « latin ».

Google Fonts sert toujours le fichier complet (graisses 100 à 900, largeurs 62 à 125 %) : 88 ko, le plus gros fichier
de chaque page après le code. Le site n'emploie que les graisses 400 à 800 (texte 400 à 600, titres 700 et 800) et les
largeurs 68 à 100 % (titres 68 et 78 %, écriture « Enseigne » de la personnalisation 75 %, texte 100 %) : le fichier
réduit à ces plages pèse 57 ko et dessine les mêmes lettres. Il est chargé par `next/font/local` dans
`src/app/[locale]/layout.tsx`.

Une graisse ou une largeur hors de ces plages (`font-black`, `font-light`, `font-stretch` à 125 %…) serait ramenée à la
plus proche : élargir les plages ci-dessous et relancer le script. Licence : SIL Open Font License 1.1, sans nom réservé
(`assets/fonts/OFL.txt`), qui autorise cette version modifiée.
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GRAISSES = (400, 800)
LARGEURS = (68, 100)
SORTIE = Path(__file__).resolve().parent.parent / "src/app/fonts/archivo-latin.woff2"

if len(sys.argv) != 2:
    raise SystemExit("Usage : police-archivo.py <Archivo variable, sous-ensemble latin, en woff2>")
police = TTFont(sys.argv[1])
# Le style par défaut du fichier (graisse 600, largeur 100 %) reste dans les plages : les autres positions sont recalculées.
reduite = instancer.instantiateVariableFont(
    police,
    {"wght": instancer.AxisTriple(GRAISSES[0], 600, GRAISSES[1]), "wdth": instancer.AxisTriple(LARGEURS[0], 100, LARGEURS[1])},
)
reduite.flavor = "woff2"
SORTIE.parent.mkdir(parents=True, exist_ok=True)
reduite.save(SORTIE)
print(f"{sys.argv[1]} -> {SORTIE} ({SORTIE.stat().st_size} octets)")
