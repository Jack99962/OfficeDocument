/**
 * The handful of values every other slice of the generator needs.
 *
 * `ROOT` is resolved from this file, which sits one directory deeper than the
 * entry point -- hence `../..`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ORIGIN = 'https://word.whogogo.com';
export const REPO = 'https://github.com/Jack99962/OfficeDocument';
export const SITE_NAME = 'Online Document Editor';
