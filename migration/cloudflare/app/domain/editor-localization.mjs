// Mission 003 — pure multilingual domain model.
// Not connected to the editor, public renderer, authentication or Cloudflare.
// The existing root content of a legacy page/celebration space is French.

export const INITIAL_LANGUAGE_ID = 'fr';
export const LOCALIZABLE_FIELDS = Object.freeze([
  'name', 'title', 'label', 'description', 'subtitle', 'text', 'rich',
  'blocks', 'documents', 'media', 'links', 'contentIds'
]);

const LANGUAGE_ID_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const LOCALIZABLE = new Set(LOCALIZABLE_FIELDS);
const copy = value => structuredClone(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function requireLanguageId(id) {
  if (typeof id !== 'string' || !LANGUAGE_ID_PATTERN.test(id))
    throw new TypeError('Identifiant de langue invalide (ex. fr, en, pt-BR).');
  return id;
}
function requireLabel(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} doit être un texte non vide.`);
  return value;
}
function requireIdentity(entity) {
  const id = entity?.id ?? entity?.key;
  if ((typeof id !== 'string' || !id.trim()) &&
      (typeof id !== 'number' || !Number.isFinite(id)))
    throw new TypeError('Une page ou un espace doit avoir un identifiant permanent.');
  return id;
}
function assertRegistry(registry) {
  if (!registry || !Array.isArray(registry.languages) || !registry.languages.length)
    throw new TypeError('Registre des langues absent ou invalide.');
  const ids = new Set();
  for (const lang of registry.languages) {
    requireLanguageId(lang?.id);
    requireLabel(lang?.name, 'Le nom de la langue');
    if (ids.has(lang.id)) throw new Error(`Langue dupliquée : ${lang.id}`);
    if (typeof lang.active !== 'boolean') throw new TypeError('Activation invalide.');
    if (lang.flag !== undefined && typeof lang.flag !== 'string')
      throw new TypeError('Le drapeau doit être un texte ou une référence portable.');
    ids.add(lang.id);
  }
  requireLanguageId(registry.defaultLanguageId);
  if (!registry.languages.some(lang => lang.id === registry.defaultLanguageId && lang.active))
    throw new Error('La langue par défaut doit être présente et active.');
  return registry;
}
function withLanguage(registry, languageId, change) {
  assertRegistry(registry);
  requireLanguageId(languageId);
  if (!registry.languages.some(lang => lang.id === languageId))
    throw new Error(`Langue inconnue : ${languageId}`);
  const next = {...registry, languages: registry.languages.map(lang =>
    lang.id === languageId ? change({...lang}) : {...lang})};
  return assertRegistry(next);
}

// No external IDs, URLs or account configuration are generated or inferred.
export function createLanguageRegistry(saved) {
  if (saved === undefined || saved === null) return {
    version: 1,
    defaultLanguageId: INITIAL_LANGUAGE_ID,
    languages: [{id: INITIAL_LANGUAGE_ID, name: 'Français', flag: '🇫🇷', active: true}]
  };
  assertRegistry(saved);
  return copy(saved);
}
export function addLanguage(registry, {id, name, flag = '', active = false}) {
  assertRegistry(registry);
  requireLanguageId(id);
  requireLabel(name, 'Le nom de la langue');
  if (typeof flag !== 'string' || typeof active !== 'boolean')
    throw new TypeError('Drapeau ou activation invalide.');
  if (registry.languages.some(lang => lang.id === id)) throw new Error(`Langue déjà présente : ${id}`);
  return {...registry, languages: [...registry.languages.map(lang => ({...lang})),
    {id, name, flag, active}]};
}
export function renameLanguage(registry, languageId, name) {
  requireLabel(name, 'Le nom de la langue');
  return withLanguage(registry, languageId, lang => ({...lang, name}));
}
export function setLanguageFlag(registry, languageId, flag) {
  if (typeof flag !== 'string') throw new TypeError('Le drapeau doit être un texte ou une référence portable.');
  return withLanguage(registry, languageId, lang => ({...lang, flag}));
}
export function setLanguageActive(registry, languageId, active) {
  if (typeof active !== 'boolean') throw new TypeError('Activation invalide.');
  if (!active && registry.defaultLanguageId === languageId)
    throw new Error('Impossible de désactiver la langue par défaut.');
  return withLanguage(registry, languageId, lang => ({...lang, active}));
}
export function setDefaultLanguage(registry, languageId) {
  assertRegistry(registry);
  if (!registry.languages.some(lang => lang.id === languageId && lang.active))
    throw new Error('La nouvelle langue par défaut doit exister et être active.');
  return {...registry, defaultLanguageId: languageId};
}
export function selectLanguage(registry, requestedLanguageId) {
  assertRegistry(registry);
  const languageId = registry.languages.some(lang => lang.id === requestedLanguageId && lang.active)
    ? requestedLanguageId : registry.defaultLanguageId;
  return {requestedLanguageId: requestedLanguageId ?? null, languageId,
    usedFallback: requestedLanguageId !== languageId};
}

// Language variants carry CONTENT ONLY. The existing entity retains its ID,
// group, routes, lifecycle and all permission/visibility metadata. Translations
// must not be able to override any of these identity/security fields.
function validateContent(content, page) {
  if (!content || typeof content !== 'object' || Array.isArray(content))
    throw new TypeError('Une variante est un objet de contenu.');
  const keys = Object.keys(content);
  if (!keys.length || keys.some(key => !LOCALIZABLE.has(key)))
    throw new TypeError('La variante ne peut modifier que les champs éditoriaux.');
  if (page && (typeof content.name !== 'string' || !Array.isArray(content.blocks)))
    throw new TypeError('Une variante de page exige son nom et ses blocs complets.');
  if (hasOwn(content, 'blocks') && !Array.isArray(content.blocks))
    throw new TypeError('Les blocs doivent être une liste.');
  return copy(content);
}
function sourceLanguageOf(entity, registry) {
  const source = entity?.sourceLanguageId ?? INITIAL_LANGUAGE_ID;
  requireLanguageId(source);
  if (!registry.languages.some(lang => lang.id === source))
    throw new Error(`Langue du contenu original inconnue : ${source}`);
  return source;
}
function sourceContent(entity) {
  const result = {};
  for (const field of LOCALIZABLE_FIELDS)
    if (hasOwn(entity, field)) result[field] = copy(entity[field]);
  return result;
}
function withVariant(entity, registry, languageId, content, page) {
  requireIdentity(entity);
  assertRegistry(registry);
  requireLanguageId(languageId);
  if (!registry.languages.some(lang => lang.id === languageId))
    throw new Error(`Langue inconnue : ${languageId}`);
  if (languageId === sourceLanguageOf(entity, registry))
    throw new Error('Le contenu original reste dans les champs historiques ; ne pas le déplacer.');
  const variant = validateContent(content, page);
  return {...entity, translations: {...(entity.translations ?? {}), [languageId]: variant}};
}
function resolveVariant(entity, registry, requestedLanguageId) {
  const id = requireIdentity(entity);
  const selection = selectLanguage(registry, requestedLanguageId);
  const sourceId = sourceLanguageOf(entity, registry);
  const isActive = languageId => registry.languages.some(lang => lang.id === languageId && lang.active);
  const available = languageId => {
    if (!isActive(languageId)) return null;
    if (languageId === sourceId) return sourceContent(entity);
    if (!hasOwn(entity.translations ?? {}, languageId)) return null;
    const value = entity.translations[languageId];
    return value && typeof value === 'object' && !Array.isArray(value) ? copy(value) : null;
  };
  // Requested language > configured default > original legacy language.
  // Never splice missing translated fields from another language: blocks,
  // documents and media are a single independent version.
  for (const languageId of new Set([selection.languageId, registry.defaultLanguageId, sourceId])) {
    const content = available(languageId);
    if (content !== null) return {id, requestedLanguageId: selection.requestedLanguageId,
      languageId, usedFallback: languageId !== requestedLanguageId, content};
  }
  return null; // No active language has content: caller must not invent a version.
}
export function setPageTranslation(page, registry, languageId, content) {
  return withVariant(page, registry, languageId, content, true);
}
export function resolvePageTranslation(page, registry, requestedLanguageId) {
  return resolveVariant(page, registry, requestedLanguageId);
}
export function setCelebrationSpaceTranslation(space, registry, languageId, content) {
  return withVariant(space, registry, languageId, content, false);
}
export function resolveCelebrationSpaceTranslation(space, registry, requestedLanguageId) {
  return resolveVariant(space, registry, requestedLanguageId);
}

// A menu is a projection of canonical pages, NOT a collection of translations.
// This is intentionally unfiltered: the caller must apply the existing access
// and publication decisions to the canonical pages BEFORE invoking it.
export function projectPageMenu(pages, registry, requestedLanguageId) {
  if (!Array.isArray(pages)) throw new TypeError('La liste des pages est invalide.');
  const seen = new Set(), menu = [];
  for (const page of pages) {
    const id = requireIdentity(page), key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    const resolved = resolvePageTranslation(page, registry, requestedLanguageId);
    if (!resolved) continue;
    menu.push({pageId: id, name: resolved.content.name ?? '',
      group: page.group, placement: page.placement,
      languageId: resolved.languageId, usedFallback: resolved.usedFallback});
  }
  return menu;
}
