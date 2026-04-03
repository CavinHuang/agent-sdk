/**
 * Settings type matching @anthropic-ai/claude-agent-sdk v0.2.90.
 * AUTO-GENERATED equivalent - DO NOT EDIT manually.
 */

export interface Settings {
    $schema?: 'https://json.schemastore.org/claude-code-settings.json';
    apiKeyHelper?: string;
    awsCredentialExport?: string;
    awsAuthRefresh?: string;
    gcpAuthRefresh?: string;
    fileSuggestion?: { type: 'command'; command: string };
    respectGitignore?: boolean;
    cleanupPeriodDays?: number;
    env?: { [k: string]: string };
    attribution?: {
        commit?: string;
        pr?: string;
    };
    includeCoAuthoredBy?: boolean;
    includeGitInstructions?: boolean;
    permissions?: {
        allow?: string[];
        deny?: string[];
        ask?: string[];
        defaultMode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'dontAsk' | 'plan';
        disableBypassPermissionsMode?: 'disable';
        additionalDirectories?: string[];
        [k: string]: unknown;
    };
    model?: string;
    availableModels?: string[];
    modelOverrides?: { [k: string]: string };
    enableAllProjectMcpServers?: boolean;
    enabledMcpjsonServers?: string[];
    disabledMcpjsonServers?: string[];
    allowedMcpServers?: {
        serverName?: string;
        serverCommand?: [string, ...string[]];
        serverUrl?: string;
    }[];
    deniedMcpServers?: {
        serverName?: string;
        serverCommand?: [string, ...string[]];
        serverUrl?: string;
    }[];
    hooks?: {
        [k: string]: {
            matcher?: string;
            hooks: ({
                type: 'command';
                command: string;
                if?: string;
                shell?: 'bash' | 'powershell';
                timeout?: number;
                statusMessage?: string;
                once?: boolean;
                async?: boolean;
                asyncRewake?: boolean;
            } | {
                type: 'prompt';
                prompt: string;
                if?: string;
                timeout?: number;
                model?: string;
                statusMessage?: string;
                once?: boolean;
            } | {
                type: 'agent';
                prompt: string;
                if?: string;
                timeout?: number;
                model?: string;
                statusMessage?: string;
                once?: boolean;
            } | {
                type: 'http';
                url: string;
                if?: string;
                timeout?: number;
                headers?: { [k: string]: string };
                allowedEnvVars?: string[];
                statusMessage?: string;
                once?: boolean;
            })[];
        }[];
    };
    worktree?: {
        symlinkDirectories?: string[];
        sparsePaths?: string[];
    };
    disableAllHooks?: boolean;
    defaultShell?: 'bash' | 'powershell';
    allowManagedHooksOnly?: boolean;
    allowedHttpHookUrls?: string[];
    httpHookAllowedEnvVars?: string[];
    allowManagedPermissionRulesOnly?: boolean;
    allowManagedMcpServersOnly?: boolean;
    strictPluginOnlyCustomization?: boolean | ('skills' | 'agents' | 'hooks' | 'mcp')[];
    statusLine?: { type: 'command'; command: string; padding?: number };
    enabledPlugins?: { [k: string]: string[] | boolean | { [k: string]: unknown } };
    extraKnownMarketplaces?: { [k: string]: any };
    strictKnownMarketplaces?: any[];
    blockedMarketplaces?: any[];
    forceLoginMethod?: 'claudeai' | 'console';
    forceLoginOrgUUID?: string | string[];
    otelHeadersHelper?: string;
    outputStyle?: string;
    language?: string;
    skipWebFetchPreflight?: boolean;
    sandbox?: {
        enabled?: boolean;
        failIfUnavailable?: boolean;
        autoAllowBashIfSandboxed?: boolean;
        allowUnsandboxedCommands?: boolean;
        network?: {
            allowedDomains?: string[];
            allowManagedDomainsOnly?: boolean;
            allowUnixSockets?: string[];
            allowAllUnixSockets?: boolean;
            allowLocalBinding?: boolean;
            httpProxyPort?: number;
            socksProxyPort?: number;
        };
        filesystem?: {
            allowWrite?: string[];
            denyWrite?: string[];
            denyRead?: string[];
            allowRead?: string[];
            allowManagedReadPathsOnly?: boolean;
        };
        ignoreViolations?: { [k: string]: string[] };
        enableWeakerNestedSandbox?: boolean;
        enableWeakerNetworkIsolation?: boolean;
        excludedCommands?: string[];
        ripgrep?: { command: string; args?: string[] };
        [k: string]: unknown;
    };
    feedbackSurveyRate?: number;
    spinnerTipsEnabled?: boolean;
    spinnerVerbs?: { mode: 'append' | 'replace'; verbs: string[] };
    spinnerTipsOverride?: { excludeDefault?: boolean; tips: string[] };
    syntaxHighlightingDisabled?: boolean;
    terminalTitleFromRename?: boolean;
    alwaysThinkingEnabled?: boolean;
    effortLevel?: 'low' | 'medium' | 'high';
    autoCompactWindow?: number;
    advisorModel?: string;
    fastMode?: boolean;
    fastModePerSessionOptIn?: boolean;
    promptSuggestionEnabled?: boolean;
    showClearContextOnPlanAccept?: boolean;
    agent?: string;
    companyAnnouncements?: string[];
    pluginConfigs?: {
        [k: string]: {
            mcpServers?: { [k: string]: { [k: string]: string | number | boolean | string[] } };
            options?: { [k: string]: string | number | boolean | string[] };
        };
    };
    remote?: { defaultEnvironmentId?: string };
    autoUpdatesChannel?: 'latest' | 'stable';
    minimumVersion?: string;
    plansDirectory?: string;
    channelsEnabled?: boolean;
    allowedChannelPlugins?: { marketplace: string; plugin: string }[];
    prefersReducedMotion?: boolean;
    autoMemoryEnabled?: boolean;
    autoMemoryDirectory?: string;
    autoDreamEnabled?: boolean;
    showThinkingSummaries?: boolean;
    skipDangerousModePermissionPrompt?: boolean;
    disableAutoMode?: 'disable';
    sshConfigs?: {
        id: string;
        name: string;
        sshHost: string;
        sshPort?: number;
        sshIdentityFile?: string;
        startDirectory?: string;
    }[];
    claudeMdExcludes?: string[];
    pluginTrustMessage?: string;
    [k: string]: unknown;
}
