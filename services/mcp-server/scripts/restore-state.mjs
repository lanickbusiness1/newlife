import path from "node:path";
import { restoreVerifiedBackup, verifyBackup } from "../dist/persistenceAssurance.js";

const backupDir = process.env.PERSISTENCE_BACKUP_DIR?.trim();
const restoreTargetDir = process.env.PERSISTENCE_RESTORE_TARGET_DIR?.trim();

if (!backupDir) throw new Error("PERSISTENCE_BACKUP_DIR_REQUIRED");
if (!restoreTargetDir) throw new Error("PERSISTENCE_RESTORE_TARGET_DIR_REQUIRED");

const source = path.resolve(backupDir);
const target = path.resolve(restoreTargetDir);
const manifest = await verifyBackup(source);
const restored = await restoreVerifiedBackup(source, target);

console.log(JSON.stringify({
  status: "ok",
  operation: "restore",
  source,
  target,
  version: manifest.version,
  files: restored.restoredFiles
}));
