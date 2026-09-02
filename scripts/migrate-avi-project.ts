import fs from 'fs';
import path from 'path';
import knex, { Knex } from 'knex';
import { createClient } from '@supabase/supabase-js';

const builderTables = [
  'page_folders',
  'pages',
  'page_layers',
  'settings',
  'layer_styles',
  'components',
  'asset_folders',
  'assets',
  'collections',
  'collection_fields',
  'collection_items',
  'collection_item_values',
  'locales',
  'translations',
  'versions',
  'form_submissions',
  'webhooks',
  'webhook_deliveries',
  'collection_imports',
  'app_settings',
  'fonts',
  'color_variables',
  'global_variables',
  'ai_chats',
] as const;

const tableOrder = [
  'page_folders',
  'asset_folders',
  'pages',
  'page_layers',
  'assets',
  'settings',
  'layer_styles',
  'components',
  'collections',
  'collection_fields',
  'collection_items',
  'collection_item_values',
  'locales',
  'translations',
  'versions',
  'form_submissions',
  'webhooks',
  'webhook_deliveries',
  'collection_imports',
  'app_settings',
  'fonts',
  'color_variables',
  'global_variables',
  'ai_chats',
] as const;

const requiredEnvironment = [
  'AVI_SOURCE_DATABASE_URL',
  'AVI_DESTINATION_DATABASE_URL',
  'AVI_SOURCE_SUPABASE_URL',
  'AVI_DESTINATION_SUPABASE_URL',
  'AVI_DESTINATION_SUPABASE_SECRET_KEY',
] as const;

function requireEnvironment(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function databaseClient(connectionString: string): Knex {
  return knex({
    client: 'pg',
    connection: {
      connectionString,
      ssl: { rejectUnauthorized: false },
    },
    pool: { min: 0, max: 1 },
  });
}

async function runDestinationMigrations(destination: Knex): Promise<void> {
  const hasMigrationsTable = await destination.schema.hasTable('migrations');
  if (!hasMigrationsTable) {
    await destination.schema.createTable('migrations', (table) => {
      table.uuid('id').defaultTo(destination.raw('gen_random_uuid()')).primary();
      table.string('name').notNullable();
      table.integer('batch').notNullable();
      table.timestamp('migration_time').defaultTo(destination.fn.now());
    });
    await destination.raw('REVOKE ALL ON public.migrations FROM PUBLIC');
    await destination.raw('REVOKE ALL ON public.migrations FROM anon');
    await destination.raw('REVOKE ALL ON public.migrations FROM authenticated');
    await destination.raw('GRANT SELECT, INSERT, UPDATE, DELETE ON public.migrations TO postgres');
  }

  const completed = new Set(
    (await destination('migrations').select('name')).map((row: { name: string }) => row.name),
  );
  const files = fs.readdirSync(path.join(process.cwd(), 'database/migrations'))
    .filter((file) => file.endsWith('.ts'))
    .sort();
  let batch = 1;

  for (const file of files) {
    if (completed.has(file)) continue;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const migration = require(path.join(process.cwd(), 'database/migrations', file)) as {
      up: (client: Knex) => Promise<void>;
    };
    await destination.transaction(async (transaction) => {
      await migration.up(transaction);
      await transaction('migrations').insert({ name: file, batch });
    });
  }
}

async function clearDestinationBuilderData(destination: Knex): Promise<void> {
  const quotedTables = builderTables.map((table) => `public."${table}"`).join(', ');
  await destination.raw(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
}

function storageObjectUrl(projectUrl: string, storagePath: string): string {
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/assets/${encodedPath}`;
}

async function jsonColumnsForTable(source: Knex, table: string): Promise<string[]> {
  const columns = await source('information_schema.columns')
    .select('column_name')
    .where({ table_schema: 'public', table_name: table })
    .whereIn('data_type', ['json', 'jsonb']);
  return columns.map((column: { column_name: string }) => column.column_name);
}

async function copyTable(source: Knex, destination: Knex, table: (typeof tableOrder)[number], destinationUrl: string): Promise<number> {
  let query = source(table).select('*');
  if (table === 'asset_folders') query = query.orderBy('depth', 'asc');
  const rows = await query;
  if (rows.length === 0) return 0;
  const jsonColumns = await jsonColumnsForTable(source, table);

  const records = rows.map((row) => {
    const record = { ...row };
    for (const column of jsonColumns) {
      if (record[column] !== null && record[column] !== undefined) {
        record[column] = JSON.stringify(record[column]);
      }
    }
    if (table === 'assets' && record.storage_path) {
      record.public_url = storageObjectUrl(destinationUrl, record.storage_path);
    }
    return record;
  });

  for (let start = 0; start < records.length; start += 250) {
    await destination(table).insert(records.slice(start, start + 250));
  }
  return records.length;
}

async function copyAssets(source: Knex, sourceUrl: string, destinationUrl: string, destinationSecretKey: string): Promise<number> {
  const assets = await source('assets')
    .select('storage_path', 'mime_type')
    .whereNotNull('storage_path')
    .whereNull('deleted_at');
  const storage = createClient(destinationUrl, destinationSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let copied = 0;

  for (const asset of assets) {
    const sourceResponse = await fetch(storageObjectUrl(sourceUrl, asset.storage_path));
    if (!sourceResponse.ok) {
      throw new Error(`Could not download asset ${asset.storage_path}: ${sourceResponse.status}`);
    }
    const body = Buffer.from(await sourceResponse.arrayBuffer());
    const { error } = await storage.storage.from('assets').upload(asset.storage_path, body, {
      contentType: asset.mime_type || sourceResponse.headers.get('content-type') || 'application/octet-stream',
      upsert: true,
    });
    if (error) throw new Error(`Could not upload asset ${asset.storage_path}: ${error.message}`);
    copied += 1;
  }

  return copied;
}

async function main(): Promise<void> {
  for (const variable of requiredEnvironment) requireEnvironment(variable);

  const source = databaseClient(process.env.AVI_SOURCE_DATABASE_URL!);
  const destination = databaseClient(process.env.AVI_DESTINATION_DATABASE_URL!);
  try {
    await runDestinationMigrations(destination);
    // Migrations seed empty defaults; replace them with the real source content.
    await clearDestinationBuilderData(destination);
    const copiedTables: Record<string, number> = {};
    for (const table of tableOrder) {
      copiedTables[table] = await copyTable(
        source,
        destination,
        table,
        process.env.AVI_DESTINATION_SUPABASE_URL!,
      );
    }
    const copiedAssets = await copyAssets(
      source,
      process.env.AVI_SOURCE_SUPABASE_URL!,
      process.env.AVI_DESTINATION_SUPABASE_URL!,
      process.env.AVI_DESTINATION_SUPABASE_SECRET_KEY!,
    );
    console.log(JSON.stringify({ copiedTables, copiedAssets }));
  } finally {
    await Promise.all([source.destroy(), destination.destroy()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
