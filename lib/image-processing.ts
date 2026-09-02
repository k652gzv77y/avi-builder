import { isCloudflareRuntime } from '@/lib/platform/runtime';

export interface ImageDimensions {
  width: number | null;
  height: number | null;
}

interface CloudflareImagesBinding {
  info(input: Uint8Array): Promise<{ width?: number; height?: number }>;
  input(input: Uint8Array): {
    transform(options: Record<string, unknown>): {
      output(options: { format: 'image/webp' | 'image/avif' }): {
        response(): Promise<Response>;
      };
    };
    output(options: { format: 'image/webp' | 'image/avif' }): {
      response(): Promise<Response>;
    };
  };
}

async function getCloudflareImages(): Promise<CloudflareImagesBinding | null> {
  if (!isCloudflareRuntime()) return null;

  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  return (getCloudflareContext().env.IMAGES as CloudflareImagesBinding | undefined) ?? null;
}

async function getSharp() {
  // Keep the native module out of the Worker dependency graph. This branch is
  // only used by local development and the temporary Vercel deployment.
  const moduleName = ['sh', 'arp'].join('');
  const module = await import(moduleName);
  return module.default;
}

async function responseBytes(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

export async function getImageDimensions(input: Uint8Array): Promise<ImageDimensions> {
  const images = await getCloudflareImages();
  if (images) {
    const info = await images.info(input);
    return { width: info.width ?? null, height: info.height ?? null };
  }

  const sharp = await getSharp();
  const metadata = await sharp(input).metadata();
  return { width: metadata.width ?? null, height: metadata.height ?? null };
}

export async function convertImageToWebp(
  input: Uint8Array,
  options: { quality?: number; width?: number; height?: number; fit?: 'cover' | 'contain' | 'inside' } = {}
): Promise<Buffer> {
  const images = await getCloudflareImages();
  if (images) {
    let image = images.input(input);
    if (options.width || options.height) {
      image = image.transform({
        width: options.width,
        height: options.height,
        fit: options.fit ?? 'inside',
      }) as typeof image;
    }
    // Cloudflare Images chooses its own compression settings for binding output.
    return responseBytes(await image.output({ format: 'image/webp' }).response());
  }

  const sharp = await getSharp();
  let pipeline = sharp(input);
  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: options.fit ?? 'inside',
      withoutEnlargement: options.fit === 'inside',
    });
  }
  return pipeline.webp({ quality: options.quality ?? 85 }).toBuffer();
}

export async function transformImage(
  input: Uint8Array,
  options: { width?: number; height?: number; quality?: number; format: 'image/webp' | 'image/avif' }
): Promise<Buffer> {
  const images = await getCloudflareImages();
  if (images) {
    let image = images.input(input);
    if (options.width || options.height) {
      image = image.transform({
        width: options.width,
        height: options.height,
        fit: 'contain',
      }) as typeof image;
    }
    return responseBytes(await image.output({ format: options.format }).response());
  }

  const sharp = await getSharp();
  let pipeline = sharp(input);
  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return options.format === 'image/avif'
    ? pipeline.avif({ quality: options.quality ?? 80 }).toBuffer()
    : pipeline.webp({ quality: options.quality ?? 80 }).toBuffer();
}
