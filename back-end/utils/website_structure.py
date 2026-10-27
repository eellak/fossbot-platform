"""Shared CMS layout with stable identities and language-specific copy.

IDs are editor metadata. Legacy sections/cards are matched by type occurrence on
first save; existing revision snapshots retain the previous layouts.
"""
import copy
import re

TEXT_FIELDS = {'title', 'text', 'description', 'alt', 'buttonLabel', 'fundingText',
               'role', 'organization', 'content'}
COLLECTIONS = ('cards', 'menu')
ID = re.compile(r'^[a-zA-Z0-9_-]{1,80}$')


def identify(sections):
    result = copy.deepcopy(sections)
    def assign(items, prefix):
        counts = {}
        seen = set()
        for item in items:
            kind = f"{item.get('type', 'item')}-{item.get('group', '')}"
            counts[kind] = counts.get(kind, 0) + 1
            identity = item.get('id') or f'{prefix}{kind}-{counts[kind]}'
            if not isinstance(identity, str) or not ID.fullmatch(identity) or identity in seen:
                raise ValueError('Component and card IDs must be valid and unique within their list')
            item['id'] = identity
            seen.add(identity)
            for field in COLLECTIONS:
                if field in item:
                    assign(item[field], f'{identity}-{field}-')
    assign(result, '')
    return result


def localize(layout, translated):
    """Use layout's order/settings/media, preserving translated copy by ID."""
    layout = identify(layout)
    translated = copy.deepcopy(translated)
    # Match pre-identity translations by type occurrence once, preserving their copy.
    occurrences = {}
    for item in translated:
        kind = (item.get('type'), item.get('group'))
        index = occurrences.get(kind, 0)
        occurrences[kind] = index + 1
        candidates = [source for source in layout if (source.get('type'), source.get('group')) == kind]
        if not item.get('id') and index < len(candidates):
            item['id'] = candidates[index]['id']
    for item, identified in zip(translated, identify(translated)):
        item['id'] = identified['id']
    translated_by_id = {item['id']: item for item in translated}
    result = []
    for source in layout:
        target = translated_by_id.get(source['id'], {})
        if (target.get('type'), target.get('group')) != (source.get('type'), source.get('group')):
            target = {}
        merged = copy.deepcopy(source)
        for name in TEXT_FIELDS:
            if name in target:
                merged[name] = copy.deepcopy(target[name])
        if 'values' in source:
            merged['values'] = {name: target.get('values', {}).get(name, value)
                                if not name.startswith(('image:', 'href:')) else value
                                for name, value in source['values'].items()}
        for field in COLLECTIONS:
            if field in source:
                merged[field] = localize(source[field], target.get(field, []))
        result.append(merged)
    return result


def public_sections(sections):
    result = copy.deepcopy(sections)
    def visit(items):
        for item in items:
            item.pop('id', None)
            for field in COLLECTIONS:
                if field in item:
                    visit(item[field])
    visit(result)
    return result
