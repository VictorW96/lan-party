# LAN-Wahl

A small, invite-only voting site for deciding what a group plays at a LAN party. Everyone gets a
fixed number of votes, can suggest games straight from Steam, and can mark the games they really
don't want to play. The interface is in German.

Built for a LAN party among friends. It runs as a single Node process with an SQLite file, so it's
easy to host yourself.

## How it works

- **Votes.** Each person has 10 votes and can put up to 2 on one game. At most 6 of them may go to
  **classics** (games the group already knows); the rest go to **newcomers**. All limits are
  configurable.
- **Ranking.** The list alternates between the top classic and the top newcomer, each sorted by
  votes. Once one category runs out of games with votes, the rest is sorted by votes alone
  (`server/ranking.ts`).
- **Thumbs down.** Marks a game you really don't want to play. It doesn't change the ranking, but
  everyone can see who is against a game. A thumbs down and votes on the same game exclude each
  other.
- **Questionable games.** Games marked *fraglich* might not work for the whole group (the target is
  at least 10 players together).
- **Suggesting games.** Search Steam right in the app; cover art, screenshots, description, price
  and multiplayer modes are filled in automatically. Games for fewer than 10 players, without
  multiplayer, or not yet released are marked questionable. Games that aren't on Steam just need a
  link; the image and text come from that page.
- **Optional AI check.** With `ANTHROPIC_API_KEY` set, Claude researches newly added games (with web
  search) and adds a German description, the maximum player count, LAN/online support and whether
  the game is questionable.

## Accounts and invites

There is no open sign-up. An admin creates a **personal invite link** for each person in the admin
area. The link works once: the person picks a name and password and is logged in (the session
cookie lasts 180 days). That way only invited people get in, and each account has exactly one vote
budget. For forgotten passwords the admin creates a password-reset link.

On the very first start there is no admin yet, so the server prints an admin invite link to its log.

## Local development

Requires Node 22.18+ (it runs TypeScript directly and has SQLite built in).

```bash
npm install
npm run dev:server   # API on :3000
npm run dev:web      # in a second terminal: Vite on http://localhost:5173/lanparty/
```

The server console shows the admin invite link. Tests and type checks: `npm test`, `npm run typecheck`.

## Running it

Pushing a tag builds the image `ghcr.io/victorw96/lan-party` (`.github/workflows/release.yml`),
tagged with the version and `latest`. The app is served under `/lanparty/` by default, with a
health check at `/healthz`.

### Docker

```bash
docker run -d -p 3000:3000 -v lanparty-data:/data \
  -e PUBLIC_URL=https://example.com/lanparty \
  ghcr.io/victorw96/lan-party:latest
```

### Kubernetes

`k8s/` holds a Kustomize setup for k3s with Traefik and Let's Encrypt: namespace, a 1 Gi volume for
the database, deployment, service and ingress. Before applying it, put your own host into
`k8s/ingress.yaml` and your public URL into `PUBLIC_URL` in `k8s/deployment.yaml`.

```bash
kubectl apply -k k8s
kubectl -n lanparty logs deploy/lanparty   # admin invite link on first start
```

Optional AI check (the pod reads the secret on start, so restart it afterwards):

```bash
kubectl -n lanparty create secret generic lanparty-secrets --from-literal=ANTHROPIC_API_KEY=<your key>
kubectl -n lanparty rollout restart deploy/lanparty
```

After a new release, `kubectl -n lanparty rollout restart deploy/lanparty` pulls the new `latest`
image. If you changed the manifests, run `kubectl apply -k k8s` first.

Back up the database with `kubectl -n lanparty cp <pod>:/data/lanparty.db ./backup.db`.

### Command line

Invite links, password resets and the account list are also available from the shell:

```bash
node server/cli.ts invite "Max" [--admin]
node server/cli.ts reset "Max"
node server/cli.ts users
```

Inside the cluster, prefix these with `kubectl -n lanparty exec deploy/lanparty --`.

## Starting game list

`server/seed/games.json` is the list a fresh database starts with. Each entry can carry a `since`
version. An existing database only receives entries from versions it hasn't seen yet, so adding a
game there never touches games people added themselves, existing votes, or games an admin deleted.
To add a game later, append it with `since` set one higher than the current highest value.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `BASE_PATH` | `/lanparty` | URL prefix the app is served under |
| `PUBLIC_URL` | `http://localhost:5173/lanparty` | Base for invite links |
| `PORT` | `3000` | HTTP port |
| `MAX_VOTES` | `10` | Votes per person |
| `MAX_VOTES_PER_GAME` | `2` | Votes one person can stack on a single game |
| `MAX_CLASSIC_VOTES` | `6` | How many of those may go to classics |
| `MIN_PLAYERS` | `10` | Player count a game needs to count as suitable |
| `ANTHROPIC_API_KEY` | (none) | Turns on the Claude research for new games |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Model used for that research |
| `DATA_DIR` | `./data` | Folder for the SQLite database |

The design notes behind the look of the site are in [docs/redesign-concept.md](docs/redesign-concept.md).
