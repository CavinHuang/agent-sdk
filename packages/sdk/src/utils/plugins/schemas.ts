// SDK stub — module not needed in SDK build

import { z } from 'zod/v4'

export function MarketplaceSourceSchema() {
  return z.object({}).passthrough()
}

export const ALLOWED_OFFICIAL_MARKETPLACE_NAMES: readonly string[] = []

export type PluginAuthor = { name?: string; url?: string }

export type PluginManifest = Record<string, unknown>

export type CommandMetadata = Record<string, unknown>
