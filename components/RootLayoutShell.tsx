import React from 'react';
import type { Metadata, Viewport } from 'next';
import DarkModeProvider from '@/components/DarkModeProvider';

export const defaultMetadata: Metadata = {
  title: 'AVI Builder',
  description: 'Advanced Visual Interface Builder',
  metadataBase: new URL('https://avibuilder.com'),
  applicationName: 'AVI Builder',
  manifest: '/avi-builder.webmanifest',
  openGraph: {
    type: 'website',
    title: 'AVI Builder',
    description: 'Advanced Visual Interface Builder',
    images: [{ url: '/brand/avi-social-light.png', width: 1200, height: 640, alt: 'AVI Builder' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AVI Builder',
    description: 'Advanced Visual Interface Builder',
    images: ['/brand/avi-social-light.png'],
  },
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
    { media: '(prefers-color-scheme: light)', color: '#f4f4f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

const THEME_BOOTSTRAP = `(function(){try{var host=location.hostname;var builder=host==='avibuilder.com'||host==='www.avibuilder.com';var theme=localStorage.getItem('theme');var dark;if(builder){theme=theme||'system';dark=theme==='dark'||(theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);}else{dark=matchMedia('(prefers-color-scheme: dark)').matches;}var r=document.documentElement;r.classList.toggle('dark',!!dark);r.classList.toggle('light',!dark);r.style.colorScheme=dark?'dark':'light';r.style.background=dark?'#0a0a0a':'#f4f4f5';}catch(e){}})();`;

interface RootLayoutShellProps {
  children: React.ReactNode;
  headElements?: React.ReactNode[];
  bodyClassName?: string;
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
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {headElements}
      </head>
      <body className={`${bodyClassName} bg-background text-foreground`} suppressHydrationWarning>
        <DarkModeProvider>
          {children}
        </DarkModeProvider>
      </body>
    </html>
  );
}
