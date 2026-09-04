import { redirect } from 'next/navigation';
import { projectsPath } from '@/lib/project-url';

export default function IntegrationsPage() {
  redirect(projectsPath('/integrations/apps'));
}
