// Admin helpers for the shell, e.g. inside the pod:
//   kubectl -n lanparty exec deploy/lanparty -- node server/cli.ts invite "Max"
//   kubectl -n lanparty exec deploy/lanparty -- node server/cli.ts invite "Victor" --admin
import { createInvite, inviteUrl } from './auth.ts';
import { db } from './db.ts';

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'invite': {
    const label = args.find((a) => !a.startsWith('--')) ?? 'Freund';
    console.log(inviteUrl(createInvite(label, { isAdmin: args.includes('--admin') })));
    break;
  }
  case 'reset': {
    const name = args[0];
    const user = db.prepare('SELECT id, name FROM users WHERE name = ?').get(name ?? '') as { id: number; name: string } | undefined;
    if (!user) {
      console.error(`Kein Account namens "${name}".`);
      process.exit(1);
    }
    console.log(inviteUrl(createInvite(`Passwort-Reset ${user.name}`, { resetUserId: user.id })));
    break;
  }
  case 'users': {
    console.table(db.prepare('SELECT id, name, is_admin, created_at FROM users ORDER BY id').all());
    break;
  }
  default:
    console.log('Befehle: invite <Name> [--admin] | reset <Name> | users');
}
