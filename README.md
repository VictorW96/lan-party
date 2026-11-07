# LAN//VOTE – House of Gaming

Abstimmungsseite für unsere LAN-Party im House of Gaming in Miesbach. Läuft unter
**https://victor-wolf.com/lanparty** im k3s-Cluster von Defense of Solaris.

- Jeder Freund hat einen eigenen Account und **8 Votes** (max. 2 pro Spiel). Höchstens **5 davon dürfen auf
  Klassiker** gehen, der Rest muss an Newcomer. Alles per Env-Variable änderbar.
- Die Liste wechselt zwischen **Klassikern** und **Newcomern**, jeweils nach Votes sortiert. Sobald eine
  Kategorie keine Spiele mit Votes mehr hat, geht es rein nach Votes weiter (`server/ranking.ts`).
- Spiele mit Tag **„Fraglich“** sind nicht sicher LAN-tauglich (Ziel: mindestens 10 Spieler gemeinsam).
- Neue Spiele sucht man direkt auf Steam aus. Bilder, Screenshots, Beschreibung, Preis und Multiplayer-Modi
  kommen automatisch. Spiele unter 10 Spielern, ohne Multiplayer oder noch nicht erschienene werden
  automatisch als fraglich markiert. Ohne Steam reicht ein Link: Bild und Text kommen dann von der Website.
- Optional: Mit `ANTHROPIC_API_KEY` recherchiert Claude (mit Websuche) neue Spiele zusätzlich: deutsche
  Beschreibung, maximale Spielerzahl, LAN/Online und ob es fraglich ist.

## Login-Konzept

Keine offene Registrierung. Der Admin erstellt im Admin-Bereich pro Freund einen **persönlichen
Einladungslink**, der genau einmal funktioniert. Darüber legt der Freund Namen und Passwort fest und ist
danach eingeloggt (Session-Cookie für 180 Tage). So kommen nur eingeladene Leute auf die Seite, und
jeder Account hat genau ein Vote-Kontingent. Vergessene Passwörter: Admin → „Passwort-Reset-Link“.

Beim allerersten Start gibt es noch keinen Admin. Dann steht ein Admin-Einladungslink im Log.

## Lokal entwickeln

Node 22.18+ (führt TypeScript direkt aus, SQLite ist eingebaut).

```bash
npm install
npm run dev:server   # API auf :3000
npm run dev:web      # in einem zweiten Terminal: Vite auf http://localhost:5173/lanparty/
```

Den Admin-Einladungslink zeigt die Server-Konsole. Tests und Typecheck: `npm test`, `npm run typecheck`.

## Deployment

1. **DNS:** A-Record für `victor-wolf.com` auf die IP des Hetzner-Servers setzen (gleiche IP wie
   `defense-of-solaris.com`). Traefik holt das Let's-Encrypt-Zertifikat automatisch per HTTP-Challenge.
2. **Image bauen:** Repo nach GitHub pushen (`VictorW96/lan-party`) und einen Tag pushen.
   `.github/workflows/release.yml` baut `ghcr.io/victorw96/lan-party:latest`.
   Ist das Repo privat, das Package auf GitHub auf *public* stellen oder ein `imagePullSecret` anlegen.
3. **Optional, KI-Anreicherung:**
   ```bash
   kubectl create namespace lanparty
   kubectl -n lanparty create secret generic lanparty-secrets --from-literal=ANTHROPIC_API_KEY=sk-ant-...
   ```
4. **Ausrollen:**
   ```bash
   kubectl apply -k k8s
   ```
5. **Admin-Link holen:**
   ```bash
   kubectl -n lanparty logs deploy/lanparty
   ```
   Weitere Links gibt's im Admin-Bereich der Seite oder per CLI:
   `kubectl -n lanparty exec deploy/lanparty -- node server/cli.ts invite "Max"`.

`victor-wolf.com/` leitet auf `/lanparty/` um. Die Datenbank liegt als SQLite-Datei auf dem PVC
`lanparty-data` (Backup: `kubectl -n lanparty cp <pod>:/data/lanparty.db ./backup.db`).

## Konfiguration

| Variable | Standard | Bedeutung |
|---|---|---|
| `BASE_PATH` | `/lanparty` | URL-Präfix |
| `PUBLIC_URL` | `http://localhost:5173/lanparty` | Basis für Einladungslinks |
| `MAX_VOTES` | `8` | Votes pro Person |
| `MAX_VOTES_PER_GAME` | `2` | Votes, die man auf ein Spiel stapeln darf |
| `MAX_CLASSIC_VOTES` | `5` | Davon höchstens so viele für Klassiker |
| `MIN_PLAYERS` | `10` | Ab wie vielen Spielern ein Spiel als geeignet gilt |
| `ANTHROPIC_API_KEY` | – | Aktiviert die Claude-Recherche für neue Spiele |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Modell für die Recherche |
| `DATA_DIR` | `./data` | Ordner der SQLite-Datenbank |
