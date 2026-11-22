/**
 * Memindahkan file siswa, PPDB, pegawai, dan bukti bayar dari bucket publik ke bucket privat.
 *
 *   npm run storage:migrate-private-files                         cek saja, tidak mengubah apa pun
 *   npm run storage:migrate-private-files -- --apply              salin file dan perbarui database
 *   npm run storage:migrate-private-files -- --delete-originals <manifest.json>
 *
 * File asli tetap publik sampai langkah --delete-originals dijalankan.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import {
  BUCKET_NAME,
  PRIVATE_BUCKET_NAME,
  PRIVATE_PATH_PREFIX,
  buildPrivateKey,
  resolveStoredObject,
  s3Client,
} from '../src/common/storage';

interface ManifestItem {
  sourceUrl: string;
  bucket: string;
  key: string;
  target: string;
}

interface Target {
  model: 'studentDocument' | 'student' | 'ppdbDocument' | 'ppdbPayment' | 'employeeDocument' | 'employee' | 'payment';
  field: 'filePath' | 'photoPath' | 'proofPath';
  owner: string;
  folder: 'students' | 'ppdb' | 'employees' | 'payments';
}

// Termasuk baris yang sudah di-soft-delete karena filenya tetap publik.
const TARGETS: Target[] = [
  { model: 'studentDocument', field: 'filePath', owner: 'studentId', folder: 'students' },
  { model: 'student', field: 'photoPath', owner: 'id', folder: 'students' },
  { model: 'ppdbDocument', field: 'filePath', owner: 'registrationId', folder: 'ppdb' },
  { model: 'ppdbPayment', field: 'proofPath', owner: 'registrationId', folder: 'ppdb' },
  { model: 'employeeDocument', field: 'filePath', owner: 'employeeId', folder: 'employees' },
  { model: 'employee', field: 'photoPath', owner: 'id', folder: 'employees' },
  { model: 'payment', field: 'proofPath', owner: 'invoiceId', folder: 'payments' },
];
const ALLOWED_PREFIXES = ['students/', 'ppdb/', 'employees/', 'payments/'];

const delegate = (model: Target['model']) => (prisma as any)[model];
const isLegacy = (filePath: string | null | undefined): filePath is string =>
  !!filePath && !filePath.startsWith(PRIVATE_PATH_PREFIX) && !!resolveStoredObject(filePath);

/** Menghentikan proses bila file di bucket tujuan masih bisa dibuka tanpa login. */
export async function assertPrivateBucket() {
  const key = `.privacy-check-${Date.now()}`;
  await s3Client.send(new PutObjectCommand({ Bucket: PRIVATE_BUCKET_NAME, Key: key, Body: 'check' }));
  try {
    const url = `https://${env.storage.projectRef}.supabase.co/storage/v1/object/public/${PRIVATE_BUCKET_NAME}/${key}`;
    const res = await fetch(url);
    if (res.ok) throw new Error(`Bucket "${PRIVATE_BUCKET_NAME}" masih publik. Proses dihentikan.`);
  } finally {
    await s3Client.send(new DeleteObjectCommand({ Bucket: PRIVATE_BUCKET_NAME, Key: key }));
  }
}

async function copyToPrivate(sourceUrl: string, folder: string): Promise<ManifestItem> {
  const source = resolveStoredObject(sourceUrl)!;
  const object = await s3Client.send(new GetObjectCommand({ Bucket: source.bucket, Key: source.key }));
  const body = await object.Body!.transformToByteArray();
  const key = buildPrivateKey(folder, source.key);
  await s3Client.send(
    new PutObjectCommand({ Bucket: PRIVATE_BUCKET_NAME, Key: key, Body: body, ContentType: object.ContentType }),
  );
  const head = await s3Client.send(new HeadObjectCommand({ Bucket: PRIVATE_BUCKET_NAME, Key: key }));
  if (head.ContentLength !== body.length) throw new Error('Ukuran file hasil salinan tidak cocok');
  return { sourceUrl, bucket: source.bucket, key: source.key, target: `${PRIVATE_PATH_PREFIX}${key}` };
}

export async function migrate(apply: boolean, manifestPath: string) {
  const work: { target: Target; rows: Record<string, any>[] }[] = [];
  for (const target of TARGETS) {
    const rows: Record<string, any>[] = await delegate(target.model).findMany({
      where: { [target.field]: { not: null } },
      select: { id: true, [target.owner]: true, [target.field]: true },
    });
    const legacy = rows.filter((r) => isLegacy(r[target.field]));
    const unknown = rows.filter((r) => !r[target.field].startsWith(PRIVATE_PATH_PREFIX) && !isLegacy(r[target.field]));
    console.log(`${target.model}: perlu dipindah ${legacy.length}, path tidak dikenali ${unknown.length}`);
    work.push({ target, rows: legacy });
  }
  if (!apply) {
    console.log('Mode cek saja. Tidak ada perubahan.');
    return { moved: 0, failed: 0 };
  }

  await assertPrivateBucket();
  const copied = new Map<string, ManifestItem>();
  let failed = 0;
  try {
    for (const { target, rows } of work) {
      for (const row of rows) {
        try {
          const url: string = row[target.field];
          const item = copied.get(url) ?? (await copyToPrivate(url, `${target.folder}/${row[target.owner]}`));
          copied.set(url, item);
          await delegate(target.model).update({ where: { id: row.id }, data: { [target.field]: item.target } });
        } catch (err) {
          failed += 1;
          console.error(`Gagal memindah ${target.model} ${row.id}: ${(err as Error).message}`);
        }
      }
    }
  } finally {
    fs.writeFileSync(manifestPath, JSON.stringify([...copied.values()], null, 2));
  }
  console.log(`Berhasil: ${copied.size} file. Gagal: ${failed}. Manifest: ${manifestPath}`);
  return { moved: copied.size, failed };
}

export async function deleteOriginals(manifestPath: string) {
  const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestItem[];
  let deleted = 0;
  let skipped = 0;
  for (const item of items) {
    const refs = await Promise.all(
      TARGETS.map((t) => delegate(t.model).count({ where: { [t.field]: item.sourceUrl } }) as Promise<number>),
    );
    const target = resolveStoredObject(item.target);
    const copyExists = target
      ? await s3Client.send(new HeadObjectCommand({ Bucket: target.bucket, Key: target.key })).then(() => true, () => false)
      : false;
    const allowed = item.bucket === BUCKET_NAME && ALLOWED_PREFIXES.some((p) => item.key.startsWith(p));
    if (refs.some(Boolean) || !copyExists || !allowed) {
      skipped += 1;
      console.error(`Dilewati, masih dipakai atau salinan tidak ditemukan: ${item.key}`);
      continue;
    }
    await s3Client.send(new DeleteObjectCommand({ Bucket: item.bucket, Key: item.key }));
    deleted += 1;
  }
  console.log(`File publik dihapus: ${deleted}. Dilewati: ${skipped}.`);
  return { deleted, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const deleteIndex = args.indexOf('--delete-originals');
  if (deleteIndex >= 0) {
    if (!args[deleteIndex + 1]) throw new Error('Sebutkan file manifest');
    const result = await deleteOriginals(args[deleteIndex + 1]);
    if (result.skipped) process.exitCode = 1;
    return;
  }
  const result = await migrate(args.includes('--apply'), `private-files-migration-${Date.now()}.json`);
  if (result.failed) process.exitCode = 1;
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
