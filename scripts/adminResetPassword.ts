import { buildDi } from "../lambda/utils/di";
import { LogUtil } from "../lambda/utils/log";
import { UserDao } from "../lambda/dao/userDao";
import { PasswordHash_hash } from "../lambda/utils/passwordHash";

const minPasswordLength = 8;
const maxPasswordLength = 256;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function main(): Promise<void> {
  const [, , rawEmail, newPassword] = process.argv;
  if (!rawEmail || !newPassword) {
    console.error("Usage: npm run admin:resetpassword -- <email> <newPassword>");
    process.exit(1);
  }
  if (newPassword.length < minPasswordLength) {
    console.error(`Password must be at least ${minPasswordLength} characters`);
    process.exit(1);
  }
  if (newPassword.length > maxPasswordLength) {
    console.error(`Password must be at most ${maxPasswordLength} characters`);
    process.exit(1);
  }

  const email = normalizeEmail(rawEmail);
  const di = buildDi(new LogUtil(), fetch);
  const userDao = new UserDao(di);
  const candidates = await userDao.getAllByEmail(email);
  if (candidates.length === 0) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  const target = candidates.find((u) => u.passwordHash != null) ?? candidates[0];
  if (candidates.length > 1) {
    console.log(
      `Multiple accounts found for ${email}, using id ${target.id} (${
        target.passwordHash != null ? "already has a password - resetting it" : "OAuth-linked - adding a password"
      })`
    );
  }

  target.passwordHash = await PasswordHash_hash(newPassword);
  target.emailVerifiedAt = target.emailVerifiedAt || Date.now();
  await userDao.store(target);
  console.log(`Password set for ${email} (user id ${target.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
