import React from 'react';
import type { Metadata, Viewport } from 'next';
import DarkModeProvider from '@/components/DarkModeProvider';

export const defaultMetadata: Metadata = {
  title: 'AVI Builder - Advanced Visual Interface Builder',
  description: 'Advanced Visual Interface Builder',
  metadataBase: new URL('https://avibuilder.com'),
  applicationName: 'AVI Builder',
  manifest: '/avi-builder.webmanifest',
  icons: {
    icon: [
      { url: '/brand/avi-favicon-light.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/brand/avi-favicon-dark.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
    apple: [
      { url: '/brand/avi-webclip-light.png', sizes: '2048x2048', media: '(prefers-color-scheme: light)' },
      { url: '/brand/avi-webclip-dark.png', sizes: '2048x2048', media: '(prefers-color-scheme: dark)' },
    ],
  },
};

export const defaultViewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

interface RootLayoutShellProps {
  children: React.ReactNode;
  headElements?: React.ReactNode[];
  /**
   * Classes applied to <body>. Consumers can include a `next/font` variable
   * (e.g. `${inter.variable}`) so a font is only loaded on the routes that
   * need it. Defaults to a font-free `font-sans antialiased` so generic
   * `font-sans` references fall back to the system stack — this is what
   * public published sites should use to avoid shipping the builder's UI font.
   */
  bodyClassName?: string;
  /**
   * Language for the <html lang> attribute. Omitted for public published sites
   * so the per-page locale (set on the content wrapper by PageRenderer) is the
   * source of truth instead of a hardcoded `en`.
   */
  lang?: string;
}

export default function RootLayoutShell({
  children,
  headElements,
  bodyClassName = 'font-sans antialiased',
  lang,
}: RootLayoutShellProps) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {headElements}
      </head>
      <body className={bodyClassName} suppressHydrationWarning>
        <DarkModeProvider>
          {children}
        </DarkModeProvider>
      </body>
    </html>
  );
}
