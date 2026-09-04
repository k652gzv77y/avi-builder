/**
 * Integrations Layout
 *
 * This layout is used by Next.js for integrations routes, but the actual
 * rendering is handled by BuilderApp which provides the HeaderBar
 * and IntegrationsContent component. This layout just passes through children.
 */
export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // BuilderApp handles all rendering including HeaderBar and IntegrationsContent
  // This layout just passes through children
  return <>{children}</>;
}
