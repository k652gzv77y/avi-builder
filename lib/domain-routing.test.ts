import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dnsChecklist,
  interpretProbeError,
  interpretProbeResponse,
  isAttachableHostname,
  parsePreviewHostname,
  previewHostname,
  previewPath,
  projectSlugForHostname,
  redirectLocation,
} from '@/lib/domain-routing';
import { planCustomDomain } from '@/lib/cloudflare-domains';

test('branch preview hosts keep a hyphenated project slug', () => {
  assert.deepEqual(parsePreviewHostname('Staging--Kolbo-School.avibuilder.com'), {
    branch: 'staging',
    project: 'kolbo-school',
  });
  assert.equal(parsePreviewHostname('avibuilder.com'), null);
  assert.equal(parsePreviewHostname('www.avibuilder.com'), null);
  assert.equal(parsePreviewHostname('kolboschool.com'), null);
  assert.equal(
    previewHostname('staging', 'kolbo-school'),
    'staging--kolbo-school.avibuilder.com',
  );
  assert.equal(
    previewPath('kolbo-school', 'staging'),
    '/projects/kolbo-school/preview?branch=staging',
  );
});

test('custom hostnames cannot be the builder or a preview host', () => {
  assert.equal(isAttachableHostname('kolboschool.com'), true);
  assert.equal(isAttachableHostname('https://www.kolboschool.com/path'), true);
  assert.equal(isAttachableHostname('avibuilder.com'), false);
  assert.equal(isAttachableHostname('kolbo-school.avibuilder.com'), false);
  assert.equal(isAttachableHostname('staging--kolbo-school.avibuilder.com'), false);
  assert.equal(isAttachableHostname('localhost'), false);
});

test('www redirects to apex and does not loop', () => {
  const domains = [
    { hostname: 'kolboschool.com', projectSlug: 'kolbo-school', redirect: 'none' as const, disconnectedAt: null },
    { hostname: 'www.kolboschool.com', projectSlug: 'kolbo-school', redirect: 'www-to-apex' as const, disconnectedAt: null },
    { hostname: 'old.example.com', projectSlug: 'kolbo-school', redirect: 'www-to-apex' as const, disconnectedAt: '2026-01-01T00:00:00.000Z' },
  ];
  assert.equal(redirectLocation('www.kolboschool.com', domains), 'https://kolboschool.com');
  assert.equal(redirectLocation('kolboschool.com', domains), null);
  assert.equal(redirectLocation('old.example.com', domains), null);
  assert.equal(projectSlugForHostname('kolboschool.com', domains), 'kolbo-school');
  assert.equal(projectSlugForHostname('old.example.com', domains), null);
});

test('DNS checklist names the worker CNAME and SSL probe states', () => {
  const records = dnsChecklist('www.kolboschool.com', 'www');
  assert.equal(records[0]?.type, 'CNAME');
  assert.equal(records[0]?.value, 'sites.avibuilder.com');
  assert.deepEqual(interpretProbeResponse(200), { status: 'live', sslStatus: 'active' });
  assert.deepEqual(interpretProbeResponse(502), { status: 'pending', sslStatus: 'active' });
  assert.deepEqual(interpretProbeError('getaddrinfo ENOTFOUND'), { status: 'pending', sslStatus: 'pending' });
  assert.deepEqual(interpretProbeError('certificate has expired'), { status: 'error', sslStatus: 'error' });
});

test('Cloudflare hostname plan stays idle without Seth credentials', () => {
  const missing = planCustomDomain('kolboschool.com', {});
  assert.equal(missing.ready, false);
  assert.deepEqual(missing.missing, ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID']);
  assert.equal(missing.cnameTarget, 'sites.avibuilder.com');
  assert.equal(planCustomDomain('kolboschool.com', { apiToken: 'token', zoneId: 'zone' }).ready, true);
});
