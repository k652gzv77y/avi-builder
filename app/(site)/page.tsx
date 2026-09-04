import { redirect, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { fetchHomepage, fetchErrorPage, slimPageData } from '@/lib/page-fetcher';
import { loadPublishedHomepage } from '@/lib/published-home';
import PageRenderer from '@/components/PageRenderer';
import PasswordForm from '@/components/PasswordForm';
import { generatePageMetadata, fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { matchRedirect } from '@/lib/redirect-utils';
import { parseAuthCookie, getPasswordProtection, fetchFoldersForAuth } from '@/lib/page-auth';
import { getSiteBaseUrl } from '@/lib/url-utils';
import type { Redirect as RedirectType } from '@/types';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchCachedGlobalSettings() {
  try {
    return await fetchGlobalPageSettings();
  } catch {
    return {
      googleSiteVerification: null,
      globalCanonicalUrl: null,
      gaMeasurementId: null,
      publishedCss: null,
      colorVariablesCss: null,
      globalCustomCodeHead: null,
      globalCustomCodeBody: null,
      ycodeBadge: true,
      faviconUrl: null,
      webClipUrl: null,
    };
  }
}

export default async function Home() {
  await connection();

  const redirects = await getSettingByKey('redirects') as RedirectType[] | null;
  if (redirects && Array.isArray(redirects)) {
    const matched = matchRedirect('/', redirects);
    if (matched) {
      if (matched.type === '302') redirect(matched.newUrl);
      else permanentRedirect(matched.newUrl);
    }
  }

  const data = await loadPublishedHomepage();

  if (!data || !data.pageLayers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-xl font-semibold text-neutral-900">This site has no published homepage yet</h1>
          <p className="mt-2 text-sm text-neutral-500">Open Avi Builder and click Publish after you have a home page.</p>
        </div>
      </div>
    );
  }

  const globalSettings = await fetchCachedGlobalSettings();
  const cssForPage = data.generatedCss || globalSettings.publishedCss || undefined;
  const folders = await fetchFoldersForAuth(true);
  const protectionCheck = getPasswordProtection(data.page, folders, null);

  if (protectionCheck.isProtected) {
    const authCookie = await parseAuthCookie();
    const protection = getPasswordProtection(data.page, folders, authCookie);
    if (!protection.isUnlocked) {
      const errorPageData = await fetchErrorPage(401, true);
      if (errorPageData) {
        const slim = slimPageData(errorPageData);
        return (
          <PageRenderer
            page={slim.page}
            layers={slim.pageLayers.layers || []}
            components={slim.components}
            generatedCss={globalSettings.publishedCss || undefined}
            colorVariablesCss={globalSettings.colorVariablesCss || undefined}
            globalCustomCodeHead={globalSettings.globalCustomCodeHead}
            globalCustomCodeBody={globalSettings.globalCustomCodeBody}
            passwordProtection={{
              pageId: protection.protectedBy === 'page' ? protection.protectedById : undefined,
              folderId: protection.protectedBy === 'folder' ? protection.protectedById : undefined,
              redirectUrl: '/',
              isPublished: true,
            }}
          />
        );
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center max-w-md px-4">
            <h1 className="text-6xl font-bold text-gray-900 mb-4">401</h1>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Password Protected</h2>
            <PasswordForm
              pageId={protection.protectedBy === 'page' ? protection.protectedById : undefined}
              folderId={protection.protectedBy === 'folder' ? protection.protectedById : undefined}
              redirectUrl="/"
              isPublished={true}
            />
          </div>
        </div>
      );
    }
  }

  return (
    <PageRenderer
      page={data.page}
      layers={data.pageLayers.layers || []}
      components={data.components}
      generatedCss={cssForPage}
      colorVariablesCss={globalSettings.colorVariablesCss || undefined}
      locale={data.locale}
      availableLocales={data.availableLocales}
      translations={data.translations}
      gaMeasurementId={globalSettings.gaMeasurementId}
      globalCustomCodeHead={globalSettings.globalCustomCodeHead}
      globalCustomCodeBody={globalSettings.globalCustomCodeBody}
      ycodeBadge={globalSettings.ycodeBadge}
    />
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const [data, globalSettings] = await Promise.all([
    fetchHomepage(true),
    fetchCachedGlobalSettings(),
  ]);

  if (!data) {
    return { title: 'Kolbo School', description: 'Built with Avi Builder' };
  }

  const folders = await fetchFoldersForAuth(true);
  const protectionCheck = getPasswordProtection(data.page, folders, null);
  if (protectionCheck.isProtected) {
    return { title: 'Password Protected', robots: { index: false, follow: false } };
  }

  const meta = await generatePageMetadata(data.page, {
    fallbackTitle: 'Home',
    pagePath: '/',
    globalSeoSettings: globalSettings,
    translations: data.translations,
  });
  const baseUrl = getSiteBaseUrl({ globalCanonicalUrl: globalSettings.globalCanonicalUrl });
  if (baseUrl) {
    try { meta.metadataBase = new URL(baseUrl); } catch { /* ignore */ }
  }
  return meta;
}
