import { redirect } from 'next/navigation';

export default async function ProjectEditorRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect('/ycode');
}
