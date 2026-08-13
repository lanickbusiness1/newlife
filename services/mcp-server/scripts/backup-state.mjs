import path from "node:path";
import { createCoordinatedVerifiedBackup } from "../dist/persistenceAssurance.js";
import { PersistenceCoordinator } from "../dist/persistenceCoordinator.js";

const stateDir = process.env.AFRIAGENESIS_STATE_DIR?.trim();
const backupDir = process.env.PERSISTENCE_BACKUP_DIR?.trim();
const coordinationDir = process.env.PERSISTENCE_COORDINATION_DIR?.trim();

if (!stateDir) throw new Error("AFRIAGENESIS_STATE_DIR_REQUIRED");
if (!backupDir) throw new Error("PERSISTENCE_BACKUP_DIR_REQUIRED");
if (!coordinationDir) throw new Error("PERSISTENCE_COORDINATION_DIR_REQUIRED");

const source = path.resolve(stateDir);
const target = path.resolve(backupDir);
const coordinator = new PersistenceCoordinator(path.resolve(coordinationDir));

const manifest = await createCoordinatedVerifiedBackup(source, target, coordinator);
console.log(JSON.stringify({
  status: "ok",
  operation: "backup",
  source,
  target,
  version: manifest.version,
  files: manifest.files.length,
  createdAt: manifest.createdAt
}));
