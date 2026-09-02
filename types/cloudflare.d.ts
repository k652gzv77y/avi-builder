interface CloudflareEnv {
  HYPERDRIVE?: {
    connectionString: string;
  };
  IMAGES?: unknown;
  NEXT_TAG_CACHE_DO_SHARDED?: DurableObjectNamespace;
}
