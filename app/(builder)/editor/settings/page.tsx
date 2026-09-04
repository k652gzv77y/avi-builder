import { redirect } from 'next/navigation';
import { projectsPath } from '@/lib/project-url';

export default function SettingsPage() {
  redirect(projectsPath('/settings/general'));
}
