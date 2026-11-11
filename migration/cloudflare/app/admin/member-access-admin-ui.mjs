// M007-B — opt-in administration component. Never mounted on public pages.
// The caller owns authentication, server reads/writes and conflict handling.
// This component is a DRAFT editor only, not a security boundary.
import {
  ACCESS_MODES, PAGE_KINDS, pageKind, createMemberAdminState,
  addAdminMemberType, renameAdminMemberType, assignAdminMemberTypes,
  setAdminPagePolicy
} from './member-access-admin-model.mjs';

const MODE_LABELS = Object.freeze({
  [ACCESS_MODES.PUBLIC]: 'Public — accessible à tous',
  [ACCESS_MODES.ALL_PRIVATE_TYPES]: 'Tous les types de membres privés',
  [ACCESS_MODES.SELECTED_TYPES]: 'Uniquement les types sélectionnés'
});
const PAGE_LABELS = Object.freeze({
  [PAGE_KINDS.ORDINARY]: 'Pages ordinaires',
  [PAGE_KINDS.FOOTER]: 'Pages de bas de page',
  [PAGE_KINDS.CELEBRATION]: 'Pages des célébrations'
});

export function mountMemberAccessAdmin(root, {initialState = {}, onChange = () => {}, warningText = null, pagePolicyWritable = true} = {}) {
  if (!root || typeof root.replaceChildren !== 'function' ||
      !root.ownerDocument || typeof onChange !== 'function')
    throw new TypeError('A real DOM root and an optional onChange callback are required');
  const document = root.ownerDocument;
  let state = createMemberAdminState(initialState);
  let memberId = state.members[0]?.id ?? '';
  let pageId = state.pages[0]?.id ?? '';
  let destroyed = false;

  function node(tag, className = '', text = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== null) element.textContent = String(text);
    return element;
  }
  function label(text, control) {
    const wrapper = node('label', 'member-admin-field');
    wrapper.append(node('span', '', text), control);
    return wrapper;
  }
  function button(text) {
    const element = node('button', 'member-admin-button', text);
    element.type = 'submit';
    return element;
  }
  function title(text) { return node('h3', 'member-admin-subtitle', text); }
  function section(heading) {
    const area = node('section', 'member-admin-card');
    area.append(title(heading));
    return area;
  }
  function emit(change, next, errorBox) {
    try {
      const updated = next();
      state = updated;
      onChange(createMemberAdminState(state), {kind: change});
      render();
    } catch (error) {
      errorBox.textContent = error?.message || 'Modification refusée';
    }
  }
  function render() {
    if (destroyed) return;
    const wrap = node('div', 'member-admin-007b');
    wrap.append(node('h2', 'member-admin-heading', 'Types de membres et autorisations'));
    const warning = node('p', 'member-admin-warning',
      warningText === null ?
        'Préparation uniquement : aucune sauvegarde D1 ni protection serveur active. ' +
        'Les contenus privés devront être protégés côté serveur, y compris leurs médias.' :
        String(warningText));
    warning.setAttribute('role', 'note');
    wrap.append(warning);
    const grid = node('div', 'member-admin-layout');

    // Catalogue: IDs remain permanent. Renaming only changes the display name.
    const typesCard = section('1. Types de membres');
    const addForm = node('form', 'member-admin-form');
    const newId = node('input');
    newId.type = 'text'; newId.required = true; newId.maxLength = 132;
    newId.placeholder = 'member-type:identifiant-permanent';
    const newName = node('input');
    newName.type = 'text'; newName.required = true; newName.maxLength = 120;
    newName.placeholder = 'Ex. : Membres de soutien';
    const addError = node('p', 'member-admin-error');
    addError.setAttribute('role', 'alert');
    addForm.append(label('Identifiant permanent', newId),
      label('Nom du type', newName), button('Créer ce type'), addError);
    addForm.addEventListener('submit', event => {
      event.preventDefault();
      emit('type-created', () => addAdminMemberType(state,
        {id: newId.value.trim(), name: newName.value}), addError);
    });
    typesCard.append(addForm);
    const list = node('div', 'member-admin-type-list');
    for (const type of state.types) {
      const form = node('form', 'member-admin-type-row');
      const fixed = node('code', 'member-admin-id', type.id);
      const input = node('input');
      input.type = 'text'; input.value = type.name; input.maxLength = 120;
      input.required = true;
      const nameField = label('Nom modifiable', input);
      const error = node('p', 'member-admin-error');
      error.setAttribute('role', 'alert');
      form.append(fixed, nameField, button('Renommer'));
      if (type.disabled === true)
        form.append(node('small', 'member-admin-muted', 'Type suspendu (historique conservé)'));
      form.append(error);
      form.addEventListener('submit', event => {
        event.preventDefault();
        emit('type-renamed', () => renameAdminMemberType(state, type.id, input.value), error);
      });
      list.append(form);
    }
    if (!state.types.length)
      list.append(node('p', 'member-admin-muted', 'Aucun type créé.'));
    typesCard.append(list);
    grid.append(typesCard);

    // A person may hold several independent member-type assignments.
    const peopleCard = section('2. Attributions aux personnes');
    if (state.members.length) {
      if (!state.members.some(person => person.id === memberId))
        memberId = state.members[0].id;
      const selector = node('select');
      for (const person of state.members) {
        const option = node('option', '', person.name || person.id);
        option.value = person.id; option.selected = person.id === memberId;
        selector.append(option);
      }
      selector.addEventListener('change', () => {memberId = selector.value; render();});
      peopleCard.append(label('Personne', selector));
      const form = node('form', 'member-admin-form');
      const choices = node('fieldset', 'member-admin-checks');
      choices.append(node('legend', '', 'Types attribués (choix multiples)'));
      const current = new Set(state.memberships
        .filter(link => link.memberId === memberId).map(link => link.typeId));
      const inputs = [];
      for (const type of state.types) {
        const input = node('input');
        input.type = 'checkbox'; input.value = type.id;
        input.checked = current.has(type.id);
        input.disabled = type.disabled === true;
        if (!input.disabled) inputs.push(input);
        const description = type.name + (input.disabled ?
          ' — suspendu, non attribuable' : '');
        choices.append(label(description, input));
      }
      const error = node('p', 'member-admin-error');
      error.setAttribute('role', 'alert');
      form.append(choices, button('Enregistrer les types'), error);
      form.addEventListener('submit', event => {
        event.preventDefault();
        // Do not revoke disabled historical memberships through this form.
        const historic = state.memberships.filter(link => link.memberId === memberId &&
          state.types.some(type => type.id === link.typeId && type.disabled === true))
          .map(link => link.typeId);
        emit('membership-updated', () => assignAdminMemberTypes(state, memberId,
          [...historic, ...inputs.filter(input => input.checked).map(input => input.value)]),
          error);
      });
      peopleCard.append(form);
    } else {
      peopleCard.append(node('p', 'member-admin-muted',
        'Aucune personne chargée. Le répertoire central sera raccordé après consolidation.'));
    }
    grid.append(peopleCard);

    // The same canonical page policy applies to all three categories.
    const pageCard = section('3. Autorisations des pages');
    if (state.pages.length) {
      if (!state.pages.some(page => page.id === pageId)) pageId = state.pages[0].id;
      const pageSelect = node('select');
      for (const category of Object.values(PAGE_KINDS)) {
        const group = node('optgroup');
        group.label = PAGE_LABELS[category];
        for (const page of state.pages.filter(item => pageKind(item) === category)) {
          const option = node('option', '', page.name || page.title || page.id);
          option.value = page.id; option.selected = page.id === pageId;
          group.append(option);
        }
        if (group.children.length) pageSelect.append(group);
      }
      pageSelect.addEventListener('change', () => {pageId = pageSelect.value; render();});
      pageCard.append(label('Page concernée', pageSelect));
      const page = state.pages.find(p => p.id === pageId);
      pageCard.append(node('code', 'member-admin-id', page.id));
      if (page.spaceId)
        pageCard.append(node('p', 'member-admin-warning',
          'Espace privé/public : les inscriptions individuelles à cet espace ' +
          'restent obligatoires lorsque celui-ci est privé.'));
      const form = node('form', 'member-admin-form');
      const radios = node('fieldset', 'member-admin-checks');
      radios.append(node('legend', '', 'Mode d’accès'));
      const currentPolicy = page.accessPolicy || {mode: ACCESS_MODES.PUBLIC};
      const modes = [];
      for (const mode of Object.values(ACCESS_MODES)) {
        const input = node('input');
        input.type = 'radio'; input.name = 'member-admin-policy-mode';
        input.value = mode; input.checked = currentPolicy.mode === mode;
        modes.push(input);
        radios.append(label(MODE_LABELS[mode], input));
      }
      const selectedBox = node('fieldset', 'member-admin-checks');
      selectedBox.append(node('legend', '', 'Types autorisés pour cette page'));
      const selected = new Set(currentPolicy.typeIds || []);
      const checks = [];
      for (const type of state.types) {
        const input = node('input');
        input.type = 'checkbox'; input.value = type.id;
        input.checked = selected.has(type.id);
        input.disabled = type.disabled === true;
        checks.push(input);
        selectedBox.append(label(type.name + (input.disabled ? ' (suspendu)' : ''), input));
      }
      const toggleSelected = () => {
        selectedBox.hidden = !modes.some(input =>
          input.checked && input.value === ACCESS_MODES.SELECTED_TYPES);
      };
      modes.forEach(input => input.addEventListener('change', toggleSelected));
      toggleSelected();
      const error = node('p', 'member-admin-error');
      error.setAttribute('role', 'alert');
      const applyPolicy=button('Appliquer à cette page');
      applyPolicy.disabled=!pagePolicyWritable;
      if(!pagePolicyWritable){
        applyPolicy.title='Sauvegarde sécurisée des politiques indisponible';
        form.append(node('p','member-admin-muted',
          'Lecture préparatoire uniquement : écriture de politique désactivée.'));
      }
      form.append(radios, selectedBox, applyPolicy, error);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if(!pagePolicyWritable) return;
        const mode = modes.find(input => input.checked)?.value;
        const policy = mode === ACCESS_MODES.SELECTED_TYPES ?
          {mode, typeIds: checks.filter(input => input.checked).map(input => input.value)} :
          {mode};
        emit('page-policy-updated', () => setAdminPagePolicy(state, pageId, policy), error);
      });
      pageCard.append(form);
    } else {
      pageCard.append(node('p', 'member-admin-muted', 'Aucune page chargée.'));
    }
    grid.append(pageCard);
    wrap.append(grid);
    root.replaceChildren(wrap);
  }
  render();
  return {
    getState: () => createMemberAdminState(state),
    setState(next) {state = createMemberAdminState(next); render();},
    destroy() {destroyed = true; root.replaceChildren();}
  };
}
