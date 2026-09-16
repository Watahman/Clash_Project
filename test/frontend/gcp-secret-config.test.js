import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file) => fs.readFileSync(path.resolve(file), 'utf8');
const withoutPowerShellComments = (source) => source.replace(/^\s*#.*$/gm, '');

const audit = read('scripts/audit-gcp-secrets.ps1');
const envExample = read('.env.example');
const cloudRunEnvExample = read('cloudrun-env.example.yaml');
const deploymentFiles = [
    'deploy-cloud-run.ps1',
    'deploy-cloud-run-phase8.ps1',
    'configure-advanced-stats-production.ps1',
    'configure-advanced-stats-phase8.ps1'
];

function secretBindingText(source) {
    return source
        .split(/\r?\n/)
        // --remove-secrets is a one-time migration cleanup, not an active binding.
        .filter((line) => /--update-secrets/i.test(line))
        .join('\n');
}

function bindingNames(source) {
    return [...secretBindingText(source).matchAll(/(?:^|["',])\s*([A-Za-z][A-Za-z0-9_-]*)\s*=/g)]
        .map((match) => match[1]);
}

function assignmentValue(source, name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`^\\s*${escapedName}\\s*=\\s*([^#\\r\\n]*)`, 'm'));
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
}

function yamlValue(source, name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`^\\s*${escapedName}\\s*:\\s*["']?([^#\\r\\n"']+)`, 'm'));
    return match ? match[1].trim() : '';
}

describe('Cloud Run deployment safety contracts', () => {
    it('pins production deploys to clean origin/master and verifies the live revision', () => {
        const code = read('deploy-cloud-run.ps1');
        expect(code).toMatch(/git status --porcelain/i);
        expect(code).toMatch(/git fetch origin master --quiet/i);
        expect(code).toMatch(/origin\/master/i);
        expect(code).toMatch(/run services update-traffic[\s\S]*--to-latest/i);
        expect(code).toMatch(/Assert-LiveCloudRunDeployment/);
        expect(code).toMatch(/cpu-throttling/);
        expect(code).toMatch(/\/health/);
        expect(code).toMatch(/\/ready/);
    });

    it('pins preview deploys to clean origin/Development and enforces production secret parity', () => {
        const code = read('deploy-cloud-run-phase8.ps1');
        expect(code).toMatch(/git status --porcelain/i);
        expect(code).toMatch(/git fetch origin Development --quiet/i);
        expect(code).toMatch(/origin\/Development/i);
        expect(code).toMatch(/Assert-PreviewRuntimeParity/);
        expect(code).toMatch(/ADVANCED_STATS_COLLECTION_ENABLED=false/i);
        expect(code).toMatch(/ADVANCED_STATS_SCHEDULER_SECRET=ADVANCED_STATS_SCHEDULER_SECRET:latest/i);
        expect(code).toMatch(/--cpu-throttling/i);
    });
});

describe('GCP Secret Manager cost-control contracts', () => {
    it('keeps the audit strictly read-only and value-blind', () => {
        const code = withoutPowerShellComments(audit);

        expect(code).toMatch(/\[Parameter\(Mandatory\s*=\s*\$true\)\][\s\S]{0,120}\[string\]\$ProjectId/i);
        expect(code).toMatch(/secrets["'\s,]+list/i);
        expect(code).toMatch(/secrets["'\s,]+versions["'\s,]+list/i);
        expect(code).toMatch(/run["'\s,]+services["'\s,]+list/i);
        expect(code).toMatch(/run["'\s,]+services["'\s,]+describe/i);
        expect(code).toMatch(/EnabledVersions|ENABLED/i);
        expect(code).toMatch(/DisabledVersions|DISABLED/i);
        expect(code).toMatch(/DestroyedVersions|DESTROYED/i);
        expect(code).toMatch(/NewestVersion/i);
        expect(code).toMatch(/run["'\s,]+revisions["'\s,]+list/i);
        expect(code).toMatch(/CloudRunReferenced/i);
        expect(code).toMatch(/CloudRunReferences/i);
        expect(code).toMatch(/EnabledVersions\s*=\s*["']unknown["']/i);
        expect(code).toMatch(/secretKeyRef/i);
        expect(code).toMatch(/Write-Warning/i);

        expect(code).not.toMatch(/secrets\s+versions\s+access/i);
        expect(code).not.toMatch(/secrets\s+versions\s+add/i);
        expect(code).not.toMatch(/secrets\s+(?:create|delete|destroy|disable|enable)\b/i);
        expect(code).not.toMatch(/gcloud\s+config\s+set/i);
        expect(code).not.toMatch(/--data-file|\b(?:Set|Add|Out|Remove)-Content\b|\bNew-Item\b/i);
    });

    it('uses only the four approved Secret Manager binding names', () => {
        const sources = deploymentFiles.map(read);
        const bindings = sources.map(secretBindingText).join('\n');
        const names = sources.flatMap(bindingNames);
        const allowed = new Set([
            'SUPABASE_SERVICE_ROLE_KEY',
            'API_PROXY_SECRET',
            'ADVANCED_STATS_SCHEDULER_SECRET'
        ]);

        expect(bindings).not.toMatch(/POSTHOG_PROJECT_API_KEY|_API_KEY_SUPABASE|_API_KEY_ALL(?:2|3)?\b/i);
        expect(names.every((name) => allowed.has(name))).toBe(true);
        expect(bindings).toContain('SUPABASE_SERVICE_ROLE_KEY');
        expect(bindings).toContain('API_PROXY_SECRET');
        expect(bindings).toMatch(/ADVANCED_STATS_SCHEDULER_SECRET/);
        expect(read('deploy-cloud-run.ps1')).toMatch(/Assert-SecretManagerBindingsExist/);
    });

    it('keeps ordinary env values as placeholders and true secrets out of the YAML env file', () => {
        for (const name of ['_API_KEY_SUPABASE', 'POSTHOG_PROJECT_API_KEY']) {
            const localValue = assignmentValue(envExample, name);
            const cloudRunValue = yamlValue(cloudRunEnvExample, name);
            expect(localValue).toMatch(/replace|placeholder|your|example|publishable/i);
            expect(cloudRunValue).toMatch(/replace|placeholder|your|example|publishable/i);
        }

        const activeYamlSecretLines = cloudRunEnvExample
            .split(/\r?\n/)
            .filter((line) => /^\s*(SUPABASE_SERVICE_ROLE_KEY|API_PROXY_SECRET|ADVANCED_STATS_SCHEDULER_SECRET)\s*:/.test(line))
            .join('\n');
        expect(activeYamlSecretLines).toBe('');
        expect(envExample).not.toMatch(/(?:SUPABASE_SERVICE_ROLE_KEY|API_PROXY_SECRET)\s*=\s*(?:sk_|eyJ|gsk_)/i);
    });

    it.each([
        'configure-advanced-stats-production.ps1'
    ])('requires explicit scheduler-secret rotation in %s', (file) => {
        const code = withoutPowerShellComments(read(file));
        const compact = code.replace(/\s+/g, ' ');
        const rotationSwitch = compact.indexOf('$RotateSchedulerSecret');
        const rotationGuard = compact.match(/(?:if|elseif)\s*\([^)]*\$RotateSchedulerSecret[^)]*\)\s*\{([^}]*)\}/i);

        expect(compact).toMatch(/\[switch\]\s*\$RotateSchedulerSecret/i);
        expect(compact).toMatch(/secrets\s+versions\s+(?:list|describe)/i);
        expect(compact).toMatch(/ENABLED/i);
        expect(compact).toMatch(/latest/i);
        expect(rotationSwitch).toBeGreaterThan(-1);
        expect(rotationGuard).not.toBeNull();
        expect(rotationGuard[1]).toMatch(/(?:versions\s+add|(?:Add|New|Set)-\w*(?:Secret|Version))/i);
    });

    it('keeps the explicit Phase 8 collector workflow on the shared production scheduler secret', () => {
        const code = read('configure-advanced-stats-phase8.ps1');
        expect(code).toMatch(/SecretName = "ADVANCED_STATS_SCHEDULER_SECRET"/);
        expect(code).not.toMatch(/clashpanel-advanced-stats-scheduler-secret-phase8/);
        expect(code).not.toMatch(/secrets versions add|secrets create/);
        expect(read('enable-advanced-stats-phase8.ps1')).toMatch(/SecretName = "ADVANCED_STATS_SCHEDULER_SECRET"/);
    });
});
